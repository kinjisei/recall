// ============================================================================
// Активность и стрик — записи в activity_log (Фаза 3).
//   logActivity()   — засчитать занятие (никогда не бросает ошибок)
//   getStreak()     — сколько дней подряд занимался
//   getTodayTypes() — какие типы занятий уже сделаны сегодня
//   getWeek()       — 7 дней (пн→вс) для полосок стрика и графика прогресса
//   getBestStreak() — самая длинная серия за всю историю
// День считается в МЕСТНОМ времени пользователя, а не в UTC, чтобы вечерние
// занятия не «уезжали» на другую дату.
// ============================================================================
import { supabase, currentUserId } from './supabase'
import type { ActivityType } from '../types'

/** YYYY-MM-DD в местном времени (offsetDays: 0 — сегодня, -1 — вчера…). */
function localDay(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

/**
 * Засчитывает занятие: одна строка на (пользователь, день, тип),
 * счётчики items_done/duration_sec накапливаются.
 * Ошибки глотает: сбой статистики не должен ломать сами упражнения.
 */
export async function logActivity(
  type: ActivityType,
  itemsDone = 1,
  durationSec = 0,
): Promise<void> {
  try {
    // Запись идёт через RPC log_activity: прямая запись в activity_log клиенту
    // запрещена грантом (заход 21). День клиент шлёт местный (для корректного
    // стрика в своём часовом поясе), но сервер принимает только ±1 сутки от
    // своей даты — подделать историю стрика произвольными датами нельзя.
    const { error } = await supabase.rpc('log_activity', {
      p_type: type,
      p_day: localDay(),
      p_items: itemsDone,
      p_sec: durationSec,
    })
    if (error) throw error
  } catch (e) {
    console.warn('Не удалось записать активность:', e)
  }
}

/**
 * Стрик: сколько дней подряд занимался.
 * Если сегодня ещё не занимался, но занимался вчера — серия не сгорела,
 * показываем её (и мотивируем продолжить сегодня).
 */
export async function getStreak(): Promise<number> {
  const userId = await currentUserId()
  if (!userId) return 0

  const { data, error } = await supabase
    .from('activity_log')
    .select('day')
    .eq('user_id', userId)
    .order('day', { ascending: false })
    .limit(400)
  if (error) throw error

  const days = new Set((data ?? []).map((r) => r.day as string))
  const start = days.has(localDay(0)) ? 0 : days.has(localDay(-1)) ? -1 : null
  if (start === null) return 0

  let streak = 0
  let offset = start
  while (days.has(localDay(offset))) {
    streak++
    offset--
  }
  return streak
}

/** День недели: активность и объём (для полосок на Главной и графика прогресса). */
export interface WeekDay {
  day: string // YYYY-MM-DD
  label: string // «пн», «вт» …
  active: boolean
  items: number
  minutes: number
  isToday: boolean
}

const WEEKDAY_LABELS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

/** Скелет недели пн→вс (7 дней, все неактивны) — общий для getWeek и loadHomeActivity. */
function weekSkeleton(): WeekDay[] {
  const today = new Date()
  const shiftToMonday = (today.getDay() + 6) % 7 // пн первым (вс=0 в JS)
  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const day = localDay(i - shiftToMonday)
    const d = new Date()
    d.setDate(d.getDate() + (i - shiftToMonday))
    days.push({ day, label: WEEKDAY_LABELS[d.getDay()], active: false, items: 0, minutes: 0, isToday: day === localDay() })
  }
  return days
}

/** Заполняет скелет недели строками активности (day/items_done/duration_sec). */
function fillWeek(days: WeekDay[], rows: { day: string; items_done?: number; duration_sec?: number }[]): void {
  const byDay = new Map(days.map((d) => [d.day, d]))
  for (const row of rows) {
    const d = byDay.get(row.day)
    if (!d) continue
    d.active = true
    d.items += row.items_done ?? 0
    d.minutes += Math.round((row.duration_sec ?? 0) / 60)
  }
}

/**
 * Текущая неделя с понедельника по воскресенье.
 * Возвращает все 7 дней (даже будущие) — полоски рисуются всегда.
 */
export async function getWeek(): Promise<WeekDay[]> {
  const userId = await currentUserId()
  const days = weekSkeleton()
  if (!userId) return days

  const { data, error } = await supabase
    .from('activity_log')
    .select('day, items_done, duration_sec')
    .eq('user_id', userId)
    .gte('day', days[0].day)
    .lte('day', days[6].day)
  if (error) throw error
  fillWeek(days, (data ?? []) as { day: string; items_done: number; duration_sec: number }[])
  return days
}

/** Стрик + неделя + сегодняшние типы ОДНИМ запросом (для Главной).
 *  Раньше это были три отдельных запроса к activity_log на каждый вход. */
export interface HomeActivity {
  streak: number
  week: WeekDay[]
  todayTypes: Set<ActivityType>
}

export async function loadHomeActivity(): Promise<HomeActivity> {
  const week = weekSkeleton()
  const userId = await currentUserId()
  if (!userId) return { streak: 0, week, todayTypes: new Set() }

  // limit(400) покрывает и стрик (до 400 дней), и неделю, и сегодня — всё это
  // подмножества последних 400 дней активности.
  const { data, error } = await supabase
    .from('activity_log')
    .select('day, type, items_done, duration_sec')
    .eq('user_id', userId)
    .order('day', { ascending: false })
    .limit(400)
  if (error) throw error
  const rows = (data ?? []) as { day: string; type: string; items_done: number; duration_sec: number }[]

  const daySet = new Set(rows.map((r) => r.day))
  const start = daySet.has(localDay(0)) ? 0 : daySet.has(localDay(-1)) ? -1 : null
  let streak = 0
  if (start !== null) {
    let offset = start
    while (daySet.has(localDay(offset))) {
      streak++
      offset--
    }
  }

  fillWeek(week, rows)

  const today = localDay()
  const todayTypes = new Set(rows.filter((r) => r.day === today).map((r) => r.type as ActivityType))

  return { streak, week, todayTypes }
}

/** Самая длинная серия за всю историю (для экрана прогресса). */
export async function getBestStreak(): Promise<number> {
  const userId = await currentUserId()
  if (!userId) return 0

  const { data, error } = await supabase
    .from('activity_log')
    .select('day')
    .eq('user_id', userId)
    .order('day', { ascending: true })
    .limit(2000)
  if (error) throw error

  const days = [...new Set((data ?? []).map((r) => r.day as string))].sort()
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const day of days) {
    const d = new Date(day + 'T00:00:00')
    const isNext =
      prev !== null && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1
    run = isNext ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

/** Какие типы занятий уже засчитаны сегодня. */
export async function getTodayTypes(): Promise<Set<ActivityType>> {
  const userId = await currentUserId()
  if (!userId) return new Set()

  const { data, error } = await supabase
    .from('activity_log')
    .select('type')
    .eq('user_id', userId)
    .eq('day', localDay())
  if (error) throw error

  return new Set((data ?? []).map((r) => r.type as ActivityType))
}
