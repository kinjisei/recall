/**
 * Расписание — правила без базы (PLAN.md Ф2.6; src/domains/schedule/model.ts):
 *
 *   • копии = миграция 0009: окно уроков (schedule_horizon_days), длительность
 *     15–480, типы, статусы, списания и отметки — по ограничениям и коду SQL;
 *   • у каждого кода RECALL_*, который бросает 0009, есть текст для человека
 *     (shared/api/errors.ts): иначе ученик и учитель увидят общий текст;
 *   • дни серии: «вт и чт» и шаг 2 недели на явных датах, рубеж года, начало
 *     серии в середине недели, конец включительно;
 *   • строки «урок × участник» собираются в уроки; отметка ↔ (был, списание);
 *     какие отметки можно поставить до и после начала, пробному — без списаний;
 *   • фаза урока: впереди, идёт, не отмечен, проведён, отменён.
 * Чистый: без сети и базы. Серию против самой базы сверяет check-schedule.mjs.
 * Запуск: node scripts/test-schedule.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addDays,
  allowedOutcomes,
  almatyDay,
  CHARGES,
  groupSchedule,
  HORIZON_DAYS,
  isCharged,
  isoWeekday,
  isSeriesSlot,
  LESSON_KINDS,
  LESSON_STATUSES,
  lessonPhase,
  MINUTES_MAX,
  MINUTES_MIN,
  OUTCOMES,
  outcomeOf,
  SERIES_KINDS,
  seriesDays,
} from '../src/domains/schedule/model.ts'

let ok = 0
let failed = 0
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : ` — получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`}`)
  pass ? ok++ : failed++
}

// ── копии = миграция 0009 ─────────────────────────────────────────────────────────
const root = join(import.meta.dirname, '..')
const sql = readFileSync(join(root, 'supabase/migrations/0009_schedule.sql'), 'utf8').replace(/\r\n/g, '\n')
const listIn = (re) => {
  const m = sql.match(re)
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : null
}
const horizon = sql.match(/function public\.schedule_horizon_days\(\)[\s\S]*?select (\d+) \$fn\$/)
check('HORIZON_DAYS = schedule_horizon_days()', Number(horizon?.[1]), HORIZON_DAYS)
check('длительность 15–480 = ограничение серии', sql.match(/minutes int not null check \(minutes between (\d+) and (\d+)\)/)?.slice(1).map(Number), [MINUTES_MIN, MINUTES_MAX])
check('типы урока = ограничение lessons', listIn(/kind text not null check \(kind in \(('individual', 'group', 'trial')\)\)/), [...LESSON_KINDS])
check('типы серии = ограничение lesson_series', listIn(/kind text not null check \(kind in \(('individual', 'group')\)\)/), [...SERIES_KINDS])
check('статусы = ограничение lessons', listIn(/status text not null default 'planned' check \(status in \(([^)]*)\)\)/), [...LESSON_STATUSES])
check('списания = ограничение lesson_participants', listIn(/charge text check \(charge in \(([^)]*)\)\)/), [...CHARGES])
check('отметки = mark_lesson_participant', listIn(/p_outcome not in \(([^)]*)\)/), [...OUTCOMES])
check('списывают «списан» и «поздняя отмена» = card_lesson_balance', listIn(/where card_id = p_card and charge in \(([^)]*)\)/), CHARGES.filter(isCharged))

const errorsTs = readFileSync(join(root, 'src/shared/api/errors.ts'), 'utf8')
const raised = [...new Set([...sql.matchAll(/raise exception '(RECALL_[A-Z_]+)'/g)].map((m) => m[1]))].sort()
check(
  'у каждого кода RECALL_* из 0009 есть текст для человека',
  raised.filter((c) => !new RegExp(`\\b${c}:`).test(errorsTs)),
  [],
)
check('коды из 0009 найдены (тест не пустой)', raised.length >= 15, true)

// ── дни серии ──────────────────────────────────────────────────────────────────────
check('2026-10-05 — понедельник, 2026-10-11 — воскресенье', [isoWeekday('2026-10-05'), isoWeekday('2026-10-11')], [1, 7])
check('addDays через рубеж года', addDays('2026-12-30', 3), '2027-01-02')
check('день по Алматы: 19:30 UTC — уже завтра', almatyDay(new Date('2026-10-05T19:30:00Z')), '2026-10-06')

const tueThu = { weekdays: [2, 4], everyWeeks: 1, startsOn: '2026-10-05', endsOn: '2026-11-01' }
check('вт и чт 4 недели — 8 уроков на нужные даты', seriesDays(tueThu, '2026-10-01', '2026-11-30'), [
  '2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29',
])
const biweekly = { weekdays: [1, 3], everyWeeks: 2, startsOn: '2026-10-05', endsOn: '2026-11-01' }
check('пн и ср через неделю — 1-я и 3-я недели', seriesDays(biweekly, '2026-10-05', '2026-11-01'), [
  '2026-10-05', '2026-10-07', '2026-10-19', '2026-10-21',
])
// начало в четверг: неделя начала — «своя», вторник той же недели — до начала
const midWeek = { weekdays: [2, 4], everyWeeks: 2, startsOn: '2026-10-08', endsOn: null }
check('начало в середине недели, шаг 2: счёт от понедельника недели начала', seriesDays(midWeek, '2026-10-05', '2026-10-31'), [
  '2026-10-08', '2026-10-20', '2026-10-22',
])
check('конец включительно, начало включительно', [
  isSeriesSlot({ weekdays: [7], everyWeeks: 1, startsOn: '2026-10-11', endsOn: '2026-10-18' }, '2026-10-11'),
  isSeriesSlot({ weekdays: [7], everyWeeks: 1, startsOn: '2026-10-11', endsOn: '2026-10-18' }, '2026-10-18'),
  isSeriesSlot({ weekdays: [7], everyWeeks: 1, startsOn: '2026-10-11', endsOn: '2026-10-18' }, '2026-10-25'),
], [true, true, false])
check('без конца — через рубеж года шаг держится', seriesDays({ weekdays: [4], everyWeeks: 2, startsOn: '2026-12-24', endsOn: null }, '2026-12-20', '2027-01-25'), [
  '2026-12-24', '2027-01-07', '2027-01-21',
])

// ── сборка ответа и отметки ──────────────────────────────────────────────────────────
const base = { seriesId: null, seriesDate: null, kind: 'group', status: 'planned', startsAt: '2026-10-06T14:00:00Z', endsAt: '2026-10-06T15:00:00Z', title: 'B1', link: null, movedFrom: null, version: 1, settled: false }
const p = (cardId, extra = {}) => ({ cardId, name: cardId, cardStatus: 'active', trial: false, attended: null, charge: null, chargeAuto: false, ...extra })
const lessons = groupSchedule([
  { ...base, lessonId: 'L1', participant: p('a') },
  { ...base, lessonId: 'L1', participant: p('b') },
  { ...base, lessonId: 'L2', kind: 'individual', title: null, participant: p('c') },
  { ...base, lessonId: 'L3', participant: null },
])
check('строки → уроки по порядку, участники при своём уроке', lessons.map((l) => [l.id, l.participants.map((x) => x.cardId)]), [
  ['L1', ['a', 'b']], ['L2', ['c']], ['L3', []],
])

check('отметка ↔ (был, списание)', [
  outcomeOf({ attended: null, charge: null, trial: false }),
  outcomeOf({ attended: true, charge: 'charged', trial: false }),
  outcomeOf({ attended: true, charge: 'not_charged', trial: false }),
  outcomeOf({ attended: true, charge: 'not_charged', trial: true }),
  outcomeOf({ attended: false, charge: 'not_charged', trial: false }),
  outcomeOf({ attended: false, charge: 'late_cancel', trial: false }),
], [null, 'present', 'present_free', 'present', 'absent', 'late_cancel'])

const before = new Date('2026-10-06T13:00:00Z')
const after = new Date('2026-10-06T16:00:00Z')
check('до начала — только «не был» и «поздняя отмена»', allowedOutcomes(base, { trial: false }, before), ['absent', 'late_cancel'])
check('после начала — все четыре', allowedOutcomes(base, { trial: false }, after), [...OUTCOMES])
check('пробному — без списаний', allowedOutcomes(base, { trial: true }, after), ['present', 'absent'])
check('отменённый — ничего', allowedOutcomes({ ...base, status: 'cancelled' }, { trial: false }, after), [])

check('фаза урока', [
  lessonPhase(base, before),
  lessonPhase(base, new Date('2026-10-06T14:30:00Z')),
  lessonPhase(base, after),
  lessonPhase({ ...base, status: 'done' }, after),
  lessonPhase({ ...base, status: 'cancelled' }, before),
], ['upcoming', 'live', 'unmarked', 'done', 'cancelled'])

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
