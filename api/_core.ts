// ============================================================================
// Общая логика вызова Gemini API (Google Generative Language, free tier).
// Файл начинается с "_" — Vercel НЕ делает из него отдельную функцию.
// Его используют двое: api/gemini.ts (прод) и vite.config.ts (локальный dev).
// КЛЮЧ СЮДА НЕ ПИСАТЬ — он приходит параметром из серверного окружения.
// ============================================================================
import type { ChatTurn } from '../src/types'

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

/**
 * Уровень задачи: модель подбирается ПО СЛОЖНОСТИ, а не одна на всё
 * (принцип «справится ли модель слабее — без потери качества?»).
 * Уровень НЕ приходит от клиента: он выводится из типа задачи на сервере
 * (api/_tasks.ts). Списка «разрешённых моделей» больше нет за ненадобностью —
 * клиенту вообще нечем попросить конкретную модель.
 *   lite     — перевод слова в контексте, простые определения;
 *   standard — чат Диалога, письмо, AI-разбор работ, квесты;
 *   max      — генерация материалов преподавателя (сложные составные запросы).
 * Внутри уровня — цепочка фолбэков при 429/404: у каждой модели своя
 * бесплатная квота, поэтому «лимит исчерпан» почти исчезает. Списки сверены
 * с /v1beta/models нашего ключа (2026-07-22). Gemma не поддерживает
 * systemInstruction (см. обработку в callGemini).
 */
export type AiTier = 'lite' | 'standard' | 'max'

/**
 * ВАЖНО про порядок (пересмотрен 2026-07-24): бесплатные лимиты Google —
 * ПОМОДЕЛЬНЫЕ (у каждой модели свой счётчик запросов в сутки, RPD), поэтому
 * цепочка фолбэков реально складывает квоты. Раньше первым для «standard»
 * (Диалог — самый частый сценарий) стоял gemini-2.5-flash, у которого RPD
 * всего ~20: он выгорал за десяток реплик, а заодно лишал уровень «max»
 * запасного пути. Теперь дефицитные модели — глубже в цепочке, а первыми
 * идут те, чьей квоты хватает на поток.
 * ⚠️ Точные RPD у 3.6-flash / 3.5-flash стоит подсмотреть в AI Studio
 * (Dashboard → Usage) и при необходимости поправить порядок здесь.
 */
export const GEMINI_TIER_CHAINS: Record<AiTier, string[]> = {
  // лёгкое (перевод слова): сначала мини-модели, gemma — как большой резерв
  lite: [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemma-4-31b-it',
    'gemini-2.0-flash-lite',
  ],
  // частое (Диалог, письмо, квесты, разбор работ).
  //
  // ⚠️ 2026-07-24, ВАЖНО: gemma-4-31b ОТСЮДА УБРАНА, хотя у неё огромная квота
  // (RPM 30, RPD 14 400) и 24.07 она стояла первой именно поэтому. Причина:
  // Gemma не поддерживает systemInstruction, инструкцию приходится подавать
  // текстом — и она отвечает РАЗБОРОМ ЗАДАНИЯ вместо ответа: пересказывает
  // правила, пишет план, самопроверку («Plain text? Yes.») и дублирует реплику.
  // Всё это лезло пользователю в чат «Диалога». Испробованы и обрамление
  // границами, и подача инструкции отдельной парой реплик — не помогает,
  // проверено живыми запросами на проде (scripts/check-dialog-prompt.mjs).
  // Поэтому здесь только модели с настоящим systemInstruction. Да, у каждой
  // RPD ~20 (≈60 запросов в сутки на всех), но когда цепочка исчерпана,
  // api/gemini.ts уходит на Groq-70b — он тоже понимает system-роль и держит
  // поток. Пусть лучше отвечает Groq, чем Gemma ломает экран.
  standard: [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
  ],
  // материалы и программа обучения генерируются единицами в день — здесь
  // не жалеем самых умных моделей с их крошечными бесплатными квотами
  max: ['gemini-2.5-pro', 'gemini-3-pro-preview', 'gemini-3.6-flash', 'gemini-2.5-flash'],
}

const FALLBACK_MODELS = GEMINI_TIER_CHAINS.standard.slice(1)

/**
 * Системная инструкция для Gemma (у неё нет systemInstruction) — ОТДЕЛЬНОЙ
 * парой реплик в начале переписки, а не подклейкой в текст сообщения.
 *
 * История вопроса (2026-07-24): инструкцию вклеивали в первое user-сообщение
 * («инструкция --- текст»). Gemma принимала её за содержание разговора и
 * отвечала разбором задания: пересказывала правила, писала план, самопроверку
 * («Plain text? Yes. No emojis? Yes.») и дублировала реплику — всё это лезло
 * пользователю в чат «Диалога». Обрамление границами не спасло: модель просто
 * добавила запрет «no meta-talk» в свой же пересказ правил и продолжила.
 * Работает другое: инструкция подаётся как УЖЕ состоявшийся обмен репликами
 * (пользователь дал правила — модель их приняла), и разбирать в ответе нечего.
 */
function gemmaPreamble(systemText: string): { role: string; parts: { text: string }[] }[] {
  return [
    { role: 'user', parts: [{ text: systemText }] },
    {
      role: 'model',
      parts: [{ text: 'Понял правила. Дальше выдаю только сам ответ, без пояснений о правилах.' }],
    },
  ]
}

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
  /** Уровень задачи — от него зависит «щедрость» генерации (см. bodyFor). */
  tier: AiTier = 'standard',
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

  /**
   * Тело запроса под конкретную модель (у Gemma нет systemInstruction).
   *
   * Настройки генерации зависят от уровня задачи. Наблюдение владельца
   * (24.07): упираемся мы в ЧИСЛО запросов (RPD), а токенов расходуем
   * единицы процентов от лимита (TPM ~1.9 тыс. из 250 тыс.). Значит, экономить
   * токены незачем — выгоднее сделать каждый запрос качественнее:
   *   lite     — перевод слова: низкая температура (нужна точность, не
   *              фантазия), короткий ответ, без «размышлений» — быстро;
   *   standard — Диалог/письмо/разбор: «размышления» включены (у 2.5-моделей
   *              их раньше глушили ради экономии), ответ длиннее;
   *   max      — материалы и программа: самый большой потолок ответа.
   */
  const bodyFor = (m: string): string => {
    const isGemma = m.startsWith('gemma')
    const isThinkingModel = m.startsWith('gemini-2.5')
    const gen: Record<string, unknown> =
      tier === 'lite'
        ? {
            temperature: 0.2,
            maxOutputTokens: 1024,
            ...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          }
        : {
            temperature: 0.7,
            maxOutputTokens: tier === 'max' ? 8192 : 4096,
          }
    const body: Record<string, unknown> = {
      contents:
        isGemma && systemText && contents.length > 0
          ? [...gemmaPreamble(systemText), ...contents]
          : contents,
      generationConfig: gen,
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
