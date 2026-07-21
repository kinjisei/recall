// ============================================================================
// Запись речи с микрофона + распознавание через наш прокси /api/transcribe
// (Groq Whisper на сервере). В отличие от Web Speech API, MediaRecorder работает
// ВЕЗДЕ, включая iPhone/Safari — поэтому оценка произношения доступна и на
// телефоне. Ключ Groq живёт только на сервере.
// ============================================================================
import { supabase } from './supabase'
import type { AppLang } from '../types'

/** Умеет ли устройство записывать микрофон (есть на iPhone, в отличие от распознавания). */
export function isMicSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

/** Выбирает формат записи, который поддерживает браузер (Safari — mp4, Chrome — webm). */
function pickMime(): string {
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg']
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m
  }
  return ''
}

/** Управление активной записью. */
export interface Recorder {
  /** Остановить запись и получить аудио-фрагмент. */
  stop: () => Promise<Blob>
  /** Прервать без результата (отпустить микрофон). */
  cancel: () => void
}

/**
 * Начинает запись с микрофона. Бросает, если нет доступа/поддержки.
 * Дорожку микрофона освобождаем при остановке — иначе на телефоне остаётся
 * «горит запись» и быстро сажает батарею.
 */
export async function startRecording(): Promise<Recorder> {
  if (!isMicSupported()) throw new Error('Запись с микрофона недоступна на этом устройстве.')

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    throw new Error('Нет доступа к микрофону. Разреши доступ в настройках браузера.')
  }

  const mime = pickMime()
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  rec.start()

  const release = () => stream.getTracks().forEach((t) => t.stop())

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          release()
          resolve(new Blob(chunks, { type: mime || 'audio/webm' }))
        }
        rec.stop()
      }),
    cancel: () => {
      try {
        if (rec.state !== 'inactive') rec.stop()
      } catch {
        /* уже остановлен */
      }
      release()
    },
  }
}

/** Blob → base64 (без префикса data:). Разбиваем на части — btoa не любит большие строки. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Не удалось прочитать запись.'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Отправляет запись на сервер и возвращает распознанный текст.
 * lang — язык речи ('en' | 'es') для точности.
 */
export async function transcribe(blob: Blob, lang: AppLang): Promise<string> {
  const audio = await blobToBase64(blob)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let res: Response
  try {
    res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ audio, mime: blob.type, lang }),
    })
  } catch {
    throw new Error('Нет соединения с сервером распознавания. Проверь интернет.')
  }

  let data: { text?: string; error?: string } | null = null
  try {
    data = (await res.json()) as { text?: string; error?: string }
  } catch {
    /* не JSON — обработаем по статусу */
  }
  if (!res.ok) throw new Error(data?.error ?? `Сервер распознавания ответил ошибкой ${res.status}`)
  return (data?.text ?? '').trim()
}
