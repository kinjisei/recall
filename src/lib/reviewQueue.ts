// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Очередь проверки учителя (PLAN.md Ф2.10, Ф2.17-4в-1): сданные учениками и не
// проверенные работы — задания по материалам и письма. Одно место на счётчик
// вкладки «Задания» в меню, список «Проверки работ» и «последняя работа» для
// «Всё проверено»: два числа про одно и то же, посчитанные разными условиями,
// разойдутся — и учитель перестанет верить обоим. Условия везде одни: работа
// по МОЕМУ материалу или заданию, а ученик — не я (RLS отдаёт и назначения,
// где учитель сам ученик у коллеги). Сбой — исключение, а не «0» (Ф1.13).
// Модуль лёгкий — счётчик меню берёт его в стартовый код каркаса.
// ============================================================================
import { supabase, requireUserId } from '../shared/api/supabase'
import { displayNames } from './profile'
import type { Material, MaterialAssignment, WritingTask, WritingTaskAssignment } from '../types'

// ---- задания по материалам ---------------------------------------------------

/** Ждут проверки (вкладка «Задания»): мои материалы, не мои работы — RLS отдаёт и те, где я ученик. Сбой — бросает. */
export async function countSubmittedWorks(): Promise<number> {
  const userId = await requireUserId()
  const { count, error } = await supabase
    .from('material_assignments')
    .select('id, materials!inner(teacher_id)', { count: 'exact', head: true })
    .eq('status', 'submitted')
    .eq('materials.teacher_id', userId)
    .neq('student_id', userId)
  if (error) throw error
  return count ?? 0
}

/**
 * Когда сдана последняя уже проверенная работа по моим материалам — «Всё
 * проверено · последняя работа — вчера» (хаб «Заданий», макет d7-1). Сбой —
 * исключение.
 */
export async function lastReviewedWorkAt(): Promise<string | null> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('material_assignments')
    .select('submitted_at, materials!inner(teacher_id)')
    .eq('status', 'reviewed')
    .eq('materials.teacher_id', userId)
    .neq('student_id', userId)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0]?.submitted_at ?? null
}

/** Сданная работа для списка «На проверку»: кто, какой материал, когда. */
export interface SubmittedWork {
  assignment: MaterialAssignment
  material: Material
  studentName: string
}

/**
 * Все сданные работы преподавателя разом (для блока «На проверку» во вкладке
 * «Материалы»). Раньше бейдж показывал только число — преподаватель не видел,
 * КТО сдал и ЧТО именно проверять, пока не откроет каждый материал вручную.
 */
export async function listSubmittedWorks(): Promise<SubmittedWork[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('material_assignments')
    .select('*, materials!inner(*)')
    .eq('status', 'submitted')
    .eq('materials.teacher_id', userId)
    .neq('student_id', userId)
    .order('submitted_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as (MaterialAssignment & { materials: Material | null })[]
  if (rows.length === 0) return []

  const names = await displayNames([...new Set(rows.map((r) => r.student_id))])

  return rows
    .filter((r) => r.materials)
    .map(({ materials, ...assignment }) => ({
      assignment,
      material: materials as Material,
      studentName: names.get(assignment.student_id) ?? 'Ученик',
    }))
}

// ---- письма --------------------------------------------------------------------

/**
 * Сколько писем учеников ждут проверки (счётчик вкладки «Задания», Ф2.10).
 * Только по своим заданиям и не свои — как countSubmittedWorks; сбой —
 * исключение, а не «0» (Ф1.13).
 */
export async function countSubmittedWriting(): Promise<number> {
  const userId = await requireUserId()
  const { count, error } = await supabase
    .from('writing_task_assignments')
    .select('id, writing_tasks!inner(teacher_id)', { count: 'exact', head: true })
    .eq('status', 'submitted')
    .eq('writing_tasks.teacher_id', userId)
    .neq('student_id', userId)
  if (error) throw error
  return count ?? 0
}

/** Когда сдано последнее уже проверенное письмо (хаб «Заданий», d7-1). Сбой — исключение. */
export async function lastReviewedWritingAt(): Promise<string | null> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('writing_task_assignments')
    .select('submitted_at, writing_tasks!inner(teacher_id)')
    .eq('status', 'reviewed')
    .eq('writing_tasks.teacher_id', userId)
    .neq('student_id', userId)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0]?.submitted_at ?? null
}

/** Сданное письмо для «Проверки работ»: кто, какое задание, когда. */
export interface SubmittedWriting {
  assignment: WritingTaskAssignment
  task: WritingTask
  studentName: string
}

/**
 * Все сданные и не проверенные письма учеников разом — для «Проверки работ»
 * во «Заданиях» (Ф2.10). Раньше письмо, ждущее проверки, искали, открывая
 * задания по одному: в списке заданий не видно, где кто-то сдал.
 */
export async function listSubmittedWriting(): Promise<SubmittedWriting[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('writing_task_assignments')
    .select('*, writing_tasks!inner(*)')
    .eq('status', 'submitted')
    .eq('writing_tasks.teacher_id', userId)
    .neq('student_id', userId)
    .order('submitted_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as (WritingTaskAssignment & { writing_tasks: WritingTask })[]
  const names = await displayNames([...new Set(rows.map((r) => r.student_id))])
  return rows.map(({ writing_tasks, ...assignment }) => ({
    assignment: assignment as WritingTaskAssignment,
    task: writing_tasks,
    studentName: names.get(assignment.student_id) ?? 'Ученик',
  }))
}
