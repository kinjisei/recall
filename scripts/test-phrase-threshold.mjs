/**
 * Мини-тест порога кнопки «Разбор предложения» (lib/phraseThreshold).
 * Токенизация — как в TappableText: text.split(/([\s—–…]+)/).
 * Запуск: node scripts/test-phrase-threshold.mjs (Node 22+, стрип типов).
 */
import { shouldOfferAnalysis } from '../src/lib/phraseThreshold.ts'

const tok = (t) => t.split(/([\s—–…]+)/)
const results = []
const check = (name, got, want) => {
  const ok = got === want
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name} — got ${got}, want ${want}`)
}

// "Please look up the word now."  индексы слов: 0 Please,2 look,4 up,6 the,8 word,10 now.
const t1 = tok('Please look up the word now.')
check('2 слова (look up) → нет кнопки', shouldOfferAnalysis(t1, 2, 4), false)
check('4 слова (look up the word) → нет', shouldOfferAnalysis(t1, 2, 8), false)
check('5 слов → есть', shouldOfferAnalysis(t1, 2, 10), true)
check('3 слова но до точки (the word now.) → есть', shouldOfferAnalysis(t1, 6, 10), true)

// "Mr. Smith is here."  0 Mr.,2 Smith,4 is,6 here.
const t2 = tok('Mr. Smith is here.')
check('Mr. Smith (2 слова, послед. без точки) → нет', shouldOfferAnalysis(t2, 0, 2), false)
check('is here. (конец предложения) → есть', shouldOfferAnalysis(t2, 4, 6), true)

// сокращение как последнее слово: "see etc."
const t3 = tok('see etc.')
check('see etc. (сокращение в конце) → нет', shouldOfferAnalysis(t3, 0, 2), false)

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} ${passed === results.length ? '✅' : '❌'}`)
process.exit(passed === results.length ? 0 : 1)
