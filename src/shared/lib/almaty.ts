// ============================================================================
// Время продукта — по Алматы (решение владельца 22.10.2026, PLAN.md Ф2.17-4).
//
// «Сегодня», день недели и полночь у всех — по Алматы, а не по часам
// устройства: урок, энергия, серия, план дня и срок домашки живут в одних
// сутках. Раньше серия и план дня шли по поясу телефона, а энергия и уроки —
// по Алматы: в Казахстане это один день (вся страна — UTC+5), но ученик в
// поездке получал два «сегодня», а учитель видел серию ученика по своим часам.
//
// Здесь — переход «момент ↔ день и время по Алматы»; дальше дни считаются
// строками 'YYYY-MM-DD' (shared/lib/days). Методов местного времени
// (getDate, setHours…) в src нет — держит scripts/test-almaty-dates.mjs.
// ============================================================================
import { addDays, formatTime, parseTime } from './days.ts'

export const APP_TZ = 'Asia/Almaty'

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ })
const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TZ,
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

/** Смещение Алматы от UTC в момент t, в минутах (сейчас +300). */
function zoneOffset(t: number): number {
  const p = zoned(t)
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return Math.round((local - Math.floor(t / 60_000) * 60_000) / 60_000)
}

/** День момента по Алматы: «2026-10-22». */
export const almatyDay = (at: Date = new Date()): string => DAY.format(at)

/** Сегодня по Алматы со сдвигом в днях: almatyToday(-1) — вчера. */
export const almatyToday = (offsetDays = 0): string => addDays(almatyDay(), offsetDays)

/** «День, ЧЧ:ММ по Алматы» → момент; без времени — полночь, начало дня. */
export function almatyInstant(day: string, time = '00:00'): Date {
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
