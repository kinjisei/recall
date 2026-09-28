// ============================================================================
// Распознавание речи через Groq (Whisper large-v3-turbo, бесплатный тариф).
// Файл с «_» — Vercel НЕ делает из него функцию. Зовёт его api/transcribe.ts —
// и на проде, и в dev (vite.config.ts вызывает тот же обработчик).
// КЛЮЧ СЮДА НЕ ПИСАТЬ — приходит параметром из серверного окружения (GROQ_API_KEY).
//
// Модель turbo: та же точность транскрипции, что у large-v3, но заметно быстрее.
// language передаём явно ('en'/'es') — иначе Whisper может «перевести» речь на
// английский и ухудшить распознавание.
// ============================================================================
import { TIMEOUTS, TimeoutError, timedFetch } from './_timeouts.js'
import { failStatus, track, type Attempt } from './_usage.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
export const STT_MODEL = 'whisper-large-v3-turbo'

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
  /** Журнал попыток (api/_usage.ts). */
  trace?: Attempt[],
): Promise<string> {
  const form = new FormData()
  const bytes = Uint8Array.from(audio)
  form.append('file', new Blob([bytes], { type: mime || 'audio/webm' }), `audio.${extFor(mime)}`)
  form.append('model', STT_MODEL)
  form.append('language', lang)
  form.append('response_format', 'json')
  form.append('temperature', '0')

  let res: { ok: boolean; status: number; text: string }
  const done = track(trace, STT_MODEL)
  try {
    res = await timedFetch(
      GROQ_URL,
      { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form },
      timeoutMs,
      async (r) => ({ ok: r.ok, status: r.status, text: await r.text() }),
    )
  } catch (e) {
    done(failStatus(e))
    if (e instanceof TimeoutError) {
      console.warn(`Whisper: ${e.message}`)
      throw new Error('Сервис распознавания не ответил вовремя. Попробуй ещё раз.', { cause: e })
    }
    throw new Error('Не удалось связаться с сервисом распознавания.', { cause: e })
  }

  if (!res.ok) {
    done(String(res.status))
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

  // Пустой текст — законный ответ: человек промолчал, Whisper так и сказал.
  let text: string
  try {
    text = ((JSON.parse(res.text) as { text?: string }).text ?? '').trim()
  } catch {
    done('empty')
    throw new Error('Сервис распознавания ответил непонятно. Попробуй ещё раз.')
  }
  done('ok')
  return text
}
