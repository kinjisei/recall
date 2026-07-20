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

// Генерация материала занимает 20–40 с (два запроса к Gemini), плюс повторы
// при 503. Дефолтные 10 с Vercel обрывали её раньше времени.
export const config = { maxDuration: 60 }

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
 * Пускаем только вошедших, не заблокированных и не исчерпавших лимит.
 *
 * Без этой проверки публичный прокси позволил бы любому в интернете жечь нашу
 * бесплатную квоту Gemini, а любому зарегистрированному — выжечь её в цикле
 * за считанные минуты, положив AI сразу у всех пользователей.
 *
 * Всё делает одна RPC consume_ai_quota() (docs/schema.sql, блок «ЛИМИТЫ НА AI»),
 * вызванная с JWT пользователя. За один сетевой запрос она покрывает:
 *   - валидность токена  — PostgREST отвергает истёкший/поддельный сам (401);
 *   - бан в Supabase     — проверяется banned_until (PostgREST его не смотрит);
 *   - флаг blocked       — profiles.blocked;
 *   - лимиты             — 40 запросов в час и 200 в сутки на пользователя.
 * Счётчик живёт в БД и клиенту недоступен, подделать его нельзя.
 */
type AuthResult = { ok: true } | { ok: false; status: number; error: string }

const DENIED = {
  ok: false as const,
  status: 401,
  error: 'Требуется вход в приложение',
}

/** Резервная проверка токена — на случай, если RPC ещё не создана в БД. */
async function tokenValid(url: string, anon: string, token: string): Promise<boolean> {
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  })
  return r.ok
}

async function authorize(req: VercelRequest): Promise<AuthResult> {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return DENIED

  try {
    const r = await fetch(`${url}/rest/v1/rpc/consume_ai_quota`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    if (r.ok) return { ok: true }

    // Токен не принят самим PostgREST — дальше проверять нечего.
    if (r.status === 401 || r.status === 403) return DENIED

    const body = await r.text()
    if (body.includes('RECALL_NO_AUTH')) return DENIED
    if (body.includes('RECALL_BLOCKED')) {
      return { ok: false, status: 403, error: 'Доступ к аккаунту приостановлен' }
    }
    if (body.includes('RECALL_RATE_HOUR')) {
      return {
        ok: false,
        status: 429,
        error: 'Слишком много запросов к ИИ подряд. Попробуй через несколько минут.',
      }
    }
    if (body.includes('RECALL_RATE_DAY')) {
      return {
        ok: false,
        status: 429,
        error: 'Дневной лимит запросов к ИИ исчерпан. Он обновится завтра.',
      }
    }

    // Иная ошибка — почти наверняка «функция ещё не создана» (миграция не
    // применена). Не роняем AI из-за этого, но и вход не открываем: проверяем
    // токен обычным способом. Как только миграция применена, ветка не нужна.
    return (await tokenValid(url, anon, token)) ? { ok: true } : DENIED
  } catch {
    return DENIED
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
