// ============================================================================
// Vercel serverless: POST /api/transcribe  { audio(base64), mime, lang }  ->  { text }
// Распознаёт речь через Groq Whisper. Ключ — ТОЛЬКО из серверной env GROQ_API_KEY.
// Работает на любом устройстве (в т.ч. iPhone, где браузерного распознавания нет):
// клиент записывает аудио через MediaRecorder и присылает его сюда.
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node'
// расширение .js обязательно в ESM ("type": "module")
import { authorize, applyCors } from './_auth.js'
import { transcribeWithGroq } from './_stt.js'

export const config = { maxDuration: 30 }

// Фраза для тренировки — несколько секунд. Больше ~4 МБ (после base64) не ждём;
// ограничение отсекает и случайные большие записи, и попытки грузить лишнее.
const MAX_AUDIO_BYTES = 3_000_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })

  // класс speech: у произношения свой щедрый лимит — попытки шэдоуинга не
  // должны съедать дневные «AI-действия» Диалога (их всего 12 на триале)
  const access = await authorize(req, 'speech')
  if (!access.ok) return res.status(access.status).json({ error: access.error })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY не настроен на сервере' })

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

  try {
    const text = await transcribeWithGroq(buf, mime || 'audio/webm', speechLang, apiKey)
    return res.status(200).json({ text })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка распознавания'
    return res.status(msg.includes('лимит') ? 429 : 502).json({ error: msg })
  }
}
