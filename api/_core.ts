// ============================================================================
// Общая логика вызова Gemini API (Google Generative Language, free tier).
// Файл начинается с "_" — Vercel НЕ делает из него отдельную функцию.
// Его используют двое: api/gemini.ts (прод) и vite.config.ts (локальный dev).
// КЛЮЧ СЮДА НЕ ПИСАТЬ — он приходит параметром из серверного окружения.
// ============================================================================
import type { ChatTurn } from '../src/types'

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

/** Вызывает Gemini и возвращает текст ответа. Бросает Error с понятным сообщением. */
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    },
  )

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
    throw new Error(`Gemini ответил ошибкой ${res.status}. ${detail}`.trim())
  }

  const data = (await res.json()) as GeminiResponse
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error('Gemini вернул пустой ответ. Попробуй переформулировать.')
  return text
}
