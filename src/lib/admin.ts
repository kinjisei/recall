// ============================================================================
// Мини-админка владельца: поиск пользователя по email + включение/продление
// платного плана вручную (после Kaspi-перевода). Обёртка над двумя RPC
// (docs/schema.sql, блок «Админ-RPC (только is_admin)») — вся защита на
// сервере, здесь только вызовы и человеко-читаемые ошибки.
// ============================================================================
import { supabase } from './supabase'

export type PlanId = 'free' | 'premium' | 'teacher_mini' | 'teacher_start' | 'teacher_pro'

/** Одна строка результата поиска (admin_find_user). */
export interface AdminUserRow {
  id: string
  email: string
  display_name: string | null
  plan: PlanId
  plan_expires_at: string | null
  trial_until: string | null
}

/** Ответ admin_set_plan — свежие plan/plan_expires_at для обновления строки. */
export interface AdminSetPlanResult {
  id: string
  plan: PlanId
  plan_expires_at: string | null
}

/** Коды ошибок RPC → понятный текст на русском. */
function humanError(message: string): string {
  if (message.includes('RECALL_NOT_ADMIN')) return 'Доступно только владельцу'
  if (message.includes('RECALL_BAD_PLAN')) return 'Неизвестный план'
  if (message.includes('RECALL_NO_AUTH')) return 'Нужно войти заново'
  return message || 'Что-то пошло не так'
}

/** Найти пользователей по email (частичное совпадение, до 10 штук). */
export async function findUsers(q: string): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_find_user', { q })
  if (error) throw new Error(humanError(error.message))
  return (data ?? []) as AdminUserRow[]
}

/** Включить/продлить/снять план пользователю на N месяцев (0 или 'free' — снять). */
export async function setPlan(
  target: string,
  plan: PlanId,
  months: number,
): Promise<AdminSetPlanResult> {
  const { data, error } = await supabase.rpc('admin_set_plan', {
    target,
    new_plan: plan,
    months,
  })
  if (error) throw new Error(humanError(error.message))
  return data as AdminSetPlanResult
}
