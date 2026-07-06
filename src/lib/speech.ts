// ============================================================================
// Речь — Web Speech API (браузер, бесплатно, без сервера).
//   speak()  — озвучить текст (TTS, работает в большинстве браузеров)
//   listen() — распознать речь пользователя (STT, только Chrome/Edge)
// Поддерживает английский (en-US) и испанский (es-ES).
// Контракт: docs/ARCHITECTURE.md §7.
// ============================================================================
import type { AppLang } from '../types'

export interface ListenResult {
  transcript: string
  confidence: number
}

/** BCP-47-код языка речи для Web Speech API. */
export function speechLang(lang: AppLang): string {
  return lang === 'es' ? 'es-ES' : 'en-US'
}

// --- Озвучка (Text-to-Speech) ---

let cachedVoices: SpeechSynthesisVoice[] = []
function loadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  cachedVoices = window.speechSynthesis.getVoices()
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

/** Список доступных голосов языка ('en' | 'es'). */
export function getVoices(lang: AppLang = 'en'): SpeechSynthesisVoice[] {
  if (cachedVoices.length === 0) loadVoices()
  const prefix = lang === 'es' ? 'es' : 'en'
  return cachedVoices.filter((v) => v.lang.toLowerCase().startsWith(prefix))
}

/** Список доступных английских голосов (обратная совместимость). */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  return getVoices('en')
}

/** Озвучить текст. По умолчанию английский; opts.lang = 'es' — испанский. */
export function speak(
  text: string,
  opts?: { rate?: number; voice?: string; lang?: AppLang },
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const lang = opts?.lang ?? 'en'
  const bcp = speechLang(lang)

  const u = new SpeechSynthesisUtterance(text)
  u.lang = bcp
  u.rate = opts?.rate ?? 1

  const voices = getVoices(lang)
  const chosen =
    (opts?.voice && voices.find((v) => v.name === opts.voice)) ||
    voices.find((v) => v.lang.toLowerCase() === bcp.toLowerCase()) ||
    voices[0]
  if (chosen) u.voice = chosen

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

// --- Распознавание речи (Speech-to-Text) ---

/* eslint-disable @typescript-eslint/no-explicit-any */
function getRecognitionCtor(): any {
  if (typeof window === 'undefined') return undefined
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
}

/** Поддерживается ли распознавание речи в этом браузере. */
export function isRecognitionSupported(): boolean {
  return Boolean(getRecognitionCtor())
}

/**
 * Слушает один фрагмент речи и возвращает распознанный текст.
 * lang — язык распознавания ('en' | 'es'), по умолчанию английский.
 * Отклоняется, если браузер не поддерживает распознавание или ничего не услышал.
 */
export function listen(lang: AppLang = 'en'): Promise<ListenResult> {
  return new Promise((resolve, reject) => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      reject(
        new Error('Распознавание речи не поддерживается. Открой в Chrome или Edge.'),
      )
      return
    }

    const recognition = new Ctor()
    recognition.lang = speechLang(lang)
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    let settled = false

    recognition.onresult = (event: any) => {
      settled = true
      const result = event.results[0][0]
      resolve({
        transcript: String(result.transcript ?? ''),
        confidence: Number(result.confidence ?? 0),
      })
    }
    recognition.onerror = (event: any) => {
      if (settled) return
      settled = true
      const err = event?.error
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        reject(new Error('Нет доступа к микрофону. Разреши доступ в браузере.'))
      } else if (err === 'no-speech') {
        reject(new Error('Не услышал речь. Попробуй ещё раз.'))
      } else {
        reject(new Error('Ошибка распознавания: ' + (err ?? 'unknown')))
      }
    }
    recognition.onend = () => {
      if (settled) return
      settled = true
      reject(new Error('Ничего не распознал. Попробуй ещё раз.'))
    }

    try {
      recognition.start()
    } catch {
      if (!settled) reject(new Error('Не удалось запустить микрофон.'))
    }
  })
}

// --- Сравнение произнесённого с целевой фразой ---

/**
 * Разбивает фразу на слова: любые буквы (включая á, ñ, ü) и цифры.
 * Диакритику убираем (NFD + вырезание комбинирующих знаков U+0300–U+036F),
 * чтобы «cómo» и «como» считались одним словом — распознавание не всегда
 * расставляет ударения так же, как исходный текст.
 */
function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}'\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
}

export interface PronunciationScore {
  percent: number
  words: { word: string; ok: boolean }[]
}

/** Простая оценка: сколько слов целевой фразы прозвучало (0–100%). */
export function scorePronunciation(target: string, spoken: string): PronunciationScore {
  const targetWords = normalizeWords(target)
  const spokenSet = new Set(normalizeWords(spoken))
  const words = targetWords.map((word) => ({ word, ok: spokenSet.has(word) }))
  const matched = words.filter((w) => w.ok).length
  const percent = targetWords.length
    ? Math.round((matched / targetWords.length) * 100)
    : 0
  return { percent, words }
}
