// ============================================================================
// Правки AI в тексте ученика (макет d7-3): каждая цитата «было» находится в
// сочинении — нажал цифру в тексте, нашёл правку справа, и наоборот. Порядок
// по тексту (`number`) — для сортировки внутри вида; цифру на экране ставит
// панель (WritingReviewScreen). Чистые функции, без React: держит
// scripts/test-essay-marks.mjs.
//
// Цитату модель пишет «ровно как в тексте», но не всегда: другой регистр,
// прямой апостроф вместо кривого. Ищем сначала точно, потом без регистра и с
// одинаковыми кавычками; одна и та же цитата у двух правок — два разных места
// текста. Не нашлась — номер всё равно есть (после найденных), только без
// пометки в тексте.
// ============================================================================

export interface EssayMark {
  /** Номер правки в списке AI (`errors[i]`). */
  i: number
  start: number
  end: number
}

export interface LocatedFixes {
  /** Номер правки по порядку текста — по индексу в списке AI. */
  number: number[]
  /** Найденные места, по порядку текста. */
  marks: EssayMark[]
}

/** Кавычки и апострофы — к прямым; длина строки та же, места совпадают. */
function plain(s: string): string {
  return s.toLowerCase().replace(/[’‘ʼ`]/g, "'").replace(/[“”«»]/g, '"')
}

export function locateFixes(essay: string, fixes: readonly { was: string }[]): LocatedFixes {
  const taken: EssayMark[] = []
  const free = (start: number, end: number) => taken.every((m) => end <= m.start || start >= m.end)
  const find = (hay: string, needle: string): number => {
    for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
      if (free(at, at + needle.length)) return at
    }
    return -1
  }
  const lowEssay = plain(essay)
  fixes.forEach((f, i) => {
    const was = f.was.trim()
    if (!was) return
    let at = find(essay, was)
    if (at === -1) at = find(lowEssay, plain(was))
    if (at !== -1) taken.push({ i, start: at, end: at + was.length })
  })
  const marks = [...taken].sort((a, b) => a.start - b.start)
  const number: number[] = new Array(fixes.length).fill(0)
  marks.forEach((m, k) => (number[m.i] = k + 1))
  let next = marks.length
  number.forEach((n, i) => {
    if (!n) number[i] = ++next
  })
  return { number, marks }
}

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

/** Сколько слов в тексте — «Айгерим · 251 слов». */
export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length
}
