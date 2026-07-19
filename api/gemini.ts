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

// CORS: только известные origin'ы (реальный фронт ходит same-origin — заголовки
// нужны лишь на случай браузерного кросс-доступа; `*` раздавал прокси всему миру).
const ALLOWED_ORIGINS = [
  'https://recall-pgkz.vercel.app',
  'http://localhost:5173',
]

// Лимиты на вход — отсекают злоупотребление токенами (сжигание бесплатной квоты).
const MAX_MESSAGES = 50
const MAX_TOTAL_CHARS = 40_000
const MAX_SYSTEM_CHARS = 12_000

/**
 * Пускаем только вошедших: проверяем Supabase JWT из заголовка Authorization.
 * Иначе публичный прокси мог бы любой в интернете жечь нашу бесплатную квоту
 * Gemini. Валидируем токен запросом к Supabase Auth (без тяжёлого SDK).
 */
async function isAuthed(req: VercelRequest): Promise<boolean> {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return false
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    })
    return r.ok // 200 = токен валиден и не истёк
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })

  if (!(await isAuthed(req))) {
    return res.status(401).json({ error: 'Требуется вход в приложение' })
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
