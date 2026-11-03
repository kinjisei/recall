// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Задания ученика по материалам: список с материалами и сдача работы. Отдельно
// от lib/materials (генерация, промпты, проверка) — его зовут Главная и
// «Учёба» ученика, и с генерацией в стартовую загрузку ехали все промпты и
// правила упражнений (Ф2.25-1б: ~10 КБ на каждого ученика).
// ============================================================================
import { supabase, requireUserId, toJson } from '../shared/api/supabase'
import { dbError } from '../shared/api/errors'
import type { AssignmentAnswer, Material, MaterialAssignment } from '../types'

/** Задания текущего ученика вместе с материалами. */
export async function getMyAssignments(): Promise<
  (MaterialAssignment & { material: Material })[]
> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('material_assignments')
    .select('*, materials(*)')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as (MaterialAssignment & { materials: Material | null })[])
    .filter((row) => row.materials)
    .map(({ materials, ...a }) => ({ ...(a as MaterialAssignment), material: materials as Material }))
}

/**
 * Ученик сдаёт работу: ответы + авто-балл, статус submitted (через RPC).
 * `version` — версия упражнений, на которые он отвечал: учитель уже поправил —
 * отказ с кодом RECALL_MATERIAL_CHANGED (миграция 0018), экран берёт новую.
 */
export async function submitAssignment(
  assignmentId: string,
  answers: AssignmentAnswer[],
  autoScore: number,
  autoTotal: number,
  version?: number,
): Promise<void> {
  const { error } = await supabase.rpc('submit_material', {
    p_id: assignmentId,
    p_answers: toJson(answers),
    p_auto_score: autoScore,
    p_auto_total: autoTotal,
    p_version: version,
  })
  if (error) throw dbError(error, 'отправить работу')
}
