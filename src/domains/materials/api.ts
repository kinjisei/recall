// ============================================================================
// Материалы — запись правки и копии (PLAN.md Ф2.25-3б, миграция 0018).
// Прямой UPDATE `materials` у клиента закрыт: правка и копия — функциями базы,
// они сами проверяют, что материал твой. Замок сданного держит база
// (RECALL_MATERIAL_LOCKED), экран узнаёт отказ по `AppError.code`.
// Остальное про материалы с базой (генерация, сохранение, выдачи) — в
// `lib/materials` до переезда (PLAN.md Ф3); новое — сюда.
// ============================================================================
import { supabase, toJson } from '../../shared/api/supabase'
import { dbError } from '../../shared/api/errors'
import type { MaterialExercise } from '../../types'

/**
 * Сохранить упражнения материала из библиотеки; ответ — новая версия.
 * `version` — та, которую видел экран: правили в другой вкладке —
 * RECALL_MATERIAL_STALE; работу уже сдали — RECALL_MATERIAL_LOCKED.
 */
export async function saveMaterialExercises(id: string, exercises: MaterialExercise[], version: number): Promise<number> {
  const { data, error } = await supabase.rpc('save_material_exercises', {
    p_id: id,
    p_exercises: toJson(exercises),
    p_version: version,
  })
  if (error) throw dbError(error, 'сохранить упражнения')
  return data
}

/** «Сделать копию и править»: новый материал без выдач; ответ — его id. */
export async function copyMaterial(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('copy_material', { p_id: id })
  if (error) throw dbError(error, 'сделать копию')
  return data
}
