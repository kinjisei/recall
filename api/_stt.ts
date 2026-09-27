// ============================================================================
// Распознавание речи через Groq (Whisper large-v3-turbo, бесплатный тариф).
// Файл с «_» — Vercel НЕ делает из него функцию. Используют двое:
// api/transcribe.ts (прод) и vite.config.ts (локальный dev).
// КЛЮЧ СЮДА НЕ ПИСАТЬ — приходит параметром из серверного окружения (GROQ_API_KEY).
//
// Модель turbo: та же точность транскрипции, что у large-v3, но заметно быстрее.
// language передаём явно ('en'/'es') — иначе Whisper может «перевести» речь на
// английский и ухудшить распознавание.
// ============================================================================
import { TIMEOUTS, TimeoutError, timedFetch } from './_timeouts.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MODEL = 'whisper-large-v3-turbo'

/** Расширение файла по MIME — Groq ориентируется в т.ч. на имя файла. */
function extFor(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

/**
 * Отправляет аудио в Groq и возвращает распознанный текст.
 * lang — язык речи ('en' | 'es'), нужен для точности.
 */
export async function transcribeWithGroq(
  audio: Buffer,
  mime: string,
  lang: 'en' | 'es',
  apiKey: string,
  /** Сколько ждём распознавание целиком, мс (api/_timeouts.ts). */
  timeoutMs = TIMEOUTS.sttMs,
): Promise<string> {
  const form = new FormData()
  const bytes = Uint8Array.from(audio)
  form.append('file', new Blob([bytes], { type: mime || 'audio/webm' }), `audio.${extFor(mime)}`)
  form.append('model', MODEL)
  form.append('language', lang)
  form.append('response_format', 'json')
  form.append('temperature', '0')

  let res: { ok: boolean; status: number; text: string }
  try {
    res = await timedFetch(
      GROQ_URL,
      { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form },
      timeoutMs,
      async (r) => ({ ok: r.ok, status: r.status, text: await r.text() }),
    )
  } catch (e) {
    if (e instanceof TimeoutError) {
      console.warn(`Whisper: ${e.message}`)
      throw new Error('Сервис распознавания не ответил вовремя. Попробуй ещё раз.', { cause: e })
    }
    throw new Error('Не удалось связаться с сервисом распознавания.', { cause: e })
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
    if (res.status === 429) {
      throw new Error('Дневной лимит бесплатного распознавания исчерпан. Попробуй позже.')
    }
    throw new Error(`Сервис распознавания временно недоступен (${res.status}).`)
  }

  const data = JSON.parse(res.text) as { text?: string }
  return (data.text ?? '').trim()
}
