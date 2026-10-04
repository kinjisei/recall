// ============================================================================
// Дни как строки 'YYYY-MM-DD' — без часов и часовых поясов.
//
// Календарь месяца в шторке «Новый урок» и правила серий расписания
// (domains/schedule) считают в днях: «какой день недели», «через неделю»,
// «сетка октября». Считаем числом дней от эпохи — так нет ни перехода на
// летнее время, ни сдвига полуночи по поясу браузера. Какой сегодня день по
// Алматы — забота расписания (almatyDay), здесь дни уже выбраны.
// ============================================================================

const DAY_MS = 86_400_000

/** Названия — одним местом: календарь месяца (shared/ui) и подписи расписания. */
export const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const
export const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
export const MONTH_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** «18:30» → [18, 30]; непонятное — [0, 0]. */
export function parseTime(time: string): [number, number] {
  const [h = 0, m = 0] = time.split(':').map((x) => Number(x) || 0)
  return [h, m]
}

/** [18, 30] → «18:30»; минуты от полуночи — по кругу суток. */
export function formatTime(h: number, m = 0): string {
  const t = (((h * 60 + m) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** «Октябрь 2026» — шапка календаря месяца. */
export const monthTitle = (day: string): string => `${MONTH_NAMES[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`

/** Номер дня от эпохи: '1970-01-02' → 1. */
export const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / DAY_MS
export const dayString = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10)

/** ISO-день недели: 1 — понедельник … 7 — воскресенье. */
export const isoWeekday = (day: string): number => ((new Date(dayNumber(day) * DAY_MS).getUTCDay() + 6) % 7) + 1
export const addDays = (day: string, n: number): string => dayString(dayNumber(day) + n)
/** Сколько дней от a до b (b − a). */
export const daysBetween = (a: string, b: string): number => dayNumber(b) - dayNumber(a)

/** Понедельник недели дня. */
export const weekStart = (day: string): string => addDays(day, 1 - isoWeekday(day))

/** Первое число месяца дня: '2026-10-19' → '2026-10-01'. */
export const monthStart = (day: string): string => `${day.slice(0, 7)}-01`

/** Первое число соседнего месяца: shift = 1 — следующий, −1 — предыдущий. */
export function addMonths(day: string, shift: number): string {
  const y = Number(day.slice(0, 4))
  const m = Number(day.slice(5, 7)) - 1 + shift
  const d = new Date(Date.UTC(y, m, 1))
  return d.toISOString().slice(0, 10)
}

/**
 * Сетка месяца по неделям с понедельника: дни месяца, на чужих местах — null
 * (макет t3: «Октябрь 2026», пустые клетки до 1-го числа).
 */
export function monthGrid(day: string): (string | null)[][] {
  const first = monthStart(day)
  const next = addMonths(first, 1)
  const weeks: (string | null)[][] = []
  let week: (string | null)[] = Array.from({ length: isoWeekday(first) - 1 }, () => null)
  for (let d = first; d < next; d = addDays(d, 1)) {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length) weeks.push([...week, ...Array.from({ length: 7 - week.length }, () => null)])
  return weeks
}
