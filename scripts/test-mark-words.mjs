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
 *   5. слово — в любой своей форме, фраза — с разрывами до двух слов
 *      (Ф2.25): missed her flight ⇒ miss a flight, took ⇒ take (по справочнику),
 *      stopped, carried, making; испанские esperó ⇒ esperar, fue ⇒ ir;
 *   6. абзацы — по пустой строке, пустые не считаются.
 *
 * ⚠️ Ожидания — литералами, а не из тех же функций.
 *
 * Запуск: node scripts/test-mark-words.mjs
 */
import { readFileSync } from 'node:fs'
import { markWords, paragraphs } from '../src/features/teacher/materials/markWords.ts'
import { inText, irregularFromEnglish, irregularFromSpanish } from '../src/lib/wordForms.ts'
import { irregularGroups } from '../src/data/english/irregular.ts'

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

// 5. начальная форма и разрывы (Ф2.25, журнал п.76 (8)): слово «есть в тексте»,
//    если стоит в любой своей форме, а фраза — с чужими словами между
const EN_IRR = irregularFromEnglish(irregularGroups)
check('«missed her flight» ⇒ miss a flight', eq(hits('Dana missed her flight again.', ['miss a flight']), ['missed her flight']))
check('took ⇒ take (неправильный глагол)', eq(markWords('She took the bus.', ['take'], 'en', EN_IRR).filter((p) => p.hit).map((p) => p.text), ['took']))
check('без справочника took — не take', eq(hits('She took the bus.', ['take']), []))
check('правила окончаний: stopped, carried, making, goes', eq(hits('He stopped, carried bags, kept making tea and goes home.', ['stop', 'carry', 'make', 'go']), ['stopped', 'carried', 'making', 'goes']))
check('фраза — по порядку: «flight … miss» не фраза', eq(hits('The flight was easy to miss.', ['miss a flight']), []))
check('разрыв больше двух слов — не фраза', eq(hits('I missed my very long and boring flight.', ['miss a flight']), []))
check('inText: picked it up ⇒ pick up', inText('She picked it up quickly.', 'pick up'))
check('inText: «gateway» — не gate', !inText('The gateway was open.', 'gate'))
const ES_IRR = irregularFromSpanish(JSON.parse(readFileSync(new URL('../src/data/spanish/conjugation_reference.json', import.meta.url), 'utf8')))
const esHits = (t, w) => markWords(t, w, 'es', ES_IRR).filter((p) => p.hit).map((p) => p.text)
check('испанский: esperó, esperamos ⇒ esperar', eq(esHits('Lucía esperó. Esperamos el tren.', ['esperar']), ['esperó', 'Esperamos']))
check('испанский: perdió el vuelo ⇒ perder un vuelo', eq(esHits('Marta perdió el vuelo.', ['perder un vuelo']), ['perdió el vuelo']))
check('испанский: fue ⇒ ir (неправильный)', eq(esHits('Ayer fue a Valencia.', ['ir']), ['fue']))

// 6. абзацы
check('абзацы по пустой строке', eq(paragraphs('One.\n\nTwo\nlines.\n \n\nThree.'), ['One.', 'Two\nlines.', 'Three.']))
check('пустой текст — ноль абзацев', eq(paragraphs('  \n\n '), []))

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
