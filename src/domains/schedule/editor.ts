// ============================================================================
// Шторки расписания — правила без базы (PLAN.md Ф2.7; макеты t3–t5): черновик
// урока и что из него уйдёт в базу, сводка «Каждый пн и ср… · 20 уроков»,
// пересечения, перенос «этот и все следующие», тексты для ученика.
// Проверяется в node (scripts/test-schedule-screen.mjs). Решает база: здесь
// копии её правил только для подсказки до нажатия, помечены «копия».
// ============================================================================
import { addDays, daysBetween, formatTime, isoWeekday, parseTime } from '../../shared/lib/days.ts'
import { plural } from '../../shared/lib/plural.ts'
import {
  almatyInstant,
  almatyTime,
  dateShort,
  dayShort,
  lessonDay,
  lessonMinutes,
  lessonsCount,
  repeatLabel,
  timeRange,
  weekdaysList,
} from './calendar.ts'
import {
  isCharged,
  MINUTES_MAX,
  MINUTES_MIN,
  seriesDays,
  type Lesson,
  type LessonKind,
  type Series,
  type SeriesKind,
  type SeriesRule,
} from './model.ts'
import type { LessonInput, SeriesInput } from './api.ts'

/** То, что набрано в шторке «Новый урок» / «Изменить». */
export interface LessonDraft {
  kind: LessonKind
  cardIds: string[]
  /** Название группы. */
  title: string
  day: string
  /** «18:00» по Алматы. */
  time: string
  minutes: number
  repeat: boolean
  weekdays: number[]
  everyWeeks: 1 | 2
  endsOn: string | null
  /** Своя ссылка урока или группы; '' — ссылка по умолчанию. */
  link: string
}

export function newDraft(day: string, time: string, cardIds: string[] = []): LessonDraft {
  return {
    kind: 'individual',
    cardIds,
    title: '',
    day,
    time,
    minutes: 60,
    repeat: false,
    weekdays: [isoWeekday(day)],
    everyWeeks: 1,
    endsOn: null,
    link: '',
  }
}

/** Время нового урока: сегодня — следующий целый час (до 21:00), иначе 18:00. */
export function defaultSlot(day: string, today: string, nowMinutes: number): { day: string; time: string } {
  if (day !== today) return { day, time: '18:00' }
  const hour = Math.floor(nowMinutes / 60) + 1
  return hour <= 21 ? { day, time: formatTime(hour) } : { day: addDays(day, 1), time: '18:00' }
}

/** «18:00» + 90 мин → «19:30» (за полночь — по кругу). */
export function endTime(time: string, minutes: number): string {
  const [h, m] = parseTime(time)
  return formatTime(h, m + minutes)
}

export const draftRule = (d: LessonDraft): SeriesRule => ({
  weekdays: d.weekdays,
  everyWeeks: d.everyWeeks,
  startsOn: d.day,
  endsOn: d.endsOn,
})

/** Первый урок серии — копия проверки create_series: хотя бы один в первые две недели. */
export function firstSeriesDay(rule: SeriesRule): string | null {
  return seriesDays(rule, rule.startsOn, addDays(rule.startsOn, 13))[0] ?? null
}

/**
 * Копия lesson_link_clean (миграция 0009): «meet.google.com/abc» → https://…,
 * только http(s), до 500 знаков. null — пусто, false — не ссылка.
 */
export function cleanLink(raw: string): string | null | false {
  let v = raw.trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(v)) v = 'https://' + v
  if (v.length > 500 || !/^https?:\/\/[^\s<>"]+$/i.test(v)) return false
  return v
}

/**
 * Почему «Создать урок» пока нельзя — или null. Копии проверок базы
 * (schedule_cards, create_series, lesson_check_time): человек видит причину
 * до нажатия, а не код ошибки после.
 */
export function draftProblem(d: LessonDraft, today: string): string | null {
  if (d.kind === 'group') {
    if (!d.title.trim()) return 'Назови группу'
    if (d.cardIds.length === 0) return 'Добавь учеников в группу'
    if (d.cardIds.length > 30) return 'В группе — до 30 учеников'
  } else if (d.cardIds.length !== 1) return 'Выбери ученика'
  if (!Number.isInteger(d.minutes) || d.minutes < MINUTES_MIN || d.minutes > MINUTES_MAX)
    return 'Длительность — от 15 минут до 8 часов'
  if (d.repeat) {
    if (!d.weekdays.length) return 'Выбери дни недели'
    if (d.endsOn !== null && d.endsOn < d.day) return 'Окончание раньше первого урока'
    if (d.endsOn !== null && daysBetween(d.day, d.endsOn) > 366 * 2) return 'Окончание — не дальше чем через два года'
    if (!firstSeriesDay(draftRule(d))) return 'В первые две недели нет ни одного урока'
  } else {
    if (daysBetween(today, d.day) < -60) return 'Записать можно урок не старше 60 дней'
    if (daysBetween(today, d.day) > 400) return 'Не дальше чем на год вперёд'
  }
  if (cleanLink(d.link) === false) return 'Ссылка — адрес вида meet.google.com/…'
  return null
}

const optional = (s: string): string | undefined => s.trim() || undefined

/** Разовый урок (и «только этот» при правке). */
export function toLessonInput(d: LessonDraft): LessonInput {
  return {
    kind: d.kind,
    startsAt: almatyInstant(d.day, d.time).toISOString(),
    minutes: d.minutes,
    cardIds: d.cardIds,
    title: d.kind === 'group' ? optional(d.title) : undefined,
    link: optional(d.link),
  }
}

/** Серия (и «этот и все следующие»). Пробный урок серией не бывает. */
export function toSeriesInput(d: LessonDraft): SeriesInput & { startsOn: string } {
  return {
    kind: (d.kind === 'group' ? 'group' : 'individual') as SeriesKind,
    weekdays: [...d.weekdays].sort((a, b) => a - b),
    time: d.time,
    minutes: d.minutes,
    everyWeeks: d.everyWeeks,
    endsOn: d.endsOn,
    cardIds: d.cardIds,
    title: d.kind === 'group' ? optional(d.title) : undefined,
    link: optional(d.link),
    startsOn: d.day,
  }
}

/**
 * Строка под формой (макет t3): «Каждый пн и ср, 18:00–19:00 · с 19 окт до
 * 23 дек · 20 уроков» · «чт, 15 окт, 17:30–18:30 · 1 урок».
 */
export function draftSummary(d: LessonDraft): string {
  const time = `${d.time}–${endTime(d.time, d.minutes)}`
  if (!d.repeat || d.kind === 'trial') {
    return `${dayShort(d.day)}, ${time} · ${d.kind === 'trial' ? 'пробный, не списывается' : '1 урок'}`
  }
  const first = firstSeriesDay(draftRule(d))
  if (!first || !d.weekdays.length) return `${repeatLabel(d.weekdays, d.everyWeeks) || 'Повтор'}, ${time}`
  const head = `${repeatLabel(d.weekdays, d.everyWeeks)}, ${time}`
  if (d.endsOn === null) {
    const people = d.kind === 'group' ? ` · ${d.cardIds.length} ${plural(d.cardIds.length, 'ученик', 'ученика', 'учеников')}` : ''
    return `${head} · с ${dateShort(first)}, без даты окончания${people}`
  }
  const count = seriesDays(draftRule(d), d.day, d.endsOn).length
  return `${head} · с ${dateShort(first)} до ${dateShort(d.endsOn)} · ${lessonsCount(count)}`
}

/** Имя урока: группа — название, иначе имя ученика. */
export function lessonName(l: Pick<Lesson, 'title' | 'kind' | 'participants'>): string {
  if (l.kind === 'group') return l.title ?? 'Группа'
  return l.participants[0]?.name ?? l.title ?? 'Урок'
}

/** Уроки, с которыми пересекается черновик (макет t3-4: «Пересекается с …»). */
export function overlaps(d: LessonDraft, lessons: Lesson[], exceptId?: string): Lesson[] {
  const start = almatyInstant(d.day, d.time).getTime()
  const end = start + d.minutes * 60_000
  return lessons.filter(
    (l) =>
      l.id !== exceptId &&
      l.status !== 'cancelled' &&
      new Date(l.startsAt).getTime() < end &&
      new Date(l.endsAt).getTime() > start,
  )
}

/** Черновик из урока — шторка «Изменить» (решение владельца 04.10.2026). */
export function draftFromLesson(l: Lesson, series: Series | null, defaultLink: string | null): LessonDraft {
  const day = lessonDay(l)
  return {
    kind: l.kind,
    cardIds: l.participants.map((p) => p.cardId),
    title: l.kind === 'group' ? (l.title ?? '') : '',
    day,
    time: almatyTime(l.startsAt),
    minutes: lessonMinutes(l),
    repeat: series !== null,
    weekdays: series ? [...series.weekdays] : [isoWeekday(day)],
    everyWeeks: series?.everyWeeks === 2 ? 2 : 1,
    endsOn: series?.endsOn ?? null,
    // ссылка, равная ссылке по умолчанию, — не своя: сменит учитель ссылку
    // по умолчанию, урок пойдёт следом
    link: l.link && l.link !== defaultLink ? l.link : '',
  }
}

// ---- перенос, отмена, «этот и все следующие» ------------------------------------------

/** Перенести и изменить можно запланированный урок (копия update_lesson). */
export const canEdit = (l: Pick<Lesson, 'status'>): boolean => l.status === 'planned'

/** «Этот и все следующие» — урок серии, ещё не начавшийся (копия update_series_from). */
export const canFollowing = (l: Pick<Lesson, 'seriesId' | 'startsAt'>, now: Date): boolean =>
  l.seriesId !== null && new Date(l.startsAt).getTime() > now.getTime()

/**
 * Дни серии после переноса «этот и все следующие»: день урока заменяется
 * новым днём («вт и чт», чт → пт = «вт и пт»). Время у серии одно на все дни.
 */
export function movedWeekdays(series: Pick<Series, 'weekdays'>, l: Pick<Lesson, 'seriesDate' | 'startsAt'>, day: string): number[] {
  const old = isoWeekday(l.seriesDate ?? lessonDay(l))
  const next = new Set(series.weekdays.filter((w) => w !== old))
  next.add(isoWeekday(day))
  return [...next].sort((a, b) => a - b)
}

/** Вход update_series_from при переносе «этот и все следующие». */
export function moveSeriesInput(series: Series, l: Lesson, day: string, time: string): SeriesInput {
  return {
    kind: series.kind,
    weekdays: movedWeekdays(series, l, day),
    time,
    minutes: series.minutes,
    everyWeeks: series.everyWeeks === 2 ? 2 : 1,
    endsOn: series.endsOn,
    cardIds: series.cardIds,
    title: series.title ?? undefined,
    link: series.link ?? undefined,
  }
}

/**
 * Сколько ОТДЕЛЬНО перенесённых уроков впереди перестроит «этот и все
 * следующие» (журнал п.65, 3: экран предупреждает заранее). Не в счёт: сам
 * урок, отменённые, начавшиеся и со списанием — их база не трогает.
 */
export function rebuildCount(lessons: Lesson[], l: Pick<Lesson, 'id' | 'seriesId' | 'seriesDate'>, now: Date): number {
  if (!l.seriesId || !l.seriesDate) return 0
  const from = l.seriesDate
  return lessons.filter(
    (x) =>
      x.seriesId === l.seriesId &&
      x.id !== l.id &&
      x.seriesDate !== null &&
      x.seriesDate >= from &&
      x.movedFrom !== null &&
      x.status === 'planned' &&
      new Date(x.startsAt).getTime() > now.getTime() &&
      !x.participants.some((p) => isCharged(p.charge)),
  ).length
}

/**
 * Остаток после выбора «списать / не списывать» (макеты t4-2, t5-2):
 * «Останется 3 урока» — не меняется, «Станет 2 урока» — меняется.
 */
export function balanceAfter(balance: number, wasCharged: boolean, willCharge: boolean): string {
  const next = balance + (wasCharged ? 1 : 0) - (willCharge ? 1 : 0)
  const n = next < 0 ? `−${lessonsCount(-next)}` : lessonsCount(next)
  return `${next === balance ? 'Останется' : 'Станет'} ${n}`
}

// ---- что написать ученику (макет t5-4; журнал п.38, 42) ------------------------------------

/** «в ср» · «во вт» */
const onDay = (day: string): string => `${isoWeekday(day) === 2 ? 'во' : 'в'} ${dayShort(day)}`
const at = (iso: string): string => `${dayShort(lessonDay({ startsAt: iso }))}, ${almatyTime(iso)}`

/** «Тимур, урок перенесён: вт, 20 окт, 10:00 → ср, 21 окт, 10:00» */
export const movedMessage = (who: string, from: string, to: string): string =>
  `${who}, урок перенесён: ${at(from)} → ${at(to)}`

/** «Айгерим, урок в чт, 22 окт, 19:00 отменён.» */
export const cancelledMessage = (who: string, l: Pick<Lesson, 'startsAt'>): string =>
  `${who}, урок ${onDay(lessonDay(l))}, ${almatyTime(l.startsAt)} отменён.`

/** «Айгерим, уроки по вт и чт отменены с 22 окт.» */
export const seriesCancelledMessage = (who: string, weekdays: number[], from: string): string =>
  `${who}, уроки по ${weekdaysList(weekdays)} отменены с ${dateShort(from)}.`

/** «Айгерим, меняем расписание: с 23 окт — каждый вт и пт, 18:00–19:00.» */
export function seriesChangedMessage(who: string, d: LessonDraft, from: string): string {
  const rule = repeatLabel(d.weekdays, d.everyWeeks)
  return `${who}, меняем расписание: с ${dateShort(from)} — ${rule.charAt(0).toLowerCase()}${rule.slice(1)}, ${d.time}–${endTime(d.time, d.minutes)}.`
}

/** «Тимур, напоминаю: урок в ср, 21 окт, 10:00–11:00.\nСсылка: …» */
export function reminderMessage(who: string, l: Pick<Lesson, 'startsAt' | 'endsAt' | 'link'>): string {
  const text = `${who}, напоминаю: урок ${onDay(lessonDay(l))}, ${timeRange(l)}.`
  return l.link ? `${text}\nСсылка: ${l.link}` : text
}
