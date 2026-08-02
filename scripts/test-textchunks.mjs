/**
 * Мини-тест резки текста (lib/textChunks): части ~200 слов, предложения не рвём.
 * Запуск: node scripts/test-textchunks.mjs (Node 22+, стрип типов).
 */
import { splitChunks, estimateCost, mostCommon } from '../src/lib/textChunks.ts'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const wc = (s) => (s.match(/\S+/g) ?? []).length

// 1) короткий текст → одна часть
const short = 'The cat sat on the mat. It was warm.'
check('короткий текст → 1 часть', splitChunks(short).length === 1)
check('оценка стоимости короткого = 2 (1 часть + синтез)', estimateCost(short) === 2)

// 2) длинный текст (~300 слов) → несколько частей, каждая ≤ ~230 слов
const sentence = 'The quick brown fox jumps over the lazy dog while the sun slowly sets behind the tall green hills nearby. '
const long = sentence.repeat(15) // ~20 слов × 15 = ~300 слов
const chunks = splitChunks(long, 200)
check('длинный текст → 2+ части', chunks.length >= 2, `частей: ${chunks.length}`)
check('каждая часть ≤ 230 слов', chunks.every((c) => wc(c) <= 230), `слова: ${chunks.map(wc)}`)
// предложения не разорваны: каждая часть (кроме, возможно, последней) кончается на .!?…
check(
  'части кончаются на границе предложения',
  chunks.every((c) => /[.!?…]$/.test(c.trim())),
)
// объединение частей содержит все слова (ничего не потеряли)
check('слова не потеряны', wc(chunks.join(' ')) === wc(long))

// 3) текст без пунктуации → одна часть (весь текст)
const noPunct = 'word '.repeat(50).trim()
check('без пунктуации → 1 часть', splitChunks(noPunct).length === 1)

// 4) пустой → 0 частей, стоимость 1
check('пустой текст → 0 частей', splitChunks('   ').length === 0)

// 5) mostCommon
check('mostCommon уровень', mostCommon(['A2', 'B1', 'B1', '']) === 'B1')

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} ${passed === results.length ? '✅' : '❌'}`)
process.exit(passed === results.length ? 0 : 1)
