// ============================================================================
// Чат через Groq (OpenAI-совместимый API): первая модель лёгких задач и
// последний рубеж обычных (роли — GROQ_MODELS). Квоты у Groq свои, поэтому
// он добавляет запас к дневным лимитам Gemini, а не делит их.
// Файл с «_» — Vercel НЕ делает из него функцию. Ключ приходит параметром.
// ============================================================================
import type { ChatTurn } from '../src/shared/api/aiTypes.js'
import { TIMEOUTS, TimeoutError, timedFetch } from './_timeouts.js'
import { failStatus, track, type Attempt } from './_usage.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Модели Groq по ролям. Что модель ещё есть у Groq, проверяет
 * scripts/check-ai-models.mjs (запрос списка квоту не тратит).
 *   fast — первая у лёгких задач (перевод слова): мгновенная мини-модель;
 *   last — последний рубеж обычных задач, когда цепочка Gemini не ответила.
 *
 * ⚠️ 16.08.2026 Groq выключил прежние llama-3.1-8b-instant и
 * llama-3.3-70b-versatile, а код звал их до 28.09: каждый перевод слова
 * тратил запрос на отказ, у обычных задач последнего рубежа не было. Замены —
 * те, что назвал сам Groq (console.groq.com/docs/deprecations).
 */
export const GROQ_MODELS = {
  fast: 'openai/gpt-oss-20b',
  last: 'openai/gpt-oss-120b',
} as const

/**
 * gpt-oss — «размышляющие» модели: размышления считаются в max_tokens и
 * задерживают ответ. Нашим задачам (перевод слова, запасной ответ) хватает
 * низкого усилия, а сами размышления в ответ не нужны.
 */
const reasoningFor = (model: string) =>
  model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low', include_reasoning: false } : {}

interface GroqResponse {
  choices?: { message?: { content?: string } }[]
}

/** Вызывает Groq chat и возвращает текст. Бросает Error с понятным сообщением. */
export async function groqChat(
  messages: ChatTurn[],
  system: string | undefined,
  apiKey: string,
  model: string = GROQ_MODELS.last,
  /** Сколько ждём ответ целиком, мс (api/_timeouts.ts). */
  timeoutMs = TIMEOUTS.groqMs,
  /** Журнал попыток (api/_usage.ts). */
  trace?: Attempt[],
): Promise<string> {
  // system-реплики склеиваем в одну системную инструкцию
  const sys = [system ?? '', ...messages.filter((m) => m.role === 'system').map((m) => m.content)]
    .filter(Boolean)
    .join('\n\n')

  const msgs: { role: string; content: string }[] = []
  if (sys) msgs.push({ role: 'system', content: sys })
  for (const m of messages.filter((m) => m.role !== 'system')) {
    msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })
  }

  let res: { ok: boolean; status: number; text: string }
  const done = track(trace, model)
  try {
    res = await timedFetch(
      GROQ_URL,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: msgs,
          temperature: 0.4,
          max_tokens: 1024,
          ...reasoningFor(model),
        }),
      },
      timeoutMs,
      async (r) => ({ ok: r.ok, status: r.status, text: await r.text() }),
    )
  } catch (e) {
    done(failStatus(e))
    if (e instanceof TimeoutError) {
      console.warn(`Groq ${model}: ${e.message}`)
      // тот же текст, что у зависшей цепочки Gemini: Groq — её последний рубеж
      throw new Error('AI сейчас не отвечает. Энергия не потрачена — попробуй позже.', { cause: e })
    }
    throw new Error('Не удалось связаться с Groq.', { cause: e })
  }

  if (!res.ok) {
    done(String(res.status))
    let detail = ''
    try {
      const err = JSON.parse(res.text) as { error?: { message?: string } }
      detail = err.error?.message ?? ''
    } catch {
      /* тело не JSON */
    }
    if (detail) console.error(`Groq error ${res.status}: ${detail}`)
    if (res.status === 429) throw new Error('Дневной лимит Groq исчерпан. Попробуй позже.')
    throw new Error(`Сервис AI (Groq) временно недоступен (${res.status}).`)
  }

  let text = ''
  try {
    text = ((JSON.parse(res.text) as GroqResponse).choices?.[0]?.message?.content ?? '').trim()
  } catch {
    /* не JSON — то же, что пустой ответ */
  }
  done(text ? 'ok' : 'empty')
  if (!text) throw new Error('Groq вернул пустой ответ.')
  return text
}
