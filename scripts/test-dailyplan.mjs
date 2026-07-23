/**
 * Мини-тест плана дня (lib/dailyPlanCore): умный дефолт из 3 пунктов,
 * приоритет задание > квест > ротация, настройка учителя, «идеальный день».
 * Запуск: node scripts/test-dailyplan.mjs (Node 22+, стрип типов).
 */
import { buildTodayPlan, isPerfectDay } from '../src/lib/dailyPlanCore.ts'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const keys = (p) => p.map((i) => i.key).join(',')

// дефолт без заданий: слова + 2 ротируемых, всего 3
let p = buildTodayPlan(null, { pendingAssignments: 0, activeQuests: 0, weekday: 0 })
check('дефолт: 3 пункта, слова первыми', p.length === 3 && p[0].key === 'words', keys(p))

// дефолт с несданным заданием: задание вторым
p = buildTodayPlan(null, { pendingAssignments: 2, activeQuests: 1, weekday: 0 })
check('задание приоритетнее квеста', p[1].key === 'assignment', keys(p))

// без задания, но с квестом: квест вторым
p = buildTodayPlan(null, { pendingAssignments: 0, activeQuests: 1, weekday: 3 })
check('квест вторым при отсутствии заданий', p[1].key === 'quest', keys(p))

// ротация меняется по дням недели
const a = keys(buildTodayPlan(null, { pendingAssignments: 0, activeQuests: 0, weekday: 1 }))
const b = keys(buildTodayPlan(null, { pendingAssignments: 0, activeQuests: 0, weekday: 2 }))
check('ротация зависит от дня недели', a !== b, `${a} vs ${b}`)

// настройка учителя: слова + выбранное, авто-задание подмешивается
p = buildTodayPlan(
  { kinds: ['reader', 'conversation'], auto: true },
  { pendingAssignments: 1, activeQuests: 0, weekday: 0 },
)
check(
  'план учителя: слова+задание+чтение+диалог (≤4)',
  keys(p) === 'words,assignment,reader,conversation',
  keys(p),
)

// auto=false — задание не подмешивается
p = buildTodayPlan(
  { kinds: ['reader'], auto: false },
  { pendingAssignments: 5, activeQuests: 2, weekday: 0 },
)
check('auto=false: без заданий/квестов', keys(p) === 'words,reader', keys(p))

// идеальный день: все пункты закрыты типами активности
p = buildTodayPlan(null, { pendingAssignments: 0, activeQuests: 0, weekday: 0 })
const allTypes = new Set(p.flatMap((i) => i.types))
check('идеальный день при всех типах', isPerfectDay(p, allTypes))
check('не идеальный при одном типе', !isPerfectDay(p, new Set(['flashcards'])))

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
