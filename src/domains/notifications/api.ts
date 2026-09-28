// ============================================================================
// Уведомления — единственное место, где домен ходит в базу (архитектура §2,
// §4). Читаем только свои (RLS), «прочитано» — через RPC: писать в таблицу
// напрямую не может никто (supabase/migrations/0002_notifications.sql).
// ============================================================================
import { supabase } from '../../shared/api/supabase'
import { dbError } from '../../shared/api/errors'
import type { AppNotification } from './model'

const COLUMNS = 'id, kind, data, created_at, read_at'

/** data в базе — jsonb; в ленту идёт только объект (иначе — пустой). */
function toData(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** Последние уведомления, свежие сверху. */
export async function loadNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw dbError(error, 'загрузить уведомления')
  return (data ?? []).map((r) => ({ ...r, data: toData(r.data) }))
}

/**
 * Сколько всего и сколько непрочитанных — двумя «пустыми» запросами (только
 * счёт, без строк): колокольчик спрашивает это на каждом возвращении в
 * приложение, тянуть ради цифры саму ленту незачем.
 */
export async function notificationCounts(): Promise<{ total: number; unread: number }> {
  const [all, unread] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ])
  if (all.error) throw dbError(all.error, 'узнать про уведомления')
  if (unread.error) throw dbError(unread.error, 'узнать про уведомления')
  return { total: all.count ?? 0, unread: unread.count ?? 0 }
}

/** Отметить прочитанными: все свои или только эти. Сколько отмечено. */
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('mark_notifications_read', ids ? { p_ids: ids } : {})
  if (error) throw dbError(error, 'отметить уведомления прочитанными')
  return data ?? 0
}
