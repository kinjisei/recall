// ============================================================================
// Общая логика вызова Gemini API (Google Generative Language, free tier).
// Файл начинается с "_" — Vercel НЕ делает из него отдельную функцию.
// Его используют двое: api/gemini.ts (прод) и vite.config.ts (локальный dev).
// КЛЮЧ СЮДА НЕ ПИСАТЬ — он приходит параметром из серверного окружения.
// ============================================================================
import type { ChatTurn } from '../src/types'

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

/** Лёгкая модель для простых массовых задач (отдельная дневная квота). */
export const LIGHT_GEMINI_MODEL = 'gemini-3.1-flash-lite'

/** Разрешённые модели (клиент может попросить только их; legacy-параметр). */
export const ALLOWED_MODELS = [DEFAULT_GEMINI_MODEL, LIGHT_GEMINI_MODEL]

/**
 * Уровень задачи: модель подбирается ПО СЛОЖНОСТИ, а не одна на всё
 * (принцип «справится ли модель слабее — без потери качества?»):
 *   lite     — перевод слова в контексте, простые определения;
 *   standard — чат Диалога, письмо, AI-разбор работ, квесты;
 *   max      — генерация материалов преподавателя (сложные составные запросы).
 * Внутри уровня — цепочка фолбэков при 429/404: у каждой модели своя
 * бесплатная квота, поэтому «лимит исчерпан» почти исчезает. Списки сверены
 * с /v1beta/models нашего ключа (2026-07-22). Gemma не поддерживает
 * systemInstruction (см. обработку в callGemini).
 */
export type AiTier = 'lite' | 'standard' | 'max'

export const GEMINI_TIER_CHAINS: Record<AiTier, string[]> = {
  lite: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.0-flash-lite'],
  standard: [
    'gemini-2.5-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemma-4-31b-it',
  ],
  // материалы генерируются редко (единицы в день) — можно позволить Pro-модели
  // с их маленькими бесплатными квотами ради заметно лучшего качества
  max: ['gemini-2.5-pro', 'gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-3.6-flash'],
}

const FALLBACK_MODELS = GEMINI_TIER_CHAINS.standard.slice(1)

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

/** Коды, при которых имеет смысл повторить: модель перегружена или сбой у Google. */
const RETRIABLE = [500, 502, 503, 504]
const RETRY_DELAYS_MS = [900, 2500]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Вызывает Gemini и возвращает текст ответа. Бросает Error с понятным сообщением.
 *
 * На бесплатном тарифе Gemini регулярно отвечает 503 «model is overloaded» —
 * это временно, поэтому такие ответы повторяем с нарастающей паузой, а не
 * показываем пользователю ошибку с первого раза.
 */
export async function callGemini(
  messages: ChatTurn[],
  system: string | undefined,
  apiKey: string,
  model = DEFAULT_GEMINI_MODEL,
  /** Явная цепочка фолбэков (по умолчанию — standard-цепочка). */
  fallbacks: string[] = FALLBACK_MODELS,
): Promise<string> {
  // system-реплики склеиваем в системную инструкцию, остальные — в contents
  const systemText = [
    system ?? '',
    ...messages.filter((m) => m.role === 'system').map((m) => m.content),
  ]
    .filter(Boolean)
    .join('\n\n')

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  /** Тело запроса под конкретную модель (у Gemma нет systemInstruction). */
  const bodyFor = (m: string): string => {
    const isGemma = m.startsWith('gemma')
    const body: Record<string, unknown> = {
      contents:
        isGemma && systemText && contents.length > 0
          ? // Gemma не принимает systemInstruction — вклеиваем инструкцию
            // в первое user-сообщение
            contents.map((c, i) =>
              i === 0 && c.role === 'user'
                ? { ...c, parts: [{ text: systemText + '\n\n---\n\n' + c.parts[0].text }] }
                : c,
            )
          : contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        // у 2.5-моделей отключаем «размышления»: быстрее и экономит бесплатные токены
        ...(m.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }
    if (systemText && !isGemma) body.systemInstruction = { parts: [{ text: systemText }] }
    return JSON.stringify(body)
  }

  // Цепочка моделей: выбранная + фолбэки. 429 (квота) и 404 (модель пропала) —
  // сразу пробуем следующую модель; 5xx — повторяем эту же с паузой.
  const chain = [model, ...fallbacks.filter((m) => m !== model)]
  let res: Response | null = null
  let lastStatus = 0

  outer: for (const m of chain) {
    for (let attempt = 0; ; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: bodyFor(m),
        },
      )
      if (res.ok) break outer
      lastStatus = res.status
      if (res.status === 429 || res.status === 404) {
        console.warn(`Gemini ${m}: ${res.status} — пробуем следующую модель цепочки`)
        continue outer
      }
      const canRetry = RETRIABLE.includes(res.status) && attempt < RETRY_DELAYS_MS.length
      if (!canRetry) break outer
      console.warn(`Gemini ${m} ${res.status}, повтор ${attempt + 1}/${RETRY_DELAYS_MS.length}`)
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }

  if (!res || !res.ok) {
    let detail = ''
    try {
      const err = (await res?.json()) as { error?: { message?: string } } | undefined
      detail = err?.error?.message ?? ''
    } catch {
      /* тело не JSON — не страшно */
    }
    if (lastStatus === 429) {
      throw new Error(
        'Дневные лимиты всех бесплатных AI-моделей исчерпаны. Попробуй завтра.',
      )
    }
    // детали Google пишем в лог сервера (Vercel), клиенту — обобщённый текст,
    // чтобы не раскрывать внутренности провайдера
    if (detail) console.error(`Gemini error ${lastStatus}: ${detail}`)
    if (RETRIABLE.includes(lastStatus)) {
      throw new Error(
        'AI сейчас перегружен — это бывает в часы пик на бесплатном тарифе. ' +
          'Подожди минуту и нажми ещё раз.',
      )
    }
    throw new Error(`Сервис AI временно недоступен (${lastStatus}). Попробуй позже.`)
  }

  const data = (await res.json()) as GeminiResponse
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error('Gemini вернул пустой ответ. Попробуй переформулировать.')
  return text
}
