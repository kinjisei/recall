// ============================================================================
// Аккаунт целиком — единственное место, где домен ходит в базу (архитектура
// §2, §4): выгрузка и удаление (миграция 0016, PLAN.md Ф2.17-4г-2б).
//
// Удаление: вход паролем заново (он создаёт новую сессию) и сразу
// delete_my_account — база удаляет только из сессии моложе 10 минут, так что
// без пароля из чужого открытого окна или по украденному токену аккаунт не
// удалить, даже позвав функцию в обход экрана.
// ============================================================================
import { AppError, dbError } from '../../shared/api/errors'
import { supabase } from '../../shared/api/supabase'

/** Всё своё одним ответом базы (export_my_data). */
export async function loadMyExport(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('export_my_data')
  if (error) throw dbError(error, 'собрать выгрузку')
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('База вернула пустую выгрузку — попробуй ещё раз.')
  return data as Record<string, unknown>
}

/** Пароль → удалить аккаунт насовсем. Бросает с текстом для человека. */
export async function deleteMyAccount(email: string, password: string): Promise<void> {
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (signInErr) {
    if (/invalid login credentials/i.test(signInErr.message)) throw new AppError('Пароль неверный.', 'RECALL_BAD_PASSWORD')
    throw dbError(signInErr, 'проверить пароль')
  }
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw dbError(error, 'удалить аккаунт')
}
