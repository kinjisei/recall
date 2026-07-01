// ============================================================================
// Речь — Web Speech API (браузер, бесплатно, без сервера).
//   speak()  — озвучить текст (TTS, работает в большинстве браузеров)
//   listen() — распознать речь пользователя (STT, только Chrome/Edge)
// Контракт: docs/ARCHITECTURE.md §7.
// ============================================================================

export interface ListenResult {
  transcript: string
  confidence: number
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

/** Список доступных английских голосов (для выбора в UI при желании). */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (cachedVoices.length === 0) loadVoices()
  return cachedVoices.filter((v) => v.lang.toLowerCase().startsWith('en'))
}

/** Озвучить текст на английском. */
export function speak(text: string, opts?: { rate?: number; voice?: string }): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = opts?.rate ?? 1

  const voices = getEnglishVoices()
  const chosen =
    (opts?.voice && voices.find((v) => v.name === opts.voice)) ||
    voices.find((v) => v.lang.toLowerCase() === 'en-us') ||
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
 * Отклоняется, если браузер не поддерживает распознавание или ничего не услышал.
 */
export function listen(): Promise<ListenResult> {
  return new Promise((resolve, reject) => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      reject(
        new Error('Распознавание речи не поддерживается. Открой в Chrome или Edge.'),
      )
      return
    }

    const recognition = new Ctor()
    recognition.lang = 'en-US'
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

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, '')
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
