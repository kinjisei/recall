// ============================================================================
// Активность и стрик — записи в activity_log (Фаза 3).
//   logActivity()   — засчитать занятие (никогда не бросает ошибок)
//   getStreak()     — сколько дней подряд занимался
//   getTodayTypes() — какие типы занятий уже сделаны сегодня
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
