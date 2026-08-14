/**
 * Юнит-проверка отбора упражнений материала (validExercises из src/lib/materials.ts).
 *
 * Зачем отдельным файлом. Это единственный фильтр между свободным ответом
 * модели и тем, что увидит ученик. Раньше он пропускал два типа из трёх —
 * «собери предложение» отбрасывалось молча, хотя движок и сервер его считают.
 * Теперь тип включён, и появилась новая опасность: если набор слов (words) не
 * совпадает с ответом (answer), упражнение НЕВОЗМОЖНО собрать — ученик
 * перебирает слова и не может дойти до верного ответа. Такое обязано
 * отсеиваться здесь, а не обнаруживаться учеником.
 *
 * Запуск: node scripts/test-material-exercises.mjs
 */
import { validExercises } from '../src/lib/materialExercises.ts'
import {
  ATTEMPTS_BEFORE_ANSWER,
  mcqHint,
  mistakeHint,
  orderHint,
  shouldReveal,
} from '../src/lib/selfCorrect.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const mcq = { kind: 'comprehension', type: 'mcq', prompt: 'Where?', options: ['a', 'b'], answer: 1 }
const fill = { kind: 'grammar', type: 'fill', prompt: 'I ___ home', answer: 'go' }
const order = {
  kind: 'grammar',
  type: 'order',
  prompt: 'Я иду домой каждый день',
  words: ['home', 'I', 'day', 'go', 'every'],
  answer: ['I', 'go', 'home', 'every', 'day'],
}

const keep = (ex) => validExercises([ex]).length === 1

// ---- что должно проходить --------------------------------------------------
check('обычный выбор варианта проходит', keep(mcq))
check('вписывание проходит', keep(fill))
check('сборка предложения проходит', keep(order))
check(
  'порядок слов в банке не важен',
  keep({ ...order, words: ['every', 'day', 'home', 'go', 'I'] }),
)
check(
  'регистр и пробелы в банке не мешают',
  keep({ ...order, words: [' I ', 'GO', 'home', 'every', 'day'] }),
)

// ---- что должно отсеиваться ------------------------------------------------
check(
  'несобираемое: в банке лишнее слово',
  !keep({ ...order, words: [...order.words, 'quickly'] }),
)
check(
  'несобираемое: в банке не хватает слова',
  !keep({ ...order, words: ['I', 'go', 'home', 'every'] }),
)
check(
  'несобираемое: слово подменено',
  !keep({ ...order, words: ['I', 'go', 'house', 'every', 'day'] }),
)
check('пустой банк не проходит', !keep({ ...order, words: [], answer: [] }))
check(
  'слишком короткое предложение не проходит',
  !keep({ ...order, words: ['I', 'go'], answer: ['I', 'go'] }),
)
check('пустая строка среди слов не проходит', !keep({ ...order, words: ['I', 'go', '', 'every', 'day'], answer: ['I', 'go', '', 'every', 'day'] }))
check('без answer не проходит', !keep({ kind: 'grammar', type: 'order', prompt: 'x', words: ['a', 'b', 'c'] }))
check('неизвестный тип не проходит', !keep({ kind: 'grammar', type: 'match', prompt: 'x' }))
check('мусор вместо упражнения не проходит', !keep(null))

// ---- смесь: битые уходят, целые остаются ------------------------------------
const mixed = validExercises([mcq, { ...order, words: ['broken'] }, fill, order])
check('из смеси остаются только целые', mixed.length === 3, `осталось ${mixed.length}`)

// ---------------------------------------------------------------------------
// САМОКОРРЕКЦИЯ: подсказка говорит ГДЕ ошибка и НЕ выдаёт ответ.
//
// ⚠️ Главное здесь — не форма подсказки, а то, чего в ней НЕТ. Подсказка, из
// которой ответ восстанавливается, — это тот же готовый ответ, только с лишним
// нажатием, и весь смысл (найти ошибку самому) пропадает.
// ---------------------------------------------------------------------------
console.log('')
console.log('— самокоррекция: подсказка не выдаёт ответ —')

const tries = [
  ['went', 'goed'],
  ['have been', 'have was'],
  ['I go to school every day', 'I goes to school every day'],
  ['a book', 'the book'],
  ['beautiful', 'butiful'],
]
let leak = ''
for (const [answer, given] of tries) {
  const h = mistakeHint(given, answer)
  if (h.toLowerCase().includes(answer.toLowerCase())) leak = `«${h}» содержит ответ «${answer}»`
  for (const w of answer.split(' ')) {
    if (w.length > 3 && h.toLowerCase().includes(w.toLowerCase())) {
      leak = `«${h}» содержит слово ответа «${w}»`
    }
  }
}
check('подсказка не содержит ни ответа, ни его слов', leak === '', leak)
check('подсказка непустая и по-русски', tries.every(([a, g]) => /[а-яё]/i.test(mistakeHint(g, a))))
check(
  'подсказка называет место ошибки в предложении',
  /Первые 1 слово верно/.test(mistakeHint('I goes to school every day', 'I go to school every day')),
  mistakeHint('I goes to school every day', 'I go to school every day'),
)
check(
  'разное число слов — говорим сколько нужно, а не какие',
  mistakeHint('I go', 'I go to school') === 'Слов должно быть 4, у тебя 2.',
  mistakeHint('I go', 'I go to school'),
)
check(
  'одно слово: считаем совпавшие буквы',
  /Первые \d+ буквы верны/.test(mistakeHint('goed', 'going')),
  mistakeHint('goed', 'going'),
)
check('пустой ответ — отдельная подсказка', /Пустой ответ/.test(mistakeHint('', 'went')))

check(
  'порядок: сколько слов уже на месте',
  orderHint(['I', 'every', 'day', 'go'], ['I', 'go', 'every', 'day']) ===
    'Первые 1 слово на месте — дальше нет.',
  orderHint(['I', 'every', 'day', 'go'], ['I', 'go', 'every', 'day']),
)
check(
  'порядок: не хватает слов — говорим сколько',
  orderHint(['I', 'go'], ['I', 'go', 'every', 'day']) === 'Слов должно быть 4, у тебя 2.',
)
check('выбор: подсказка называет только число вариантов', mcqHint(3) === 'Не то. Осталось вариантов: 3.')

check('ответ показываем со второй попытки', ATTEMPTS_BEFORE_ANSWER === 2)
check('первая ошибка ответ НЕ показывает', !shouldReveal(1, false))
check('вторая — показывает', shouldReveal(2, false))
check('и по явной просьбе — сразу', shouldReveal(1, true))

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
