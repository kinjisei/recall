// ============================================================================
// Чат через Groq (OpenAI-совместимый API). Для ЛЁГКИХ массовых задач
// (определения, контекстный словарь, AI-разбор) — у Groq щедрый бесплатный
// лимит, поэтому мы не упираемся в дневную квоту Gemini так быстро.
// Файл с «_» — Vercel НЕ делает из него функцию. Ключ приходит параметром.
// ============================================================================
import type { ChatTurn } from '../src/types/index.js'
import { TIMEOUTS, TimeoutError, timedFetch } from './_timeouts.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** Модель по умолчанию для лёгких задач (быстрая, качественная, бесплатная). */
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

/** Мгновенная мини-модель — для tier 'lite' (перевод слова и т.п.). */
export const FAST_GROQ_MODEL = 'llama-3.1-8b-instant'

/** Разрешённые Groq-модели (клиент может попросить только их). */
export const ALLOWED_GROQ_MODELS = [DEFAULT_GROQ_MODEL, FAST_GROQ_MODEL]

interface GroqResponse {
  choices?: { message?: { content?: string } }[]
}

/** Вызывает Groq chat и возвращает текст. Бросает Error с понятным сообщением. */
export async function groqChat(
  messages: ChatTurn[],
  system: string | undefined,
  apiKey: string,
  model = DEFAULT_GROQ_MODEL,
  /** Сколько ждём ответ целиком, мс (api/_timeouts.ts). */
  timeoutMs = TIMEOUTS.groqMs,
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
  try {
    res = await timedFetch(
      GROQ_URL,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: msgs, temperature: 0.4, max_tokens: 1024 }),
      },
      timeoutMs,
      async (r) => ({ ok: r.ok, status: r.status, text: await r.text() }),
    )
  } catch (e) {
    if (e instanceof TimeoutError) {
      console.warn(`Groq ${model}: ${e.message}`)
      // тот же текст, что у зависшей цепочки Gemini: Groq — её последний рубеж
      throw new Error('AI сейчас не отвечает. Энергия не потрачена — попробуй позже.', { cause: e })
    }
    throw new Error('Не удалось связаться с Groq.', { cause: e })
  }

  if (!res.ok) {
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

  const data = JSON.parse(res.text) as GroqResponse
  const text = (data.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw new Error('Groq вернул пустой ответ.')
  return text
}
