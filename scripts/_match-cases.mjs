/**
 * Случаи счёта работы по материалу в баллах (Ф2.25-1, журнал п.76 (8)) —
 * ОДНИ на клиент и сервер: `test-match-score.mjs` гоняет их через
 * `workScore` (src/lib/assignmentScore.ts), `check-material-match.mjs` — через
 * `submit_material` тестовой базы. Разойдутся — ученик увидит «верно», а балл
 * не начислится (урок «Сверка ответа продублирована», корневой CLAUDE.md).
 *
 * У каждого случая: упражнения материала, ответы ученика (как их шлёт экран:
 * `given`, `auto_ok`, у пар — `pairs`) и ожидаемый счёт `{ got, of }`.
 * `auto_ok` у выбора, вписывания и сборки — то, что посчитал бы экран:
 * сервер пересчитает его из `given`, и счёт обязан совпасть.
 */

const AIRPORT = {
  kind: 'vocab',
  type: 'match',
  format: 'translation',
  prompt: 'Соедини слово и перевод',
  pairs: [
    { left: 'delay', right: 'задержка' },
    { left: 'gate', right: 'выход на посадку' },
    { left: 'boarding pass', right: 'посадочный талон' },
    { left: 'luggage', right: 'багаж' },
  ],
  extra: ['опоздать на рейс'],
}
const MCQ = { kind: 'comprehension', type: 'mcq', prompt: 'Why did Dana wait?', options: ['Her flight had a delay.', 'She lost her bag.'], answer: 0 }
const TFNG = { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana came to the airport late.', options: ['True', 'False'], answer: 1 }
const FILL = { kind: 'grammar', type: 'fill', prompt: 'She ___ (wait) for three hours.', answer: 'waited' }
const ORDER = { kind: 'grammar', type: 'order', prompt: 'Её рейс задержали', words: ['flight', 'Her', 'delayed', 'was'], answer: ['Her', 'flight', 'was', 'delayed'] }

const pairsAnswer = (index, pairs) => ({
  index,
  given: AIRPORT.pairs.map((p, i) => `${p.left} → ${pairs[i] ?? ''}`).join('; '),
  auto_ok: false,
  pairs,
})

export const MATCH_CASES = [
  {
    name: '3 из 4 пар — 3 балла (u5-2)',
    exercises: [AIRPORT],
    answers: [pairsAnswer(0, ['опоздать на рейс', 'выход на посадку', 'посадочный талон', 'багаж'])],
    expect: { got: 3, of: 4 },
  },
  {
    name: 'все пары верны — 4 из 4',
    exercises: [AIRPORT],
    answers: [{ ...pairsAnswer(0, ['задержка', 'выход на посадку', 'посадочный талон', 'багаж']), auto_ok: true }],
    expect: { got: 4, of: 4 },
  },
  {
    name: 'регистр, пробелы по краям и внутри — та же пара',
    exercises: [AIRPORT],
    answers: [pairsAnswer(0, ['  Задержка ', 'выход  на посадку', 'ПОСАДОЧНЫЙ ТАЛОН', 'багаж'])],
    expect: { got: 4, of: 4 },
  },
  {
    name: '«й» ≠ «и»: сверка выбора не снимает знак с кириллицы',
    exercises: [AIRPORT],
    answers: [pairsAnswer(0, ['задержка', 'выход на посадку', 'посадочныи талон', 'багаж'])],
    expect: { got: 3, of: 4 },
  },
  {
    name: 'не соединено два слова — 2 балла, пустое не засчитано',
    exercises: [AIRPORT],
    answers: [pairsAnswer(0, ['задержка', '', 'посадочный талон'])],
    expect: { got: 2, of: 4 },
  },
  {
    name: 'пары не массивом — 0, итог по числу пар',
    exercises: [AIRPORT],
    answers: [{ index: 0, given: 'delay → задержка', auto_ok: true, pairs: 'задержка' }],
    expect: { got: 0, of: 4 },
  },
  {
    name: 'ответа на пары нет вовсе — 0 из 4',
    exercises: [AIRPORT],
    answers: [],
    expect: { got: 0, of: 4 },
  },
  {
    name: 'работа целиком: выбор, «Верно / Неверно», пары, вписать, собрать — 6 из 9',
    exercises: [MCQ, MCQ, TFNG, AIRPORT, FILL, ORDER],
    answers: [
      { index: 0, given: 'Her flight had a delay.', auto_ok: true },
      { index: 1, given: 'She lost her bag.', auto_ok: false },
      { index: 2, given: 'True', auto_ok: false },
      pairsAnswer(3, ['задержка', 'выход на посадку', 'посадочный талон', 'опоздать на рейс']),
      { index: 4, given: 'Waited.', auto_ok: true },
      { index: 5, given: 'Her flight was delayed', auto_ok: true },
    ],
    expect: { got: 6, of: 9 },
  },
  {
    name: 'пары не на своём месте в списке ответов — сверка по index',
    exercises: [MCQ, AIRPORT],
    answers: [pairsAnswer(1, ['задержка', 'выход на посадку', 'посадочный талон', 'багаж']), { index: 0, given: 'Her flight had a delay.', auto_ok: true }],
    expect: { got: 5, of: 5 },
  },
]
