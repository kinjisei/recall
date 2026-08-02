// ============================================================================
// Кэш «Разбора всего текста» в localStorage: первый разбор платный, повторное
// открытие — мгновенно и бесплатно. Ключ = язык + хэш текста. «Разобрать
// заново» чистит запись. Свои тексты и образцы — одинаково (по содержимому).
// ============================================================================
import type { AppLang } from '../types'
import type { TextAnalysis } from './textAnalysis'

/** djb2 — стабильный короткий хэш текста для ключа кэша. */
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const key = (lang: AppLang, text: string) => `recall.text_analysis.${lang}.${hash(text)}`

export function getCachedTextAnalysis(lang: AppLang, text: string): TextAnalysis | null {
  try {
    const raw = localStorage.getItem(key(lang, text))
    return raw ? (JSON.parse(raw) as TextAnalysis) : null
  } catch {
    return null
  }
}

export function setCachedTextAnalysis(lang: AppLang, text: string, data: TextAnalysis): void {
  try {
    localStorage.setItem(key(lang, text), JSON.stringify(data))
  } catch {
    /* переполнение localStorage не должно ронять разбор */
  }
}

export function clearCachedTextAnalysis(lang: AppLang, text: string): void {
  try {
    localStorage.removeItem(key(lang, text))
  } catch {
    /* ignore */
  }
}
