// ============================================================================
// Правки AI в тексте ученика (макет d7-3): абзацы текста кусками с пометками.
// Где в тексте цитата каждой правки и сколько слов — домен
// `domains/writing` (text.ts): их берёт и экзаменатор. Чистые функции, без
// React: держит scripts/test-essay-marks.mjs.
// ============================================================================

import type { EssayMark } from '../../domains/writing'

export { locateFixes, wordCount, type EssayMark, type LocatedFixes } from '../../domains/writing'

export type EssayPiece = { text: string; mark?: number }

/**
 * Абзацы текста кусками: обычный текст и пометки (`mark` — индекс правки).
 * Пометка, что пересекает границу абзаца, не рисуется — правка остаётся
 * справа с номером.
 */
export function essayParagraphs(essay: string, marks: readonly EssayMark[]): EssayPiece[][] {
  const out: EssayPiece[][] = []
  const re = /\n\s*\n|\n/g
  let from = 0
  const paras: [number, number][] = []
  for (let m = re.exec(essay); m; m = re.exec(essay)) {
    paras.push([from, m.index])
    from = m.index + m[0].length
  }
  paras.push([from, essay.length])
  for (const [ps, pe] of paras) {
    if (!essay.slice(ps, pe).trim()) continue
    const pieces: EssayPiece[] = []
    let at = ps
    for (const m of marks) {
      if (m.start < ps || m.end > pe) continue
      if (m.start > at) pieces.push({ text: essay.slice(at, m.start) })
      pieces.push({ text: essay.slice(m.start, m.end), mark: m.i })
      at = m.end
    }
    if (at < pe) pieces.push({ text: essay.slice(at, pe) })
    out.push(pieces)
  }
  return out
}
