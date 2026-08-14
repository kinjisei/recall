/**
 * Строка ученика: подписи, порядок и регулярность (src/lib/studentSignals.ts).
 *
 * Зачем отдельным тестом. Список учеников — единственный экран, где
 * преподаватель решает, кем заняться. Ошибка здесь не выглядит ошибкой: список
 * просто показывает не тех первыми, и пропавший ученик остаётся внизу ещё на
 * неделю. Проверяем правила прямо, а не через интерфейс.
 *
 * ⚠️ И главное: числа строки обязаны совпадать с карточкой. Счёт «3 из 5»
 * берётся из homeworkProgress — той же функции, что рисует карточку и экран
 * ученика. Тест на группу «на выбор» это фиксирует: сервер отдаёт ЧЕТЫРЕ
 * пункта, а человеку надо сделать ТРИ, и обе стороны обязаны сказать «3».
 *
 * Запуск: node scripts/test-student-signals.mjs
 */
import {
  byAttention,
  isLost,
  needAttention,
  studentSignal,
} from '../src/lib/studentSignals.ts'
import { activeDaysIn, localDay, regularityLabel } from '../src/lib/activityDays.ts'
import { dueLabel, homeworkProgress } from '../src/lib/homeworkView.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

/** Ученик с нужными признаками. */
const student = (name, { daysSince = 0, active = 7 } = {}) => ({
  profile: { id: name, display_name: name },
  streak: 0,
  doneToday: daysSince === 0,
  weekItems: 0,
  daysSinceActive: daysSince,
  assignedDeckIds: [],
  activeDays7: active,
  seat: false,
})

/** Домашка: массив пунктов вида [done?, pickGroup?]. */
const hw = (items, dueInDays = 3) => ({
  id: 'hw',
  lang: 'en',
  due_at: new Date(Date.now() + dueInDays * 86400000).toISOString(),
  note: null,
  created_at: new Date().toISOString(),
  items: items.map((it, i) => ({
    id: `i${i}`,
    kind: it.kind ?? 'free',
    ref_id: null,
    title: `Пункт ${i}`,
    target: 1,
    progress: it.done ? 1 : 0,
    done_at: it.done ? new Date().toISOString() : null,
    done_by: it.done ? 'server' : null,
    pick_group: it.group ?? null,
    chosen_at: it.chosen ? new Date().toISOString() : null,
  })),
})

// ---------------------------------------------------------------------------
console.log('\n— регулярность —')

const days = [localDay(0), localDay(-1), localDay(-3), localDay(-6), localDay(-20)]
check('считаем только последнюю неделю', activeDaysIn(days, 7) === 4, `${activeDaysIn(days, 7)}`)
check('повторный день не удваивается', activeDaysIn([localDay(0), localDay(0)], 7) === 1)
check('пустая история — ноль', activeDaysIn([], 7) === 0)
check('подпись «5 из 7»', regularityLabel(5) === '5 из 7', regularityLabel(5))

console.log('\n— пропал ли ученик —')
check('не заходил 7 дней — пропал', isLost(student('a', { daysSince: 7 })))
check('не заходил 6 дней — ещё нет', !isLost(student('a', { daysSince: 6 })))
check('ни разу не занимался — пропал', isLost({ ...student('a'), daysSinceActive: null }))

// ---------------------------------------------------------------------------
console.log('\n— что показывает строка —')

const noHw = studentSignal(student('a'), null)
check('домашки нет — счёта нет', noHw.homeworkText === null && noHw.dueText === null)

const started = studentSignal(student('a'), hw([{ done: true }, {}, {}]))
check('частично сделано → «1 из 3»', started.homeworkText === '1 из 3', started.homeworkText)
check('срок днём недели', /^до |^сегодня|^до завтра/.test(started.dueText ?? ''), started.dueText)

const fresh = studentSignal(student('a'), hw([{}, {}]))
check('ничего не тронуто → «не начал»', fresh.homeworkText === 'не начал', fresh.homeworkText)

const complete = studentSignal(student('a'), hw([{ done: true }, { done: true }]))
check('всё сделано → так и написано', complete.homeworkText === 'домашка сделана')

const late = studentSignal(student('a'), hw([{}, {}], -2))
check('срок вышел → «просрочена»', late.dueText === 'просрочена', late.dueText)
check('и это помечено как просрочка', late.overdue)

// ⚠️ Просрочка МЕНЬШЕ суток. Здесь и была ошибка: срок округлялся до дней через
// Math.ceil, а Math.ceil(-0.5) даёт -0 и проверку «< 0» не проходит — подпись
// говорила «сегодня», хотя isOverdue уже считал домашку просроченной, и ученик
// стоял первым в списке как просрочивший. Два места об одном и том же
// расходились; поймано живым смоуком.
const justLate = {
  ...hw([{}, {}]),
  due_at: new Date(Date.now() - 12 * 3600_000).toISOString(),
}
const justLateSignal = studentSignal(student('a'), justLate)
check(
  'просрочка меньше суток — тоже «просрочена», а не «сегодня»',
  justLateSignal.dueText === 'просрочена',
  justLateSignal.dueText,
)
check('и подпись согласна с флагом просрочки', justLateSignal.overdue)
check(
  'полная подпись срока тоже не врёт',
  dueLabel(justLate.due_at) === 'просрочена',
  dueLabel(justLate.due_at),
)
check(
  'сутки с лишним — «просрочена на день»',
  dueLabel(new Date(Date.now() - 30 * 3600_000).toISOString()) === 'просрочена на день',
  dueLabel(new Date(Date.now() - 30 * 3600_000).toISOString()),
)

// ⚠️ Ключевая проверка «одного места»: группа «на выбор» — ОДИН пункт для
// человека, хотя в базе их два. Строка списка и карточка обязаны сказать одно.
const withPick = hw([{ done: true }, { group: 1 }, { group: 1 }, {}])
const pickSignal = studentSignal(student('a'), withPick)
check(
  'группа «на выбор» считается за один пункт',
  pickSignal.homeworkText === '1 из 3',
  pickSignal.homeworkText,
)
check(
  'и это ровно то, что покажет карточка',
  (() => {
    const p = homeworkProgress(withPick)
    return `${p.done} из ${p.total}` === pickSignal.homeworkText
  })(),
)

// ---------------------------------------------------------------------------
console.log('\n— порядок: сперва те, кому нужно внимание —')

const rows = [
  { name: 'всё хорошо', s: student('ok'), h: hw([{ done: true }]) },
  { name: 'просрочка', s: student('late'), h: hw([{}, {}], -1) },
  { name: 'не начал', s: student('idle'), h: hw([{}, {}]) },
  { name: 'пропал', s: student('lost', { daysSince: 12, active: 0 }), h: hw([{ done: true }]) },
  { name: 'начал', s: student('mid'), h: hw([{ done: true }, {}]) },
]
const order = byAttention(rows, (r) => studentSignal(r.s, r.h)).map((r) => r.name)
check(
  'порядок: просрочка → пропал → не начал → начал → всё хорошо',
  order.join(' → ') === 'просрочка → пропал → не начал → начал → всё хорошо',
  order.join(' → '),
)

// Устойчивость: внутри одной группы порядок исходный, иначе список
// перескакивает между открытиями и человека приходится искать заново.
const same = [
  { name: 'первый', s: student('a'), h: hw([{}]) },
  { name: 'второй', s: student('b'), h: hw([{}]) },
  { name: 'третий', s: student('c'), h: hw([{}]) },
]
check(
  'внутри группы порядок не перемешивается',
  byAttention(same, (r) => studentSignal(r.s, r.h)).map((r) => r.name).join(',') ===
    'первый,второй,третий',
)

check(
  'счётчик «нужно внимание» считает просрочку и пропавших',
  needAttention(rows.map((r) => studentSignal(r.s, r.h))) === 2,
  `${needAttention(rows.map((r) => studentSignal(r.s, r.h)))}`,
)

// ⚠️ Ученик БЕЗ домашки, но пропавший, тоже должен попасть наверх: домашки
// может не быть вовсе, а человек уже две недели не заходит.
const lostNoHw = studentSignal(student('x', { daysSince: 14, active: 0 }), null)
check('пропавший без домашки тоже требует внимания', lostNoHw.attention === 'lost')
check('а занимающийся без домашки — нет', studentSignal(student('y'), null).attention === 'ok')

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
