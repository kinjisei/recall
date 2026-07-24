/**
 * Тест карты AI-задач (api/_tasks.ts) — заход 18.
 * Главный инвариант: Pro-модели (tier 'max') доступны ТОЛЬКО преподавателю.
 * Пока он держится, дыра «клиент просит самую дорогую модель» не вернётся,
 * даже если кто-то добавит новую задачу и забудет подумать о правах.
 * Запуск: node scripts/test-aitasks.mjs (Node 22+, стрип типов).
 */
import { AI_TASKS, taskSpec } from '../api/_tasks.ts'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const entries = Object.entries(AI_TASKS)

// --- главный инвариант безопасности ---
const maxTasks = entries.filter(([, s]) => s.tier === 'max')
check(
  'все Pro-задачи (max) помечены teacherOnly',
  maxTasks.length > 0 && maxTasks.every(([, s]) => s.teacherOnly === true),
  maxTasks.map(([t]) => t).join(', '),
)
check(
  'teacherOnly стоит только у Pro-задач',
  entries.filter(([, s]) => s.teacherOnly).every(([, s]) => s.tier === 'max'),
)

// --- согласованность уровня и кармана квоты ---
check(
  'lite-задачи списываются из light-кармана',
  entries.filter(([, s]) => s.tier === 'lite').every(([, s]) => s.quota === 'light'),
)
check(
  'standard/max списываются из heavy-кармана («AI-действия» тарифов)',
  entries.filter(([, s]) => s.tier !== 'lite').every(([, s]) => s.quota === 'heavy'),
)
check(
  'ни одна задача не списывается из speech-кармана (он у /api/transcribe)',
  entries.every(([, s]) => s.quota !== 'speech'),
)

// --- полнота: задачи всех вызовов chat() на месте ---
const expected = [
  'word', 'definition', 'batch',
  'dialog', 'writing', 'quest', 'review',
  'material', 'program',
]
check(
  'карта покрывает все типы задач клиента',
  expected.every((t) => AI_TASKS[t]),
  `${entries.length} шт.`,
)

// --- taskSpec не пускает чужое ---
check('taskSpec: известная задача', taskSpec('dialog')?.tier === 'standard')
check('taskSpec: выдуманное имя → undefined', taskSpec('superpro') === undefined)
check(
  'taskSpec: не ведётся на прототип объекта',
  ['__proto__', 'constructor', 'toString', 'hasOwnProperty'].every(
    (k) => taskSpec(k) === undefined,
  ),
)
check(
  'taskSpec: не-строка → undefined',
  [undefined, null, 42, {}, ['dialog']].every((v) => taskSpec(v) === undefined),
)

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} проверок прошло`)
process.exit(failed ? 1 : 0)
