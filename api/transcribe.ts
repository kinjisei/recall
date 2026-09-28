// ============================================================================
// Vercel serverless: POST /api/transcribe  { audio(base64), mime, lang }  ->  { text }
// Распознаёт речь через Groq Whisper. Ключ — ТОЛЬКО из серверной env GROQ_API_KEY.
// Работает на любом устройстве (в т.ч. iPhone, где браузерного распознавания нет):
// клиент записывает аудио через MediaRecorder и присылает его сюда.
// Тот же обработчик обслуживает /api/transcribe и в dev (vite.config.ts).
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node'
// расширение .js обязательно в ESM ("type": "module")
import { authorize, applyCors, authDenied } from './_auth.js'
import { transcribeWithGroq } from './_stt.js'
import { startCall } from './_usage.js'
import { TIMEOUTS, windowUntil, workDeadline, type Timeouts } from './_timeouts.js'

export const config = { maxDuration: 30 }

// Бюджет (числа — api/_timeouts.ts): распознавание кончается к 22-й секунде
// (30 − 3 запас − 5 на итог с возвратом), окно Whisper — 15 с.
const LIMITS: Timeouts = { ...TIMEOUTS, functionMs: config.maxDuration * 1000 }

// Фраза для тренировки — несколько секунд. Больше ~4 МБ (после base64) не ждём;
// ограничение отсекает и случайные большие записи, и попытки грузить лишнее.
const MAX_AUDIO_BYTES = 3_000_000

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handle(req, res)
}

/** Сам обработчик. Сроки — параметром: тест гоняет те же пути за доли секунды. */
export async function handle(req: VercelRequest, res: VercelResponse, t: Timeouts = LIMITS) {
  const startedAt = Date.now()
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })

  const apiKey = process.env.GROQ_API_KEY
  // имя переменной окружения наружу не отдаём — подсказка для атакующего
  if (!apiKey) {
    return res.status(500).json({ error: 'Распознавание речи на сервере не настроено.' })
  }

  // Валидация аудио ДО списания квоты: пустой/битый base64 не должен жечь
  // единицу дневного speech-лимита (иначе несколько сбойных попыток выбивают
  // легитимного пользователя из лимита без единого распознавания).
  const { audio, mime, lang } = (req.body ?? {}) as {
    audio?: string
    mime?: string
    lang?: string
  }
  if (typeof audio !== 'string' || audio.length === 0) {
    return res.status(400).json({ error: 'Нужно поле audio (base64)' })
  }
  const speechLang = lang === 'es' ? 'es' : 'en'

  let buf: Buffer
  try {
    buf = Buffer.from(audio, 'base64')
  } catch {
    return res.status(400).json({ error: 'audio не является корректным base64' })
  }
  if (buf.length === 0 || buf.length > MAX_AUDIO_BYTES) {
    return res.status(400).json({ error: 'Слишком большая или пустая запись' })
  }

  // класс speech: 0 ⚡ и свой суточный кэп — попытки шэдоуинга не должны
  // съедать энергию Диалога
  const access = await authorize(req, 'speech', undefined, false, t.supabaseMs)
  if (authDenied(access)) return res.status(access.status).json({ error: access.error })

  const endBy = workDeadline(startedAt, t)
  const call = startCall(req, {
    token: access.refundToken,
    task: 'speech',
    tier: null,
    logMs: t.logMs,
    supabaseMs: t.supabaseMs,
    refundBy: endBy + t.supabaseMs,
  })
  try {
    const ms = windowUntil(endBy, t.sttMs)
    const text = await transcribeWithGroq(buf, mime || 'audio/webm', speechLang, apiKey, ms, call.trace)
    await call.finish('ok') // итог — до ответа (api/_usage.ts)
    return res.status(200).json({ text })
  } catch (e) {
    // то же правило, что в api/gemini: не распознали — не берём плату (итог
    // и возврат — одним запросом). У «Речи» свой суточный карман, и терять
    // его попытки из-за сбоя поставщика особенно обидно.
    await call.finish('failed')
    const msg = e instanceof Error ? e.message : 'Ошибка распознавания'
    return res.status(msg.includes('лимит') ? 429 : 502).json({ error: msg })
  }
}
