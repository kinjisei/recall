/**
 * Мини-тест единой логики балла работ (src/lib/assignmentScore.ts):
 * особенно случай переназначенного материала — балл берётся из последней
 * завершённой попытки в attempts[], а не теряется.
 * Запуск: node scripts/test-assignment-score.mjs (Node 22+, стрип типов).
 */
import { finalScore } from '../src/lib/assignmentScore.ts'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const base = {
  id: 'x', material_id: 'm', student_id: 's', status: 'assigned',
  answers: null, auto_score: null, auto_total: null, ai_review: null,
  teacher_review: null, submitted_at: null, reviewed_at: null,
  attempts: null, note: null, created_at: '',
}

// 1. свежая сданная работа: авто-балл
let s = finalScore({ ...base, status: 'submitted', auto_score: 7, auto_total: 10,
  answers: [{ index: 0, given: 'a', auto_ok: true }, { index: 1, given: 'b', auto_ok: false }] })
check('авто-балл текущей попытки', s.percent === 70 && !s.fromAttempt)
check('вердикты из текущей попытки', s.verdicts.get(0) === true && s.verdicts.get(1) === false)

// 2. вердикт учителя приоритетнее авто
s = finalScore({ ...base, status: 'reviewed', auto_score: 7, auto_total: 10,
  answers: [{ index: 0, given: 'a', auto_ok: false }],
  teacher_review: [{ index: 0, ok: true, comment: '' }, { index: 1, ok: true, comment: '' }] })
check('teacher_review приоритетнее авто', s.percent === 100 && !s.fromAttempt)
check('учитель перекрывает авто-вердикт', s.verdicts.get(0) === true)

// 3. ПЕРЕНАЗНАЧЕННАЯ работа: текущая пустая, балл — из последней попытки
s = finalScore({ ...base, attempts: [
  { answers: [{ index: 0, given: 'a', auto_ok: true }], auto_score: 5, auto_total: 10,
    teacher_review: null, submitted_at: '2026-07-01', reviewed_at: null, note: null },
  { answers: [{ index: 0, given: 'b', auto_ok: false }], auto_score: 8, auto_total: 10,
    teacher_review: [{ index: 0, ok: true, comment: '' }], submitted_at: '2026-07-10',
    reviewed_at: '2026-07-11', note: null },
] })
check('переназначенная: балл из ПОСЛЕДНЕЙ попытки', s.percent === 100 && s.fromAttempt,
  `percent=${s.percent} fromAttempt=${s.fromAttempt}`)

// 4. переназначенная, попытка без teacher_review → авто той попытки
s = finalScore({ ...base, attempts: [
  { answers: [{ index: 0, given: 'a', auto_ok: true }], auto_score: 6, auto_total: 10,
    teacher_review: null, submitted_at: '2026-07-05', reviewed_at: null, note: null },
] })
check('переназначенная: авто-балл попытки', s.percent === 60 && s.fromAttempt)

// 5. вообще не сдавалась (и попыток нет) → null
s = finalScore({ ...base })
check('не сдано: percent null', s.percent === null && !s.fromAttempt)

// 6. незавершённый снапшот (без submitted_at) не считается
s = finalScore({ ...base, attempts: [
  { answers: null, auto_score: null, auto_total: null, teacher_review: null,
    submitted_at: null, reviewed_at: null, note: 'пусто' },
] })
check('незавершённая попытка игнорируется', s.percent === null)

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
