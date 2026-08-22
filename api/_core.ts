// ============================================================================
// Общая логика вызова Gemini API (Google Generative Language, free tier).
// Файл начинается с "_" — Vercel НЕ делает из него отдельную функцию.
// Его используют двое: api/gemini.ts (прод) и vite.config.ts (локальный dev).
// КЛЮЧ СЮДА НЕ ПИСАТЬ — он приходит параметром из серверного окружения.
// ============================================================================
import type { ChatTurn } from '../src/types/index.js'

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
  // Поэтому здесь только модели с настоящим systemInstruction.
  //
  // ⚠️ ПОРЯДОК ЗАВИСИТ ОТ БИЛЛИНГА (энергия, E2). Цены за 1M токенов различаются
  // в 5×: 3.6-flash $1.50/$7.50 vs 2.5-flash $0.30/$2.50 (см. docs/energy-design).
  //   • FREE tier (флаг выкл, по умолчанию): 3.6-flash первым — у 2.5-flash
  //     крошечный free-RPD (~20/сут), первым он бы выгорал и лишал запаса.
  //     На free деньги = 0, важен только RPD, поэтому старый порядок.
  //   • PAID tier (RECALL_CHEAP_MODELS=1, включить в Vercel вместе с billing):
  //     2.5-flash первым — в 5× дешевле при достаточном качестве; дорогие 3.6/
  //     3.5 уходят в хвост «на случай, если дешёвая упрётся». Именно это делает
  //     энергетические пулы прибыльными.
  // Терминальный фолбэк (Groq-70b, ещё дешевле) добавляет api/gemini.ts.
  standard:
    process.env.RECALL_CHEAP_MODELS === '1'
      ? ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']
      : ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'],
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
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
}

/** Роль-контент для API: system-реплики отдельно, остальное — в contents. */
function splitMessages(
  messages: ChatTurn[],
  system: string | undefined,
): { systemText: string; contents: { role: string; parts: { text: string }[] }[] } {
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
  return { systemText, contents }
}

/**
 * Тело запроса под конкретную модель. Общее для обычного и потокового вызова —
 * иначе настройки генерации (температура, потолок, «размышления») разошлись бы.
 * У Gemma нет systemInstruction: инструкцию подаём отдельной парой реплик.
 *
 * Настройки зависят от уровня задачи (наблюдение владельца 24.07: упираемся в
 * ЧИСЛО запросов, не в токены, поэтому токены не жалеем ради качества):
 *   lite     — перевод слова: низкая температура, короткий ответ, без
 *              «размышлений» — быстро;
 *   standard — Диалог/письмо/разбор: «размышления» включены, ответ длиннее;
 *   max      — материалы/программа: самый большой потолок ответа.
 */
function geminiBody(
  model: string,
  systemText: string,
  contents: { role: string; parts: { text: string }[] }[],
  tier: AiTier,
): string {
  const isGemma = model.startsWith('gemma')
  const isThinkingModel = model.startsWith('gemini-2.5')
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
  /** Уровень задачи — от него зависит «щедрость» генерации (см. geminiBody). */
  tier: AiTier = 'standard',
): Promise<string> {
  const { systemText, contents } = splitMessages(messages, system)

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
          body: geminiBody(m, systemText, contents, tier),
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
    // ⚠️ Это НЕ лимит пользователя, а наш общий потолок у поставщика моделей:
    // у Google суточные квоты считаются на весь проект. Человек не должен
    // думать, что «сам всё истратил», — и энергию за неотвеченный запрос ему
    // возвращает api/gemini (правило «не доставили ответ — не берём плату»).
    if (lastStatus === 429) {
      throw new Error(
        'AI сегодня недоступен: у наших моделей закончился общий дневной запас. ' +
          'Это не твой лимит, энергия не потрачена. Слова, чтение, грамматика и ' +
          'произношение работают как обычно.',
      )
    }
    // детали Google пишем в лог сервера (Vercel), клиенту — обобщённый текст,
    // чтобы не раскрывать внутренности провайдера
    if (detail) console.error(`Gemini error ${lastStatus}: ${detail}`)
    // «на бесплатном тарифе» отсюда убрано: это читал и платящий репетитор,
    // для которого фраза выглядела прямой неправдой (находка ревью 2В).
    if (RETRIABLE.includes(lastStatus)) {
      throw new Error(
        'AI сейчас перегружен — подожди минуту и нажми ещё раз. Энергия не потрачена.',
      )
    }
    // код ответа наружу не показываем: пользователю он ничего не говорит,
    // а атакующему подсказывает внутренности (находка ревью 2В)
    throw new Error('AI сейчас не отвечает. Энергия не потрачена — попробуй позже.')
  }

  const data = (await res.json()) as GeminiResponse
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error('Gemini вернул пустой ответ. Попробуй переформулировать.')
  return text
}

/**
 * Потоковый вызов Gemini для «Диалога»: отдаёт куски текста по мере генерации,
 * чтобы ответ начинал появляться сразу, а не ждался целиком. Та же цепочка
 * фолбэков, что у callGemini, но переключиться между моделями можно только ДО
 * первого куска — после него поздно.
 *
 * Контракт с вызывающим (api/gemini.ts), важен для ЭНЕРГИИ:
 *   • бросает на ПЕРВОМ next(), если ни одна модель не отдала ни слова, —
 *     ответа нет, вызывающий возвращает энергию;
 *   • yield-ит куски, пока идёт ответ;
 *   • ЗАВЕРШАЕТСЯ НОРМАЛЬНО только при finishReason STOP (ответ дописан) — это
 *     сигнал «доставили, плату берём»;
 *   • бросает ПОСЛЕ выдачи кусков, если поток оборвался без STOP, — сигнал
 *     «оборвалось, вернуть энергию» (правило владельца: не завершился — не берём).
 */
export async function* streamGemini(
  messages: ChatTurn[],
  system: string | undefined,
  apiKey: string,
  model = DEFAULT_GEMINI_MODEL,
  fallbacks: string[] = FALLBACK_MODELS,
  tier: AiTier = 'standard',
): AsyncGenerator<string, void, unknown> {
  const { systemText, contents } = splitMessages(messages, system)
  const chain = [model, ...fallbacks.filter((m) => m !== model)]
  let lastStatus = 0
  let produced = false

  for (const m of chain) {
    let res: Response
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: geminiBody(m, systemText, contents, tier),
        },
      )
    } catch {
      continue // сетевой сбой к этой модели — следующая
    }
    if (!res.ok || !res.body) {
      lastStatus = res.status
      console.warn(`Gemini stream ${m}: ${res.status} — следующая модель`)
      continue
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let gotText = false
    let finished = false
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        // SSE: события разделены пустой строкой, полезное — строки «data: {…}».
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line.startsWith('data:')) continue
          const json = line.slice(5).trim()
          if (!json || json === '[DONE]') continue
          let obj: GeminiResponse
          try {
            obj = JSON.parse(json) as GeminiResponse
          } catch {
            continue // неполный/битый кусок — пропускаем
          }
          const delta = (obj.candidates?.[0]?.content?.parts ?? [])
            .map((p) => p.text ?? '')
            .join('')
          if (obj.candidates?.[0]?.finishReason) finished = true
          if (delta) {
            gotText = true
            produced = true
            yield delta
          }
        }
      }
    } catch {
      // Обрыв соединения. До первого куска — следующая модель; после — отдавать
      // нечего, сигналим «не завершилось» (энергия вернётся).
      if (gotText) throw new Error('Поток оборвался — ответ пришёл не полностью.')
      continue
    }
    if (gotText) {
      if (finished) return // ответ дописан целиком — успех
      throw new Error('Поток оборвался — ответ пришёл не полностью.')
    }
    // модель ответила пусто — следующая
  }

  // Ни одна модель не отдала ни слова.
  if (lastStatus === 429) {
    throw new Error(
      'AI сегодня недоступен: у наших моделей закончился общий дневной запас. ' +
        'Это не твой лимит, энергия не потрачена. Слова, чтение, грамматика и ' +
        'произношение работают как обычно.',
    )
  }
  throw new Error('AI сейчас не отвечает. Энергия не потрачена — попробуй позже.')
}
