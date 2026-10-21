/**
 * Слова плана в тексте материала (src/features/teacher/materials/markWords.ts,
 * макет d8-4): учитель видит, вошло ли целевое слово в текст.
 *
 * Держит:
 *   1. слово метится без учёта регистра и с простыми окончаниями
 *      (Delay, delayed, gates, boarding passes);
 *   2. длинное слово плана — целиком, а не его часть («boarding pass», не «pass»);
 *   3. кусок другого слова не метится (gate в «gateway», pass в «passenger»);
 *   4. текст склеивается из кусков обратно без потерь; без слов — один кусок;
 *   5. абзацы — по пустой строке, пустые не считаются.
 *
 * ⚠️ Ожидания — литералами, а не из тех же функций.
 *
 * Запуск: node scripts/test-mark-words.mjs
 */
import { markWords, paragraphs } from '../src/features/teacher/materials/markWords.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const hits = (text, words) => markWords(text, words).filter((p) => p.hit).map((p) => p.text)
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 1. регистр и окончания
const t1 = 'The screen said: “Delay — 3 hours”. The flight was delayed again at both gates.'
check('Delay и delayed, gates', eq(hits(t1, ['delay', 'gate']), ['Delay', 'delayed', 'gates']), JSON.stringify(hits(t1, ['delay', 'gate'])))

// 2. длинное — целиком
const t2 = 'She ran with her boarding pass. Show your pass, please. Two boarding passes!'
check('«boarding pass» целиком, потом «pass»', eq(hits(t2, ['pass', 'boarding pass']), ['boarding pass', 'pass', 'boarding passes']), JSON.stringify(hits(t2, ['pass', 'boarding pass'])))
// короткое — начало длинного: без порядка «boarding» съел бы начало «boarding pass»
check('«boarding» и «boarding pass» — метится длинное', eq(hits('Her boarding pass, then boarding.', ['boarding', 'boarding pass']), ['boarding pass', 'boarding']), JSON.stringify(hits('Her boarding pass, then boarding.', ['boarding', 'boarding pass'])))

// 3. кусок другого слова
const t3 = 'The gateway was open, a passenger waited.'
check('gateway и passenger не метятся', eq(hits(t3, ['gate', 'pass']), []), JSON.stringify(hits(t3, ['gate', 'pass'])))
check('испанский: «maleta» в «maletas», не в «maletero»', eq(hits('Dos maletas y un maletero.', ['maleta']), ['maletas']))

// 4. склейка
const pieces = markWords(t1, ['delay', 'gate'])
check('куски склеиваются в тот же текст', pieces.map((p) => p.text).join('') === t1)
check('без слов — один кусок', eq(markWords('Hello there.', []), [{ text: 'Hello there.', hit: false }]))
check('пустой текст — ни одного куска', eq(markWords('', ['a']), []))
check('спецсимволы в слове не ломают поиск', eq(hits('Use (a) here and a+b there.', ['a+b']), ['a+b']))

// 5. абзацы
check('абзацы по пустой строке', eq(paragraphs('One.\n\nTwo\nlines.\n \n\nThree.'), ['One.', 'Two\nlines.', 'Three.']))
check('пустой текст — ноль абзацев', eq(paragraphs('  \n\n '), []))

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
