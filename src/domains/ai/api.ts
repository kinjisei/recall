// ============================================================================
// Расход AI — единственное место, где домен ходит в базу (архитектура §2).
// Журнал вызовов закрыт для чтения всем; сводку отдают две RPC только
// владельцу (supabase/migrations/0003_ai_call_log.sql).
// ============================================================================
import { supabase } from '../../shared/api/supabase'
import { dbError } from '../../shared/api/errors'
import type { ModelDay, TaskDay } from './model'

/** Сводка за последние `days` суток Google: попытки по моделям и вызовы по задачам. */
export async function loadAiUsage(days: number): Promise<{ models: ModelDay[]; tasks: TaskDay[] }> {
  const [models, tasks] = await Promise.all([
    supabase.rpc('admin_ai_usage', { p_days: days }),
    supabase.rpc('admin_ai_tasks', { p_days: days }),
  ])
  if (models.error) throw dbError(models.error, 'загрузить расход AI')
  if (tasks.error) throw dbError(tasks.error, 'загрузить расход AI')
  return { models: models.data ?? [], tasks: tasks.data ?? [] }
}
