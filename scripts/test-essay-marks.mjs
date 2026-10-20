/**
 * Правки AI в тексте ученика (src/features/writing/essayMarks.ts, макет d7-3,
 * PLAN.md Ф2.17-4в-1): цитата «было» находится в сочинении, номер — по
 * порядку текста.
 *
 * Держит:
 *   1. номера — по месту в тексте, а не по порядку списка AI;
 *   2. другой регистр и прямой апостроф вместо кривого — находится;
 *   3. одна цитата у двух правок — два разных места;
 *   4. не нашлась — номер после найденных, пометки нет;
 *   5. абзацы режутся по переводу строки, пометка — своим куском.
 *
 * ⚠️ Ожидания — литералами.
 *
 * Запуск: node scripts/test-essay-marks.mjs
 */
import { essayParagraphs, locateFixes, wordCount } from '../src/features/writing/essayMarks.ts'

let pass = 0
let fail = 0
const check = (name, ok, got) => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — получено: ${JSON.stringify(got)}`}`)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const essay = 'Nowadays students study in home.\n\nIt give them freedom. In the other hand, it give them stress. I don’t like it.'

// 1. номера по тексту: в списке AI сначала «In the other hand», потом «in home»
{
  const r = locateFixes(essay, [{ was: 'In the other hand' }, { was: 'in home' }])
  check('1. номер — по месту в тексте', same(r.number, [2, 1]), r.number)
  check('1. места по порядку текста', same(r.marks.map((m) => m.i), [1, 0]), r.marks)
  check('1. границы цитаты', same([r.marks[0].start, r.marks[0].end], [24, 31]), r.marks[0])
}

// 2. регистр и апостроф
{
  const r = locateFixes(essay, [{ was: "i don't like it" }])
  check('2. без регистра и с прямым апострофом', r.marks.length === 1 && essay.slice(r.marks[0].start, r.marks[0].end) === 'I don’t like it', r.marks)
}

// 3. одна цитата у двух правок — два места
{
  const r = locateFixes(essay, [{ was: 'it give them' }, { was: 'it give them' }])
  check('3. два места для одной цитаты', r.marks.length === 2 && r.marks[0].start !== r.marks[1].start, r.marks)
  check('3. первая — «It give them» в начале абзаца, вторая — после запятой', same(r.marks.map((m) => essay.slice(m.start, m.end)), ['It give them', 'it give them']), r.marks)
}

// 4. не нашлась — номер после найденных
{
  const r = locateFixes(essay, [{ was: 'goed home' }, { was: 'in home' }, { was: '' }])
  check('4. ненайденные — после найденных, по порядку списка', same(r.number, [2, 1, 3]), r.number)
  check('4. пометка только у найденной', same(r.marks.map((m) => m.i), [1]), r.marks)
}

// 5. абзацы и куски
{
  const r = locateFixes(essay, [{ was: 'in home' }, { was: 'In the other hand' }])
  const p = essayParagraphs(essay, r.marks)
  check('5. два абзаца', p.length === 2, p.length)
  check('5. первый абзац: текст, пометка, точка', same(p[0], [{ text: 'Nowadays students study ' }, { text: 'in home', mark: 0 }, { text: '.' }]), p[0])
  check('5. пометка во втором абзаце', p[1].some((x) => x.mark === 1 && x.text === 'In the other hand'), p[1])
  check('5. текст абзацев не теряется', p.map((x) => x.map((y) => y.text).join('')).join('\n\n') === essay, null)
}

check('слова: «I don’t like it» — 4', wordCount('I don’t like it') === 4, wordCount('I don’t like it'))

console.log(`\n${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
