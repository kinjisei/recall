/**
 * Мини-тест плана дня (lib/dailyPlanCore): умный дефолт из 3 пунктов,
 * приоритет задание > квест > ротация, настройка учителя, «идеальный день»;
 * шаги «Начать занятие» и подпись под кнопкой — из плана (журнал п.76 (10)).
 * Запуск: node scripts/test-dailyplan.mjs (Node 22+, стрип типов).
 */
import { buildTodayPlan, isPerfectDay, sessionCaption, sessionSteps } from '../src/lib/dailyPlanCore.ts'

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

// квест НЕ закрывается грамматикой (иначе «идеальный день» завышался)
const withQuest = buildTodayPlan(null, { pendingAssignments: 0, activeQuests: 1, weekday: 3 })
const questItem = withQuest.find((i) => i.key === 'quest')
check('пункт «квест» закрывается типом quest, не grammar', questItem?.types.join() === 'quest', questItem?.types.join())
check(
  'урок грамматики НЕ помечает квест выполненным',
  !isPerfectDay(withQuest, new Set(['flashcards', 'reader', 'grammar'])),
)
check(
  'реальное прохождение квеста закрывает пункт',
  isPerfectDay(withQuest, new Set(withQuest.flatMap((i) => i.types))),
)

// «Начать занятие» идёт по плану: шаги — несделанные пункты, подпись — из них.
// Ожидания — литералами (подпись видит ученик)
const teacherPlan = buildTodayPlan({ kinds: ['grammar', 'conversation'], auto: false }, { pendingAssignments: 0, activeQuests: 0, weekday: 0 })
check('занятие по плану учителя: слова → грамматика → диалог', keys(sessionSteps(teacherPlan, new Set())) === 'words,grammar,conversation', keys(sessionSteps(teacherPlan, new Set())))
check('подпись: «~15 минут · слова → грамматика → диалог»', sessionCaption(sessionSteps(teacherPlan, new Set())) === '~15 минут · слова → грамматика → диалог', sessionCaption(sessionSteps(teacherPlan, new Set())))
check('сделанное сегодня в занятие не идёт', keys(sessionSteps(teacherPlan, new Set(['practice', 'grammar']))) === 'conversation', keys(sessionSteps(teacherPlan, new Set(['practice', 'grammar']))))
check('письмо закрывает «Диалог» — как на Главной', keys(sessionSteps(teacherPlan, new Set(['writing']))) === 'words,grammar')
check('всё сделано — занятие заново по всему плану', keys(sessionSteps(teacherPlan, new Set(['flashcards', 'grammar', 'conversation']))) === 'words,grammar,conversation')
check('повторять нечего — без шага слов', keys(sessionSteps(teacherPlan, new Set(), { noReview: true })) === 'grammar,conversation')
const withTask = buildTodayPlan(null, { pendingAssignments: 1, activeQuests: 0, weekday: 0 })
check('задание — 10 минут: «~20 минут · слова → задание → …»', /^~20 минут · слова → задание → /.test(sessionCaption(sessionSteps(withTask, new Set()))), sessionCaption(sessionSteps(withTask, new Set())))

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
