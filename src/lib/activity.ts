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
import { supabase } from './supabase'
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const day = localDay()

    const { data: existing } = await supabase
      .from('activity_log')
      .select('id, items_done, duration_sec')
      .eq('user_id', user.id)
      .eq('day', day)
      .eq('type', type)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('activity_log')
        .update({
          items_done: existing.items_done + itemsDone,
          duration_sec: existing.duration_sec + durationSec,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('activity_log').insert({
        user_id: user.id,
        day,
        type,
        items_done: itemsDone,
        duration_sec: durationSec,
      })
    }
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { data, error } = await supabase
    .from('activity_log')
    .select('day')
    .eq('user_id', user.id)
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

/**
 * Текущая неделя с понедельника по воскресенье.
 * Возвращает все 7 дней (даже будущие) — полоски рисуются всегда.
 */
export async function getWeek(): Promise<WeekDay[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = new Date()
  // понедельник как первый день недели (в JS воскресенье = 0)
  const shiftToMonday = (today.getDay() + 6) % 7
  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const day = localDay(i - shiftToMonday)
    const d = new Date()
    d.setDate(d.getDate() + (i - shiftToMonday))
    days.push({
      day,
      label: WEEKDAY_LABELS[d.getDay()],
      active: false,
      items: 0,
      minutes: 0,
      isToday: day === localDay(),
    })
  }
  if (!user) return days

  const { data, error } = await supabase
    .from('activity_log')
    .select('day, items_done, duration_sec')
    .eq('user_id', user.id)
    .gte('day', days[0].day)
    .lte('day', days[6].day)
  if (error) throw error

  const byDay = new Map(days.map((d) => [d.day, d]))
  for (const row of data ?? []) {
    const d = byDay.get(row.day as string)
    if (!d) continue
    d.active = true
    d.items += (row.items_done as number) ?? 0
    d.minutes += Math.round(((row.duration_sec as number) ?? 0) / 60)
  }
  return days
}

/** Самая длинная серия за всю историю (для экрана прогресса). */
export async function getBestStreak(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { data, error } = await supabase
    .from('activity_log')
    .select('day')
    .eq('user_id', user.id)
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()

  const { data, error } = await supabase
    .from('activity_log')
    .select('type')
    .eq('user_id', user.id)
    .eq('day', localDay())
  if (error) throw error

  return new Set((data ?? []).map((r) => r.type as ActivityType))
}
