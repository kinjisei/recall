// ============================================================================
// Расписание на экране — время по Алматы, подписи и раскладка уроков по
// часам (PLAN.md Ф2.7; макеты t2, d1). Без базы и без разметки: проверяется
// в node (scripts/test-schedule-screen.mjs).
//
// ⚠️ Время урока — всегда по Алматы (архитектура §18), а не по поясу
// телефона: репетитор в поездке видит те же «19:00», что и ученик дома. Поэтому
// здесь нет ни одного `getHours()` — только Intl с SCHEDULE_TZ.
// ============================================================================
import { addDays, daysBetween, formatTime, isoWeekday, MONTH_GENITIVE, MONTH_SHORT, monthTitle, parseTime, WEEKDAY_SHORT } from '../../shared/lib/days.ts'
import { plural } from '../../shared/lib/plural.ts'
import { almatyDay, SCHEDULE_TZ, type Lesson, type LessonParticipant } from './model.ts'

// ---- момент ↔ день и минуты по Алматы ---------------------------------------------

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHEDULE_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Части момента по Алматы: год, месяц, день, час, минута. */
function zoned(t: number): Record<'year' | 'month' | 'day' | 'hour' | 'minute', number> {
  const p = Object.fromEntries(PARTS.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]))
  return { year: p.year ?? 0, month: p.month ?? 1, day: p.day ?? 1, hour: p.hour ?? 0, minute: p.minute ?? 0 }
}

/** Смещение пояса расписания от UTC в момент t, в минутах (Алматы: +300). */
function zoneOffset(t: number): number {
  const p = zoned(t)
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return Math.round((local - Math.floor(t / 60_000) * 60_000) / 60_000)
}

/** «День, ЧЧ:ММ по Алматы» → момент. */
export function almatyInstant(day: string, time: string): Date {
  const [h, m] = parseTime(time)
  const naive = Date.parse(`${day}T00:00:00Z`) + (h * 60 + m) * 60_000
  // пояс без перехода на летнее время — хватает одной поправки; вторая —
  // на случай, если правила пояса когда-нибудь снова поменяют
  let t = naive - zoneOffset(naive) * 60_000
  t = naive - zoneOffset(t) * 60_000
  return new Date(t)
}

/** Минуты от полуночи по Алматы: «19:30» → 1170. */
export function almatyMinutes(at: string | Date): number {
  const p = zoned(new Date(at).getTime())
  return p.hour * 60 + p.minute
}

/** «19:00» по Алматы. */
export function almatyTime(at: string | Date): string {
  return formatTime(0, almatyMinutes(at))
}

/** День урока по Алматы. */
export const lessonDay = (l: Pick<Lesson, 'startsAt'>): string => almatyDay(new Date(l.startsAt))

/** Границы дня по Алматы: [полночь, следующая полночь). */
export function dayBounds(day: string): { from: Date; to: Date } {
  return { from: almatyInstant(day, '00:00'), to: almatyInstant(addDays(day, 1), '00:00') }
}

// ---- подписи ------------------------------------------------------------------------

const MONTHS_GEN = MONTH_GENITIVE
const MONTHS_SHORT = MONTH_SHORT

/** «пн» … «вс» по ISO-номеру дня недели. */
export const weekdayName = (iso: number): string => WEEKDAY_SHORT[iso - 1] ?? ''
export const WEEKDAY_NAMES: readonly string[] = WEEKDAY_SHORT
export { monthTitle }

const dd = (day: string) => Number(day.slice(8, 10))
const mm = (day: string) => Number(day.slice(5, 7)) - 1

/** «чт, 15 октября» */
export const dayLong = (day: string): string => `${weekdayName(isoWeekday(day))}, ${dd(day)} ${MONTHS_GEN[mm(day)]}`
/** «чт, 15 окт» */
export const dayShort = (day: string): string => `${weekdayName(isoWeekday(day))}, ${dd(day)} ${MONTHS_SHORT[mm(day)]}`
/** «15 окт» — без дня недели */
export const dateShort = (day: string): string => `${dd(day)} ${MONTHS_SHORT[mm(day)]}`

const NEAR_DAYS = ['Вчера', 'Сегодня', 'Завтра']

/** «Сегодня, чт 15 октября» · «Завтра, …» · «Вчера, …» · «чт, 22 октября» (шторка урока, t4). */
export function dayTitle(day: string, today: string): string {
  const near = NEAR_DAYS[daysBetween(today, day) + 1] as string | undefined
  const long = dayLong(day)
  return near ? `${near}, ${long.replace(',', '')}` : long
}

/**
 * «12–18 октября» · «28 сентября – 4 октября» (шапка недели); short — на
 * стыке месяцев «28 сен – 4 окт» (узкая шапка телефона).
 */
export function weekTitle(monday: string, short = false): string {
  const sunday = addDays(monday, 6)
  if (mm(monday) === mm(sunday)) return `${dd(monday)}–${dd(sunday)} ${MONTHS_GEN[mm(sunday)]}`
  const names = short ? MONTHS_SHORT : MONTHS_GEN
  return `${dd(monday)} ${names[mm(monday)]} – ${dd(sunday)} ${names[mm(sunday)]}`
}

/** «1 ч» · «1,5 ч» · «45 мин» · «1 ч 15 мин» — длительность урока. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  if (minutes % 30 === 0) return `${String(minutes / 60).replace('.', ',')} ч`
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
}

/** Длительность урока в минутах. */
export const lessonMinutes = (l: Pick<Lesson, 'startsAt' | 'endsAt'>): number =>
  Math.round((new Date(l.endsAt).getTime() - new Date(l.startsAt).getTime()) / 60_000)

/** «19:00–20:00» */
export const timeRange = (l: Pick<Lesson, 'startsAt' | 'endsAt'>): string => `${almatyTime(l.startsAt)}–${almatyTime(l.endsAt)}`

/** «3 урока» */
export const lessonsCount = (n: number): string => `${n} ${plural(Math.abs(n), 'урок', 'урока', 'уроков')}`

/**
 * Когда урок относительно «сейчас»: «через 50 мин», «через 3 ч», «завтра»,
 * «через 7 дней», «идёт», «прошёл» (макеты t2, t4).
 */
export function relativeLabel(l: Pick<Lesson, 'startsAt' | 'endsAt'>, now: Date): string {
  const start = new Date(l.startsAt).getTime()
  const t = now.getTime()
  if (t >= new Date(l.endsAt).getTime()) return 'прошёл'
  if (t >= start) return 'идёт'
  const mins = Math.ceil((start - t) / 60_000)
  if (mins < 60) return `через ${mins} мин`
  const days = daysBetween(almatyDay(now), lessonDay(l))
  if (days === 0) return `через ${Math.floor(mins / 60)} ч`
  if (days === 1) return 'завтра'
  return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`
}

// Род дня недели: «каждый вт», «каждую сб», «каждое вс».
const EACH = ['Каждый', 'Каждый', 'Каждую', 'Каждый', 'Каждую', 'Каждую', 'Каждое']

/** «вт и чт» · «пн, ср и пт» */
export function weekdaysList(weekdays: number[]): string {
  const names = [...weekdays].sort((a, b) => a - b).map(weekdayName)
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`
}

/** «Каждый вт и чт» · «Каждую сб» · «Раз в 2 недели: вт и чт» (серия, t3–t4). */
export function repeatLabel(weekdays: number[], everyWeeks: number): string {
  const sorted = [...weekdays].sort((a, b) => a - b)
  const first = sorted[0]
  if (first === undefined) return ''
  if (everyWeeks === 2) return `Раз в 2 недели: ${weekdaysList(sorted)}`
  return `${EACH[first - 1] ?? 'Каждый'} ${weekdaysList(sorted)}`
}

// ---- раскладка дня по часам -------------------------------------------------------------

export interface Placed<T> {
  item: T
  /** Минуты от полуночи дня (по Алматы). */
  top: number
  /** Длительность на сетке, минут (урок за полночь обрезается). */
  height: number
  /** Дорожка среди пересекающихся и сколько их в группе. */
  lane: number
  lanes: number
}

/**
 * Уроки дня на сетке часов. Пересекающиеся встают рядом — каждый в свою
 * дорожку, ширина делится на число дорожек их группы (как в календарях).
 */
export function placeLessons<T extends Pick<Lesson, 'startsAt' | 'endsAt'>>(items: T[], day: string): Placed<T>[] {
  const { from } = dayBounds(day)
  const base = from.getTime()
  const rows = items
    .map((item) => {
      const top = Math.max(0, Math.round((new Date(item.startsAt).getTime() - base) / 60_000))
      const end = Math.min(24 * 60, Math.round((new Date(item.endsAt).getTime() - base) / 60_000))
      return { item, top, height: Math.max(15, end - top), lane: 0, lanes: 1 }
    })
    .sort((a, b) => a.top - b.top || b.height - a.height)

  let group: typeof rows = []
  let groupEnd = -1
  const close = () => {
    const n = Math.max(...group.map((r) => r.lane)) + 1
    for (const r of group) r.lanes = n
    group = []
  }
  for (const r of rows) {
    if (group.length && r.top >= groupEnd) close()
    const busy = new Set(group.filter((g) => g.top + g.height > r.top).map((g) => g.lane))
    let lane = 0
    while (busy.has(lane)) lane++
    r.lane = lane
    group.push(r)
    groupEnd = Math.max(groupEnd, r.top + r.height)
  }
  if (group.length) close()
  return rows
}

/** Видимые часы сетки: обычно 8–22, шире — если уроки раньше или позже. */
export function hourWindow(placed: Pick<Placed<unknown>, 'top' | 'height'>[]): { from: number; to: number } {
  let from = 8
  let to = 22
  for (const p of placed) {
    from = Math.min(from, Math.floor(p.top / 60))
    to = Math.max(to, Math.ceil((p.top + p.height) / 60))
  }
  return { from, to: Math.min(24, to) }
}

/** Уроки по дням недели (по Алматы), каждый день — по времени. */
export function byDay<T extends Pick<Lesson, 'startsAt'>>(lessons: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const l of [...lessons].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const day = lessonDay(l)
    out.set(day, [...(out.get(day) ?? []), l])
  }
  return out
}

// ---- после пробного ---------------------------------------------------------------------

export interface TrialQuestion {
  lesson: Lesson
  participant: LessonParticipant
}

/**
 * «<имя> остаётся заниматься?» (журнал п.30; макеты t2-1, t7-4): пробный урок
 * закончился, а ученик всё ещё «пробный». Не спрашиваем про отменённый урок и
 * про того, кого отметили «не был». Ответ меняет статус карточки — вопрос
 * уходит сам. Самый свежий пробный — первым, по одному на ученика.
 */
export function trialQuestions(lessons: Lesson[], now: Date): TrialQuestion[] {
  const seen = new Set<string>()
  const out: TrialQuestion[] = []
  for (const lesson of [...lessons].sort((a, b) => b.endsAt.localeCompare(a.endsAt))) {
    if (lesson.status === 'cancelled' || new Date(lesson.endsAt).getTime() > now.getTime()) continue
    for (const p of lesson.participants) {
      if (!p.trial || p.cardStatus !== 'trial' || p.attended === false || seen.has(p.cardId)) continue
      seen.add(p.cardId)
      out.push({ lesson, participant: p })
    }
  }
  return out
}
