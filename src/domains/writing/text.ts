// ============================================================================
// Текст работы ученика: где в нём цитата правки, сколько слов, абзацев и
// предложений. Чистые функции без React — их берут и экран проверки (макет
// d7-3, `features/writing/essayMarks`), и экзаменатор (`examiner.ts`: доля
// предложений без ошибок). Держат test-essay-marks и test-writing-examiner.
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

/** Сколько слов в тексте — «Айгерим · 251 слов». */
export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length
}

/** Абзацы — куски между пустыми строками или переносами; пустые не считаются. */
export function paragraphCount(text: string): number {
  return text.split(/\n/).filter((p) => p.trim()).length
}

/**
 * Пункты списком («- …», «• …», «1) …») — на экзамене это «не связный текст»:
 * формат неуместен, Task ограничен (официальные Key Assessment Criteria).
 */
export function hasBullets(text: string): boolean {
  return text.split('\n').filter((l) => /^\s*([-•*–]|\d+[.)])\s+\S/.test(l)).length >= 2
}

export interface Sentence {
  start: number
  end: number
}

/**
 * Предложения: до «.», «!», «?» (и «…») перед пробелом или концом строки,
 * строка без точки (заголовок, «Dear Sir or Madam,») — отдельное предложение.
 * Сокращения вроде «e.g.» режут предложение лишний раз — доля предложений без
 * ошибок от этого чуть выше, а не ниже: экзаменатор не занижает.
 */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = []
  const re = /[^.!?…\n]*(?:[.!?…]+["'’”)]*(?=\s|$)|\n|$)/g
  for (let m = re.exec(text); m && m.index < text.length; m = re.exec(text)) {
    if (m[0] === '') {
      re.lastIndex++
      continue
    }
    const raw = m[0]
    const lead = raw.length - raw.trimStart().length
    const body = raw.trim()
    if (/[\p{L}\p{N}]/u.test(body)) out.push({ start: m.index + lead, end: m.index + lead + body.length })
  }
  return out
}
