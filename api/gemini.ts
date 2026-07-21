// ============================================================================
// Vercel serverless: POST /api/gemini  { messages, system? }  ->  { text }
// Ключ берётся ТОЛЬКО из серверной env-переменной GEMINI_API_KEY
// (Vercel → Project → Settings → Environment Variables). В коде фронта его нет.
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ChatTurn } from '../src/types'
// расширение .js обязательно: "type": "module" — Vercel/Node в ESM-режиме
// не находит модуль без расширения (FUNCTION_INVOCATION_FAILED при старте)
import { ALLOWED_MODELS, callGemini, DEFAULT_GEMINI_MODEL } from './_core.js'
import { authorize, applyCors } from './_auth.js'

// Генерация материала занимает 20–40 с (два запроса к Gemini), плюс повторы
// при 503. Дефолтные 10 с Vercel обрывали её раньше времени.
export const config = { maxDuration: 60 }

// Лимиты на вход — отсекают злоупотребление токенами (сжигание бесплатной квоты).
const MAX_MESSAGES = 50
const MAX_TOTAL_CHARS = 40_000
const MAX_SYSTEM_CHARS = 12_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })

  const access = await authorize(req)
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY не настроен на сервере' })
  }

  const { messages, system, model } = (req.body ?? {}) as {
    messages?: ChatTurn[]
    system?: string
    model?: string
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Нужно поле messages (непустой массив)' })
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Слишком много сообщений в запросе' })
  }
  const totalChars = messages.reduce(
    (n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0),
    0,
  )
  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(400).json({ error: 'Слишком большой запрос' })
  }
  if (typeof system === 'string' && system.length > MAX_SYSTEM_CHARS) {
    return res.status(400).json({ error: 'Слишком большая системная инструкция' })
  }

  // клиент может выбрать модель только из белого списка
  const chosenModel =
    model && ALLOWED_MODELS.includes(model)
      ? model
      : process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL

  try {
    const text = await callGemini(messages, system, apiKey, chosenModel)
    return res.status(200).json({ text })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка Gemini'
    return res.status(msg.includes('лимит') ? 429 : 502).json({ error: msg })
  }
}
