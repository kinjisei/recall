// ============================================================================
// Мини-админка владельца: поиск пользователя по email + включение/продление
// платного плана вручную (после Kaspi-перевода). Обёртка над двумя RPC
// (docs/schema.sql, блок «Админ-RPC (только is_admin)») — вся защита на
// сервере, здесь только вызовы и человеко-читаемые ошибки.
// ============================================================================
import { supabase } from './supabase'
import { dbError } from './dbError'
import { track } from './analytics'

export type PlanId = 'free' | 'premium' | 'teacher_mini' | 'teacher_start' | 'teacher_pro'

/** Одна строка результата поиска (admin_find_user). */
export interface AdminUserRow {
  id: string
  email: string
  display_name: string | null
  plan: PlanId
  plan_expires_at: string | null
  trial_until: string | null
  /** Роль в приложении; появилось вместе с самостоятельной выдачей роли (A1). */
  role?: 'learner' | 'teacher'
  /** Сколько учеников уже привязано — виден риск «набрал бесплатно, купил младший тариф». */
  students?: number
  /** Мест по текущему тарифу; null — без ограничения. */
  seats?: number | null
}

/** Ответ admin_set_plan — свежие plan/plan_expires_at для обновления строки. */
export interface AdminSetPlanResult {
  id: string
  plan: PlanId
  plan_expires_at: string | null
}

// Коды RECALL_NOT_ADMIN / RECALL_BAD_PLAN / RECALL_NO_AUTH переводит общий
// dbError — отдельная таблица переводов здесь больше не нужна.

/** Найти пользователей по email (частичное совпадение, до 10 штук). */
export async function findUsers(q: string): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_find_user', { q })
  if (error) throw dbError(error, 'найти пользователя')
  // RPC возвращает json (схема не описывает его форму) — честный мост через unknown
  return (data ?? []) as unknown as AdminUserRow[]
}

/** Включить/продлить/снять план пользователю на N месяцев (0 или 'free' — снять). */
export async function setPlan(
  target: string,
  plan: PlanId,
  months: number,
): Promise<AdminSetPlanResult> {
  // конец воронки: событие пишется от имени владельца, но по user_id клиента
  // его можно связать с источником, из которого этот человек пришёл
  void track('payment_activated', { plan, months, target })
  const { data, error } = await supabase.rpc('admin_set_plan', {
    target,
    new_plan: plan,
    months,
  })
  if (error) throw dbError(error, 'изменить тариф')
  return data as unknown as AdminSetPlanResult
}

/** Ошибка у пользователей, сгруппированная по «где + текст». */
export interface ClientErrorRow {
  where_: string | null
  message: string | null
  times: number
  people: number
  last_at: string
  last_path: string | null
  last_stack: string | null
  any_online: boolean
}

/**
 * Ошибки с прода за последние дни (RPC admin_recent_errors, только владельцу).
 *
 * ⚠️ Приведение типа — потому что database.types.ts сгенерированы до появления
 * этой функции. После заливки схемы типы стоит перегенерировать (ARCHITECTURE
 * §5), и приведение уйдёт. Держим его ЗДЕСЬ, чтобы не размазывать по экрану.
 */
export async function listRecentErrors(days = 7, limit = 50): Promise<ClientErrorRow[]> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )('admin_recent_errors', { p_days: days, p_limit: limit })
  // последнее место в src/lib, где сырой текст postgrest уходил на экран
  if (error) throw dbError(error, 'загрузить журнал ошибок')
  return (data as ClientErrorRow[] | null) ?? []
}
