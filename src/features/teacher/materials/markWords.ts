// ============================================================================
// Слова плана в тексте материала (макет d8-4): «…waited near the [gate]» —
// учитель видит, вошло ли целевое слово в текст. Без экрана и базы — держит
// test-mark-words. Регистр не важен, простые окончания (delays, delayed,
// boarding passes) — тоже; кусок слова не метится (gate в «gateway» — нет).
// ============================================================================

export interface Piece {
  text: string
  /** Кусок — слово плана. */
  hit: boolean
}

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')

export function markWords(text: string, words: string[]): Piece[] {
  // длинные — первыми: «boarding pass» раньше, чем «pass»
  const list = [...new Set(words.map((w) => w.trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (list.length === 0 || !text) return text ? [{ text, hit: false }] : []
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(escape).join('|')})(?:s|es|ed|d|ing)?(?![\\p{L}\\p{N}])`, 'giu')
  const out: Piece[] = []
  let at = 0
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0
    if (i > at) out.push({ text: text.slice(at, i), hit: false })
    out.push({ text: m[0], hit: true })
    at = i + m[0].length
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
