// ============================================================================
// Vercel serverless: POST /api/gemini  { messages, system? }  ->  { text }
// Ключ берётся ТОЛЬКО из серверной env-переменной GEMINI_API_KEY
// (Vercel → Project → Settings → Environment Variables). В коде фронта его нет.
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ChatTurn } from '../src/types'
// расширение .js обязательно: "type": "module" — Vercel/Node в ESM-режиме
// не находит модуль без расширения (FUNCTION_INVOCATION_FAILED при старте)
import { callGemini, GEMINI_TIER_CHAINS, type AiTier } from './_core.js'
import { groqChat, DEFAULT_GROQ_MODEL, FAST_GROQ_MODEL } from './_groq.js'
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

  const { messages, system, provider, tier } = (req.body ?? {}) as {
    messages?: ChatTurn[]
    system?: string
    provider?: string
    tier?: string
  }

  // Уровень задачи: модель по сложности (см. GEMINI_TIER_CHAINS в _core).
  // legacy: старые клиенты шлют provider:'groq' для лёгких задач → 'lite'.
  // Считается ДО авторизации: от уровня зависит класс квоты (lite-запросы —
  // переводы слов — не должны съедать дневные «AI-действия» Диалога).
  // Подменить tier на 'lite' ради дешёвого кармана бессмысленно: lite-ветка
  // всегда уходит на слабую модель, параметр model там игнорируется.
  const aiTier: AiTier =
    tier === 'lite' || tier === 'max' || tier === 'standard'
      ? tier
      : provider === 'groq'
        ? 'lite'
        : 'standard'

  const access = await authorize(req, aiTier === 'lite' ? 'light' : 'heavy')
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error })
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

  const apiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY
  if (!apiKey && !groqKey) {
    return res.status(500).json({ error: 'AI-ключи не настроены на сервере' })
  }

  const fail = (e: unknown, fallbackMsg: string) => {
    const msg = e instanceof Error ? e.message : fallbackMsg
    return res.status(msg.includes('лимит') || msg.includes('исчерпан') ? 429 : 502).json({ error: msg })
  }

  try {
    // lite: мгновенный бесплатный Groq-мини первым (перевод слова и т.п. —
    // слабой модели достаточно), Gemini-lite цепочка — запасной путь
    if (aiTier === 'lite') {
      if (groqKey) {
        try {
          return res.status(200).json({ text: await groqChat(messages, system, groqKey, FAST_GROQ_MODEL) })
        } catch {
          /* Groq лёг/лимит — уходим на Gemini-lite */
        }
      }
      if (!apiKey) return res.status(502).json({ error: 'Сервис AI временно недоступен' })
      const chain = GEMINI_TIER_CHAINS.lite
      return res.status(200).json({ text: await callGemini(messages, system, apiKey, chain[0], chain.slice(1), 'lite') })
    }

    // standard/max: Gemini-цепочка уровня, терминальный фолбэк — Groq-70b.
    // Модель выбирает СЕРВЕР по уровню задачи. Клиентский параметр model
    // (legacy) намеренно игнорируется: иначе им можно было принудительно
    // стартовать с дефицитной модели в обход порядка цепочки и выжечь её
    // суточную квоту всем пользователям.
    const chain = GEMINI_TIER_CHAINS[aiTier]
    if (apiKey) {
      try {
        return res.status(200).json({ text: await callGemini(messages, system, apiKey, chain[0], chain, aiTier) })
      } catch (e) {
        if (!groqKey) return fail(e, 'Ошибка Gemini')
        /* вся Gemini-цепочка легла — последний рубеж Groq */
      }
    }
    if (!groqKey) return res.status(502).json({ error: 'Сервис AI временно недоступен' })
    return res.status(200).json({ text: await groqChat(messages, system, groqKey, DEFAULT_GROQ_MODEL) })
  } catch (e) {
    return fail(e, 'Ошибка AI')
  }
}
