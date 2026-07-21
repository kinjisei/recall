// ============================================================================
// Речь — озвучка (TTS) через Web Speech API (браузер, бесплатно, без сервера)
// и сравнение произнесённого с эталоном. Само распознавание речи вынесено в
// lib/transcribe (запись микрофона → Groq Whisper) — оно работает везде, вкл.
// iPhone, в отличие от браузерного Web Speech (только Chrome/Edge на десктопе).
// Поддерживает английский (en-US) и испанский (es-ES).
// Контракт: docs/ARCHITECTURE.md §7.
// ============================================================================
import { currentSpeechRate } from './settings'
import type { AppLang } from '../types'

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
  // без явного rate берём скорость из настроек пользователя
  u.rate = opts?.rate ?? currentSpeechRate()

  const voices = getVoices(lang)
  const chosen =
    (opts?.voice && voices.find((v) => v.name === opts.voice)) ||
    voices.find((v) => v.lang.toLowerCase() === bcp.toLowerCase()) ||
    voices[0]
  if (chosen) u.voice = chosen

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
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
