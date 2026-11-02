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
import { normalizeExercises, validExercises } from '../src/lib/materialExercises.ts'
import { irregularFromEnglish } from '../src/lib/wordForms.ts'
import { irregularGroups } from '../src/data/english/irregular.ts'
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
check('неизвестный тип не проходит', !keep({ kind: 'grammar', type: 'essay', prompt: 'x' }))
check('мусор вместо упражнения не проходит', !keep(null))

// ---- «Соедини пары» и новые виды выбора (Ф2.25-1) ---------------------------
const match = {
  kind: 'vocab',
  type: 'match',
  format: 'translation',
  prompt: 'Соедини слово и перевод',
  pairs: [
    { left: 'delay', right: 'задержка' },
    { left: 'gate', right: 'выход на посадку' },
    { left: 'luggage', right: 'багаж' },
    { left: 'boarding pass', right: 'посадочный талон' },
  ],
  extra: ['опоздать на рейс'],
}
const pairsOf = (n) => Array.from({ length: n }, (_, i) => ({ left: `w${i}`, right: `п${i}` }))
check('пары проходят', keep(match))
check('пары с объяснением проходят', keep({ ...match, format: 'definition', extra: undefined }))
check('3 пары — нижний край', keep({ ...match, pairs: pairsOf(3), extra: [] }))
check('8 пар — верхний край', keep({ ...match, pairs: pairsOf(8), extra: [] }))
check('2 пары не проходят', !keep({ ...match, pairs: pairsOf(2), extra: [] }))
check('9 пар не проходят', !keep({ ...match, pairs: pairsOf(9), extra: [] }))
check('пустая половина пары не проходит', !keep({ ...match, pairs: [...match.pairs.slice(0, 3), { left: 'gate', right: '  ' }] }))
check('одно слово дважды слева не проходит', !keep({ ...match, pairs: [...match.pairs.slice(0, 3), { left: 'Delay', right: 'опоздание' }] }))
check('перевод дважды справа не проходит', !keep({ ...match, pairs: [...match.pairs.slice(0, 3), { left: 'wait', right: 'Задержка' }] }))
check('лишний вариант совпадает с парой — не проходит (два верных)', !keep({ ...match, extra: ['багаж'] }))
check('три лишних — не проходит', !keep({ ...match, extra: ['a', 'b', 'c'] }))
check('неизвестный вид пар не проходит', !keep({ ...match, format: 'picture' }))
const tf = { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana came late.', options: ['True', 'False'], answer: 1 }
check('«Верно / Неверно» проходит', keep(tf))
check('«Верно / Неверно / Не сказано» проходит', keep({ ...tf, options: ['True', 'False', 'Not given'], answer: 2 }))
check('«Верно / Неверно» с четырьмя кнопками не проходит', !keep({ ...tf, options: ['True', 'False', 'Not given', 'Maybe'] }))
const form = { kind: 'grammar', type: 'mcq', format: 'form', prompt: 'She ___ late.', options: ['came', 'come', 'comes'], answer: 0 }
check('«Выбери форму» из 3 проходит', keep(form))
check('«Выбери форму» из 2 не проходит', !keep({ ...form, options: ['came', 'come'] }))
check('два одинаковых варианта не проходят (сервер сверяет текст)', !keep({ ...mcq, options: ['at seven', 'At seven '] }))
check('пустой вариант не проходит', !keep({ ...mcq, options: ['a', ''] }))

// ---- приведение ответа AI к нашему виду (Ф2.25-1б) --------------------------
const BODY = 'Dana came to the airport early, but her flight had a delay. She missed her flight and took a taxi home. Her luggage was lost.'
const ctxA2 = { body: BODY, lang: 'en', level: 'A2', irregular: irregularFromEnglish(irregularGroups) }
const ctxB1 = { ...ctxA2, level: 'B1' }
const one = (e, ctx) => normalizeExercises([e], ctx)[0]
const tfAi = { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana came late.', options: ['Верно', 'Неверно'], answer: 1 }
check('«Верно / Неверно» — кнопки на языке текста: True / False', JSON.stringify(one(tfAi, ctxA2)?.options) === '["True","False"]' && one(tfAi, ctxA2)?.answer === 1)
check('ответ — по подписи, а не по месту: [False, True] и answer 1 → True', one({ ...tfAi, options: ['False', 'True'], answer: 1 }, ctxA2)?.answer === 0)
check('A2: «Not given» среди кнопок убран', one({ ...tfAi, options: ['True', 'False', 'Not given'] }, ctxA2)?.options.length === 2)
check('A2: ответ «Not given» — упражнение выброшено', normalizeExercises([{ ...tfAi, options: ['True', 'False', 'Not given'], answer: 2 }], ctxA2).length === 0)
check('B1: три кнопки', JSON.stringify(one(tfAi, ctxB1)?.options) === '["True","False","Not given"]')
check('испанский: Verdadero / Falso / No se dice', JSON.stringify(one(tfAi, { ...ctxB1, lang: 'es' })?.options) === '["Verdadero","Falso","No se dice"]')
check('непонятная подпись — выброшено', normalizeExercises([{ ...tfAi, options: ['Maybe', 'Perhaps'], answer: 0 }], ctxA2).length === 0)
const pairsAi = {
  ...match,
  pairs: [
    { left: 'delay', right: 'задержка' },
    { left: 'miss a flight', right: 'опоздать на рейс' },
    { left: 'take', right: 'взять' },
    { left: 'luggage', right: 'багаж' },
    { left: 'passport', right: 'паспорт' },
  ],
  extra: ['вокзал'],
}
check('пары: слово не из текста убрано, формы засчитаны (missed her flight, took)', JSON.stringify(one(pairsAi, ctxA2)?.pairs.map((p) => p.left)) === '["delay","miss a flight","take","luggage"]')
check('«перевод» не по-русски — выброшено', normalizeExercises([{ ...pairsAi, pairs: pairsAi.pairs.map((p) => ({ ...p, right: 'delay in English' })) }], ctxA2).length === 0)
check('«объяснение» по-русски — выброшено', normalizeExercises([{ ...pairsAi, format: 'definition' }], ctxA2).length === 0)
check('«слово по объяснению» — слово не из текста выброшено', normalizeExercises([{ kind: 'vocab', type: 'mcq', prompt: 'a document for travel', options: ['passport', 'delay', 'taxi', 'luggage'], answer: 0 }], ctxA2).length === 0)
check('«слово по объяснению» — слово из текста остаётся', normalizeExercises([{ kind: 'vocab', type: 'mcq', prompt: 'bags for a trip', options: ['luggage', 'delay', 'taxi', 'home'], answer: 0 }], ctxA2).length === 1)
check('выбор и грамматика не трогаются', normalizeExercises([mcq, fill, order], ctxA2).length === 3)

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
