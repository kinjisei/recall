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

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
