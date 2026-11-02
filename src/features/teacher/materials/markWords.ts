// ============================================================================
// Слова плана в тексте материала (макет d8-4): «…waited near the [gate]» —
// учитель видит, вошло ли целевое слово в текст. Без экрана и базы — держит
// test-mark-words. Слово узнаётся в любой своей форме и фраза — с
// разрывами (`lib/wordForms`, Ф2.25): delayed, gates, boarding passes, took
// ⇒ take, «missed her flight» ⇒ miss a flight; кусок слова не метится (gate в
// «gateway» — нет). Длинное слово плана — раньше короткого: «boarding pass»
// целиком, а не «pass».
// ============================================================================
import { findPhrase, type IrregularForms, type Span } from '../../../lib/wordForms.ts'
import type { AppLang } from '../../../types'

export interface Piece {
  text: string
  /** Кусок — слово плана. */
  hit: boolean
}

export function markWords(text: string, words: string[], lang: AppLang = 'en', irregular?: IrregularForms): Piece[] {
  // длинные — первыми: «boarding pass» раньше, чем «pass»
  const list = [...new Set(words.map((w) => w.trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (list.length === 0 || !text) return text ? [{ text, hit: false }] : []
  const taken: Span[] = []
  for (const w of list) {
    for (const s of findPhrase(text, w, lang, irregular)) {
      if (!taken.some((t) => s.start < t.end && t.start < s.end)) taken.push(s)
    }
  }
  taken.sort((a, b) => a.start - b.start)
  const out: Piece[] = []
  let at = 0
  for (const s of taken) {
    if (s.start > at) out.push({ text: text.slice(at, s.start), hit: false })
    out.push({ text: text.slice(s.start, s.end), hit: true })
    at = s.end
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false })
  return out
}

/** Текст материала абзацами: пустая строка между ними. */
export const paragraphs = (body: string): string[] =>
  body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
