/**
 * Мини-тест единой логики балла работ (src/lib/assignmentScore.ts):
 * особенно случай переназначенного материала — балл берётся из последней
 * завершённой попытки в attempts[], а не теряется; и счёт в баллах (Ф2.25):
 * у «Соедини пары» — по паре, в том числе в разбивке по категориям.
 * Запуск: node scripts/test-assignment-score.mjs (Node 22+, стрип типов).
 */
import { finalScore } from '../src/lib/assignmentScore.ts'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// два упражнения: выбор ответа и «Соедини пары» на 4 пары — 5 баллов
const EX = [
  { kind: 'comprehension', type: 'mcq', prompt: 'Q', options: ['a', 'b'], answer: 0 },
  { kind: 'vocab', type: 'match', format: 'translation', prompt: 'P', pairs: [
    { left: 'delay', right: 'задержка' }, { left: 'gate', right: 'выход' },
    { left: 'luggage', right: 'багаж' }, { left: 'pass', right: 'талон' },
  ] },
]

const score = (a) => finalScore(a, EX)

const base = {
  id: 'x', material_id: 'm', student_id: 's', status: 'assigned',
  answers: null, auto_score: null, auto_total: null, ai_review: null,
  teacher_review: null, submitted_at: null, reviewed_at: null,
  attempts: null, note: null, created_at: '',
}

// 1. свежая сданная работа: авто-балл
let s = score({ ...base, status: 'submitted', auto_score: 7, auto_total: 10,
  answers: [{ index: 0, given: 'a', auto_ok: true }, { index: 1, given: 'b', auto_ok: false }] })
check('авто-балл текущей попытки', s.percent === 70 && !s.fromAttempt)
check('баллы по упражнениям текущей попытки', s.verdicts.get(0)?.got === 1 && s.verdicts.get(1)?.got === 0 && s.verdicts.get(1)?.of === 4)

// 2. вердикт учителя приоритетнее авто
s = score({ ...base, status: 'reviewed', auto_score: 7, auto_total: 10,
  answers: [{ index: 0, given: 'a', auto_ok: false }],
  teacher_review: [{ index: 0, ok: true, comment: '' }, { index: 1, ok: true, comment: '' }] })
check('teacher_review приоритетнее авто', s.percent === 100 && !s.fromAttempt)
check('учитель перекрывает авто-вердикт', s.verdicts.get(0)?.got === 1)

// 2б. пары в баллах: 3 из 4 пар по авто + верный выбор — 4 из 5 = 80 %
s = score({ ...base, status: 'reviewed', auto_score: 4, auto_total: 5,
  answers: [{ index: 0, given: 'a', auto_ok: true },
    { index: 1, given: '', auto_ok: false, pairs: ['талон', 'выход', 'багаж', 'задержка'] }],
  teacher_review: [{ index: 0, ok: true, comment: '' }, { index: 1, ok: false, comment: '', pairs: [false, true, true, false] }] })
check('учитель отметил 2 пары из 4 — 3 из 5 баллов', s.percent === 60, `percent=${s.percent}`)
check('в разбивке — баллы пар, а не «ошибка» упражнения', s.verdicts.get(1)?.got === 2 && s.verdicts.get(1)?.of === 4)

// 3. ПЕРЕНАЗНАЧЕННАЯ работа: текущая пустая, балл — из последней попытки
// (материал из одного упражнения — учитель отметил его целиком)
s = finalScore({ ...base, attempts: [
  { answers: [{ index: 0, given: 'a', auto_ok: true }], auto_score: 5, auto_total: 10,
    teacher_review: null, submitted_at: '2026-07-01', reviewed_at: null, note: null },
  { answers: [{ index: 0, given: 'b', auto_ok: false }], auto_score: 8, auto_total: 10,
    teacher_review: [{ index: 0, ok: true, comment: '' }], submitted_at: '2026-07-10',
    reviewed_at: '2026-07-11', note: null },
] }, EX.slice(0, 1))
check('переназначенная: балл из ПОСЛЕДНЕЙ попытки', s.percent === 100 && s.fromAttempt,
  `percent=${s.percent} fromAttempt=${s.fromAttempt}`)

// 4. переназначенная, попытка без teacher_review → авто той попытки
s = score({ ...base, attempts: [
  { answers: [{ index: 0, given: 'a', auto_ok: true }], auto_score: 6, auto_total: 10,
    teacher_review: null, submitted_at: '2026-07-05', reviewed_at: null, note: null },
] })
check('переназначенная: авто-балл попытки', s.percent === 60 && s.fromAttempt)

// 5. вообще не сдавалась (и попыток нет) → null
s = score({ ...base })
check('не сдано: percent null', s.percent === null && !s.fromAttempt)

// 6. незавершённый снапшот (без submitted_at) не считается
s = score({ ...base, attempts: [
  { answers: null, auto_score: null, auto_total: null, teacher_review: null,
    submitted_at: null, reviewed_at: null, note: 'пусто' },
] })
check('незавершённая попытка игнорируется', s.percent === null)

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
