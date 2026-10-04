// ============================================================================
// Тексты уведомлений ученику об уроках (PLAN.md Ф2.9; журнал п.38, 42; макет
// u3): «Урок через час», «Урок перенесён», «Урок отменён», «Урок снова в
// расписании», новое расписание серии и отмена серии.
//
// Без базы и без часов телефона: время — по Алматы, как всё расписание
// (архитектура §18). Импорты — с расширением .js: этот файл через model.ts
// читает сервер доставки (api/_push.ts), а Vercel собирает его как Node ESM.
// ============================================================================
import { MONTH_SHORT, WEEKDAY_SHORT, isoWeekday } from '../../shared/lib/days.js'
import { plural } from '../../shared/lib/plural.js'

export interface LessonNoticeView {
  title: string
  body?: string
  href?: string
  action?: string
}

const TZ = 'Asia/Almaty'
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** Части момента по Алматы; мусор — undefined. */
function almaty(v: unknown): { day: string; time: string } | undefined {
  const s = text(v)
  const t = s ? Date.parse(s) : NaN
  if (Number.isNaN(t)) return undefined
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  )
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

/** «27 окт» из «2026-10-27». */
function dateShort(day: string): string {
  return `${Number(day.slice(8, 10))} ${MONTH_SHORT[Number(day.slice(5, 7)) - 1]}`
}

/** Момент → «вт, 20 окт, 19:00» по Алматы. */
export function lessonWhen(v: unknown): string | undefined {
  const a = almaty(v)
  return a && `${WEEKDAY_SHORT[isoWeekday(a.day) - 1]}, ${dateShort(a.day)}, ${a.time}`
}

/** День из данных («2026-10-27») → «27 окт»; мусор — undefined. */
function sinceLabel(v: unknown): string | undefined {
  const s = text(v)
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? dateShort(s) : undefined
}

const DATIVE = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям']

/** Дни недели ISO из данных: 1–7, без повторов, по порядку. */
function weekdaysOf(v: unknown): number[] {
  return Array.isArray(v)
    ? [...new Set(v.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b)
    : []
}

/** «вторникам и четвергам», «понедельникам, средам и пятницам». */
function listOf(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} и ${words[words.length - 1]}`
}
const daysDative = (days: number[]): string => listOf(days.map((d) => DATIVE[d - 1] ?? ''))
const daysShort = (days: number[]): string => listOf(days.map((d) => WEEKDAY_SHORT[d - 1] ?? ''))

const TIME = /^\d{2}:\d{2}$/
const timeOf = (v: unknown): string | undefined => (typeof v === 'string' && TIME.test(v) ? v : undefined)

/** «19:00» + 90 минут → «20:30». */
function endTime(time: string, minutes: number): string {
  const total = (Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** «через час», «через 25 минут», «сейчас» — от того, когда уведомление создано. */
function soonLabel(at: unknown, createdAt: unknown): string {
  const start = Date.parse(text(at) ?? '')
  const made = Date.parse(text(createdAt) ?? '')
  if (Number.isNaN(start) || Number.isNaN(made)) return 'Урок через час'
  const min = Math.round((start - made) / 60_000)
  if (min >= 50) return 'Урок через час'
  if (min <= 2) return 'Урок начинается'
  const m = Math.max(5, Math.round(min / 5) * 5)
  return `Урок через ${m} ${plural(m, 'минуту', 'минуты', 'минут')}`
}

const join = (...parts: (string | undefined | false)[]): string | undefined => {
  const out = parts.filter((p): p is string => typeof p === 'string' && p.length > 0)
  return out.length ? out.join(' · ') : undefined
}

/**
 * Текст уведомления об уроке по виду или undefined, если вид не об уроке.
 * Данные (миграция 0011): lesson, at / from / to, teacher_name, title (у
 * группы), link (есть ли ссылка), href; у серии — series, since, weekdays,
 * time, minutes, every_weeks, until, old (прежнее: weekdays, time, minutes,
 * every_weeks — или null, если серию делили с первого урока).
 */
export function renderLessonNotice(
  kind: string,
  d: Record<string, unknown>,
  createdAt: unknown,
  href: string | undefined,
): LessonNoticeView | undefined {
  const group = text(d.title)
  switch (kind) {
    case 'lesson_soon': {
      // «19:00 · Разговорный клуб · ссылка на урок внутри» (макет u3-1)
      const a = almaty(d.at)
      return {
        title: soonLabel(d.at, createdAt),
        body: join(a?.time, group ?? text(d.teacher_name), d.link === true && 'ссылка на урок внутри'),
        href,
      }
    }
    case 'lesson_moved': {
      const from = lessonWhen(d.from)
      const to = lessonWhen(d.to)
      return { title: 'Урок перенесён', body: join(from && to ? `${from} → ${to}` : to, group), href }
    }
    case 'lesson_cancelled':
      return { title: 'Урок отменён', body: join(lessonWhen(d.at), group), href }
    case 'lesson_restored':
      return { title: 'Урок снова в расписании', body: join(lessonWhen(d.at), group), href }
    case 'lessons_cancelled': {
      const days = weekdaysOf(d.weekdays)
      const since = sinceLabel(d.since)
      return {
        title: days.length ? `Уроки по ${daysDative(days)} отменены` : 'Уроки отменены',
        body: join(since && `с ${since}`, group),
        href,
        action: href && 'Мои уроки',
      }
    }
    case 'lessons_rescheduled':
      return { ...rescheduled(d, group), href, action: href && 'Мои уроки' }
    default:
      return undefined
  }
}

/**
 * Новое расписание серии — одно сообщение (макет u3-2). Если поменялось
 * одно — время или убрали дни, — так и говорим: «Уроки по четвергам теперь в
 * 18:00 · с 29 окт · вместо 19:00», «Уроки по вторникам отменены · с 27 окт ·
 * остальные уроки как были». Иначе — новое расписание целиком.
 */
function rescheduled(d: Record<string, unknown>, group: string | undefined): { title: string; body?: string } {
  const days = weekdaysOf(d.weekdays)
  const time = timeOf(d.time)
  const minutes = typeof d.minutes === 'number' ? d.minutes : undefined
  const every = d.every_weeks === 2 ? 2 : 1
  const since = sinceLabel(d.since)
  const old = d.old && typeof d.old === 'object' && !Array.isArray(d.old) ? (d.old as Record<string, unknown>) : undefined
  if (old && days.length && time) {
    const oldDays = weekdaysOf(old.weekdays)
    const oldTime = timeOf(old.time)
    const sameRest = old.minutes === minutes && (old.every_weeks === 2 ? 2 : 1) === every
    if (sameRest && oldDays.join() === days.join() && oldTime && oldTime !== time) {
      return { title: `Уроки по ${daysDative(days)} теперь в ${time}`, body: join(since && `с ${since}`, `вместо ${oldTime}`, group) }
    }
    const removed = oldDays.filter((x) => !days.includes(x))
    if (sameRest && oldTime === time && removed.length && days.every((x) => oldDays.includes(x))) {
      return { title: `Уроки по ${daysDative(removed)} отменены`, body: join(since && `с ${since}`, 'остальные уроки как были', group) }
    }
  }
  const until = sinceLabel(d.until)
  const rule = days.length && time
    ? `${every === 2 ? 'раз в две недели' : 'каждый'} ${daysShort(days)}, ${minutes ? `${time}–${endTime(time, minutes)}` : time}`
    : undefined
  return { title: 'Новое расписание уроков', body: join(since && rule ? `с ${since} — ${rule}` : rule, until && `до ${until}`, group) }
}
