// ============================================================================
// Локальные настройки приложения (localStorage): скорость озвучки и размер
// текста в чтении. Хранятся на устройстве — у каждого телефона свои.
//
// Настройки профиля (имя, уровень) живут в БД и правятся напрямую,
// см. features/settings/SettingsPage.
// ============================================================================

const KEY = 'recall.settings'
const EVENT = 'recall:settings'

export type SpeechRate = 'slow' | 'normal' | 'fast'
export type ReaderSize = 'small' | 'normal' | 'large'

export interface Settings {
  speechRate: SpeechRate
  readerSize: ReaderSize
}

const DEFAULTS: Settings = { speechRate: 'normal', readerSize: 'normal' }

/** Множитель скорости для Web Speech API. */
export const SPEECH_RATES: Record<SpeechRate, number> = {
  slow: 0.75,
  normal: 1,
  fast: 1.25,
}

/** Классы размера текста для читалки. */
export const READER_CLASSES: Record<ReaderSize, string> = {
  small: 'text-base leading-relaxed',
  normal: 'text-lg leading-relaxed',
  large: 'text-xl leading-loose',
}

let cache: Settings | null = null

export function getSettings(): Settings {
  if (cache) return cache
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>
    cache = { ...DEFAULTS, ...raw }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

/** Сохранить изменения и оповестить открытые экраны. */
export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // приватный режим — настройки просто не переживут перезагрузку
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  return next
}

/** Подписка на изменения (для React-хука ниже). */
export function onSettingsChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

/** Текущая скорость озвучки числом — использует lib/speech. */
export function currentSpeechRate(): number {
  return SPEECH_RATES[getSettings().speechRate]
}
