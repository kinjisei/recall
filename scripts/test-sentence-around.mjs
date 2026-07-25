/**
 * Тест sentenceAround (WordSheet): контекст берётся у тапнутого вхождения,
 * а не у первого в тексте, и подстрока чужого слова не матчит.
 * Функция чистая, но живёт в .tsx с React-импортами — дублируем её здесь
 * один-в-один (при правке функции синхронизировать).
 * Запуск: node scripts/test-sentence-around.mjs
 */
function sentenceAt(text, at) {
  const isEnd = (c) => c === '.' || c === '!' || c === '?' || c === '…'
  let start = Math.max(0, Math.min(at, text.length - 1))
  while (start > 0 && !isEnd(text[start - 1])) start--
  let end = Math.max(start, at)
  while (end < text.length && !isEnd(text[end])) end++
  if (end < text.length) end++
  return text.slice(start, end).trim().slice(0, 300)
}
function sentenceAround(text, word, at) {
  if (typeof at === 'number') return sentenceAt(text, at)
  const sentences = text.split(/(?<=[.!?…])\s+/)
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const whole = new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, 'iu')
  const found = sentences.find((s) => whole.test(s))
  return (found ?? text).trim().slice(0, 300)
}

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// --- позиционный контекст: слово встречается дважды ---
const t1 = 'I will call you. The will was signed yesterday.'
const at1 = t1.indexOf('will', 20) // второе вхождение (в «The will was…»)
check(
  'контекст берётся у тапнутого (второго) вхождения',
  sentenceAround(t1, 'will', at1) === 'The will was signed yesterday.',
  sentenceAround(t1, 'will', at1),
)
const at0 = t1.indexOf('will') // первое вхождение
check(
  'контекст первого вхождения — первое предложение',
  sentenceAround(t1, 'will', at0) === 'I will call you.',
  sentenceAround(t1, 'will', at0),
)

// --- подстрока чужого слова не матчит (fallback без at) ---
const t2 = 'He started running. I like art very much.'
check(
  'fallback: «art» не матчит «started», берёт своё предложение',
  sentenceAround(t2, 'art') === 'I like art very much.',
  sentenceAround(t2, 'art'),
)

// --- одно предложение, слова нет как отдельного — fallback на весь текст ---
const t3 = 'This is a short note.'
check('fallback: слово есть — своё предложение', sentenceAround(t3, 'note') === 'This is a short note.')
check(
  'fallback: слова-подстроки нет как целого — весь текст',
  sentenceAround(t3, 'not') === 'This is a short note.',
  '(«not» есть только внутри «note» → берём весь текст',
)

// --- граница текста и обрезка 300 ---
const t4 = 'Ok. ' + 'a'.repeat(400) + '.'
check('обрезка до 300 символов', sentenceAt(t4, 10).length <= 300)

// --- многоточие как конец предложения ---
const t5 = 'Wait… Then what happened next?'
const at5 = t5.indexOf('what')
check('многоточие — граница предложения', sentenceAround(t5, 'what', at5) === 'Then what happened next?', sentenceAround(t5, 'what', at5))

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} проверок прошло`)
process.exit(failed ? 1 : 0)
