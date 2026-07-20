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

/** Разрешённые модели (клиент может попросить только их). */
export const ALLOWED_MODELS = [DEFAULT_GEMINI_MODEL, LIGHT_GEMINI_MODEL]

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

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      // у 2.5-моделей отключаем «размышления»: быстрее и экономит бесплатные токены
      ...(model.startsWith('gemini-2.5')
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    },
  }
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] }

  let res: Response | null = null
  for (let attempt = 0; ; attempt++) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      },
    )
    if (res.ok) break
    const canRetry = RETRIABLE.includes(res.status) && attempt < RETRY_DELAYS_MS.length
    if (!canRetry) break
    console.warn(`Gemini ${res.status}, повтор ${attempt + 1}/${RETRY_DELAYS_MS.length}`)
    await sleep(RETRY_DELAYS_MS[attempt])
  }

  if (!res.ok) {
    let detail = ''
    try {
      const err = (await res.json()) as { error?: { message?: string } }
      detail = err.error?.message ?? ''
    } catch {
      /* тело не JSON — не страшно */
    }
    if (res.status === 429) {
      throw new Error(
        'Дневной лимит бесплатных запросов Gemini исчерпан. Попробуй позже.',
      )
    }
    // детали Google пишем в лог сервера (Vercel), клиенту — обобщённый текст,
    // чтобы не раскрывать внутренности провайдера
    if (detail) console.error(`Gemini error ${res.status}: ${detail}`)
    if (RETRIABLE.includes(res.status)) {
      throw new Error(
        'Gemini сейчас перегружен — это бывает в часы пик на бесплатном тарифе. ' +
          'Мы попробовали трижды; подожди минуту и нажми ещё раз.',
      )
    }
    throw new Error(`Сервис AI временно недоступен (${res.status}). Попробуй позже.`)
  }

  const data = (await res.json()) as GeminiResponse
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error('Gemini вернул пустой ответ. Попробуй переформулировать.')
  return text
}
