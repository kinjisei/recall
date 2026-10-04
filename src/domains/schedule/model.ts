// ============================================================================
// Расписание — правила без базы (PLAN.md Ф2.6; журнал п.26–33, 43, 65).
// Решает база (миграция 0009_schedule.sql); здесь — типы, сборка ответа в
// уроки и копии правил для экрана. Копии помечены «копия»: пару сверяют
// test-schedule.mjs (по тексту миграции) и check-schedule.mjs (по базе).
// ============================================================================
import type { CardStatus } from '../students'
import { addDays, dayNumber, dayString, isoWeekday } from '../../shared/lib/days.ts'

export const LESSON_KINDS = ['individual', 'group', 'trial'] as const
export type LessonKind = (typeof LESSON_KINDS)[number]
/** Серия — только индивидуальная или групповая: пробный урок разовый. */
export const SERIES_KINDS = ['individual', 'group'] as const
export type SeriesKind = (typeof SERIES_KINDS)[number]
export const LESSON_STATUSES = ['planned', 'done', 'cancelled'] as const
export type LessonStatus = (typeof LESSON_STATUSES)[number]
/** Списание участия: «списан / не списан / поздняя отмена» (архитектура §18). */
export const CHARGES = ['charged', 'not_charged', 'late_cancel'] as const
export type Charge = (typeof CHARGES)[number]
/** Отметка учителя: «был», «был, не списывать», «не был», «поздняя отмена». */
export const OUTCOMES = ['present', 'present_free', 'absent', 'late_cancel'] as const
export type Outcome = (typeof OUTCOMES)[number]

/** Длительности в шторке (журнал п.39, 43); своя — от MINUTES_MIN до MINUTES_MAX. */
export const DURATIONS = [60, 90, 120] as const
export const MINUTES_MIN = 15
export const MINUTES_MAX = 480
/** Копия schedule_horizon_days(): на сколько дней вперёд созданы уроки серии. */
export const HORIZON_DAYS = 84
/** Самый длинный период одного чтения (get_schedule, get_my_lessons). */
export const RANGE_MAX_DAYS = 100
/** Часовой пояс расписания — фиксированный (архитектура §18). */
export const SCHEDULE_TZ = 'Asia/Almaty'

export interface LessonParticipant {
  cardId: string
  name: string
  cardStatus: CardStatus
  /** Пробное участие: не списывается никогда (журнал п.30, 65). */
  trial: boolean
  /** null — ещё не отмечено. */
  attended: boolean | null
  charge: Charge | null
  /** Списал будильник, а не учитель. */
  chargeAuto: boolean
}

export interface Lesson {
  id: string
  seriesId: string | null
  /** День урока по правилу серии (перенос его не меняет). */
  seriesDate: string | null
  kind: LessonKind
  status: LessonStatus
  startsAt: string
  endsAt: string
  /** Своё или серии. */
  title: string | null
  /** Своя, серии или ссылка учителя по умолчанию. */
  link: string | null
  /** Время до первого переноса; null — не переносился. */
  movedFrom: string | null
  version: number
  /** Будильник уже обработал урок (списал или пропустил без тарифа). */
  settled: boolean
  participants: LessonParticipant[]
}

/** Строка get_schedule: урок × участник. */
export interface ScheduleRow extends Omit<Lesson, 'participants' | 'id'> {
  lessonId: string
  participant: LessonParticipant | null
}

export interface Series {
  id: string
  kind: SeriesKind
  title: string | null
  /** ISO: 1 — понедельник … 7 — воскресенье. */
  weekdays: number[]
  /** «19:00:00» по Алматы. */
  startTime: string
  minutes: number
  everyWeeks: number
  startsOn: string
  endsOn: string | null
  link: string | null
  cardIds: string[]
  splitFrom: string | null
}

export interface LessonBalance {
  cardId: string
  paid: number
  charged: number
  /** Минус видит только учитель (журнал п.29). */
  balance: number
}

/** Урок глазами ученика: без других участников и отметок (журнал п.43). */
export interface MyLesson {
  id: string
  teacherId: string
  teacherName: string
  kind: LessonKind
  status: LessonStatus
  startsAt: string
  endsAt: string
  title: string | null
  link: string | null
  movedFrom: string | null
  version: number
}

/** Остаток ученику: без минуса (журнал п.33); tracked — ведёт ли учитель учёт. */
export interface MyLessonBalance {
  teacherId: string
  teacherName: string
  tracked: boolean
  lessonsLeft: number
}

/** Строки «урок × участник» → уроки с участниками, порядок сохраняется. */
export function groupSchedule(rows: ScheduleRow[]): Lesson[] {
  const byId = new Map<string, Lesson>()
  for (const { lessonId, participant, ...lesson } of rows) {
    let l = byId.get(lessonId)
    if (!l) {
      l = { ...lesson, id: lessonId, participants: [] }
      byId.set(lessonId, l)
    }
    if (participant) l.participants.push(participant)
  }
  return [...byId.values()]
}

/** Копия правила остатка (card_lesson_balance): какие отметки списывают урок. */
export function isCharged(charge: Charge | null): boolean {
  return charge === 'charged' || charge === 'late_cancel'
}

/** (был, списание) → отметка для экрана; null — не отмечен. Пробный «был» — «был». */
export function outcomeOf(p: Pick<LessonParticipant, 'attended' | 'charge' | 'trial'>): Outcome | null {
  if (p.attended === null || p.charge === null) return null
  if (p.charge === 'late_cancel') return 'late_cancel'
  if (!p.attended) return 'absent'
  return p.charge === 'charged' || p.trial ? 'present' : 'present_free'
}

/**
 * Копия правил mark_lesson_participant: какие отметки можно поставить сейчас.
 * До начала — только «не был» и «поздняя отмена»; пробному — без списаний.
 */
export function allowedOutcomes(
  lesson: Pick<Lesson, 'status' | 'startsAt'>,
  p: Pick<LessonParticipant, 'trial'>,
  now: Date,
): Outcome[] {
  if (lesson.status === 'cancelled') return []
  const started = new Date(lesson.startsAt).getTime() <= now.getTime()
  return OUTCOMES.filter(
    (o) => (started || o === 'absent' || o === 'late_cancel') && !(p.trial && (o === 'late_cancel' || o === 'present_free')),
  )
}

export type LessonPhase = 'upcoming' | 'live' | 'unmarked' | 'done' | 'cancelled'

/** Где урок сейчас. «Не отмечен» — закончился, но не проведён (ждёт будильник или был без тарифа). */
export function lessonPhase(lesson: Pick<Lesson, 'status' | 'startsAt' | 'endsAt'>, now: Date): LessonPhase {
  if (lesson.status === 'cancelled') return 'cancelled'
  const t = now.getTime()
  if (t < new Date(lesson.startsAt).getTime()) return 'upcoming'
  if (t < new Date(lesson.endsAt).getTime()) return 'live'
  return lesson.status === 'done' ? 'done' : 'unmarked'
}

// ---- дни серии --------------------------------------------------------------------
// День — строка 'YYYY-MM-DD' по Алматы; считаем в днях от эпохи, без часов
// (shared/lib/days — общее с календарём месяца).
export { addDays, isoWeekday }

/** Сегодня (или день момента) по Алматы. */
export function almatyDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHEDULE_TZ }).format(at)
}

export type SeriesRule = Pick<Series, 'weekdays' | 'everyWeeks' | 'startsOn' | 'endsOn'>

/**
 * Копия series_slot: есть ли урок серии в этот день. Неделя при шаге 2 —
 * «своя», если от понедельника недели начала прошло чётное число недель.
 */
export function isSeriesSlot(rule: SeriesRule, day: string): boolean {
  if (day < rule.startsOn || (rule.endsOn !== null && day > rule.endsOn)) return false
  if (!rule.weekdays.includes(isoWeekday(day))) return false
  const anchor = dayNumber(rule.startsOn) - (isoWeekday(rule.startsOn) - 1)
  return Math.floor((dayNumber(day) - anchor) / 7) % rule.everyWeeks === 0
}

/** Дни уроков серии в [from, to] — превью «будет N уроков» в шторке. */
export function seriesDays(rule: SeriesRule, from: string, to: string): string[] {
  const out: string[] = []
  for (let n = dayNumber(from), end = dayNumber(to); n <= end; n++) {
    const day = dayString(n)
    if (isSeriesSlot(rule, day)) out.push(day)
  }
  return out
}
