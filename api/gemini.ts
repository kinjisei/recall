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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — на случай вызова задеплоенного эндпоинта с localhost при разработке
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })

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
