// ============================================================================
// Тест уровня, назначенный преподавателем.
// Раньше уровень можно было только попросить пройти на словах, а результат по
// испанскому оставался в localStorage ученицы — учитель его не видел.
// Таблица placement_requests + RPC (docs/schema.sql, блок «ТЕСТ УРОВНЯ ОТ
// ПРЕПОДАВАТЕЛЯ»): запись только через функции, чтение — обеим сторонам.
// ============================================================================
import { supabase, requireUserId } from './supabase'
import type { AppLang, CEFRLevel } from '../types'

export interface PlacementRequest {
  id: string
  teacher_id: string
  student_id: string
  lang: AppLang
  status: 'assigned' | 'done'
  result_level: CEFRLevel | null
  created_at: string
  completed_at: string | null
}

/** Преподаватель назначает тест своей ученице. */
export async function assignPlacement(studentId: string, lang: AppLang): Promise<void> {
  const { error } = await supabase.rpc('assign_placement', {
    p_student_id: studentId,
    p_lang: lang,
  })
  if (error) throw new Error(error.message)
}

/** Преподаватель снимает тест (или убирает старый результат из списка). */
export async function cancelPlacement(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_placement', { p_id: id })
  if (error) throw new Error(error.message)
}

/** Все тесты, назначенные этой ученице (для карточки у преподавателя). */
export async function listPlacements(studentId: string): Promise<PlacementRequest[]> {
  const { data, error } = await supabase
    .from('placement_requests')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as PlacementRequest[]
}

/**
 * Незакрытая просьба пройти тест — для строки в «Учёбе» у ученицы.
 * null, если теста никто не назначал.
 */
export async function myPendingPlacement(lang: AppLang): Promise<PlacementRequest | null> {
  try {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('placement_requests')
      .select('*')
      .eq('student_id', userId)
      .eq('lang', lang)
      .eq('status', 'assigned')
      .limit(1)
    if (error) return null
    return ((data ?? [])[0] as PlacementRequest) ?? null
  } catch {
    return null
  }
}

/**
 * Ученица закончила тест — закрываем просьбу и отдаём результат преподавателю.
 * Тихо игнорирует ошибки: тест мог никто не назначать, и это норма.
 * Возвращает true, если просьба действительно была закрыта.
 */
export async function reportPlacementResult(
  lang: AppLang,
  level: CEFRLevel,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('submit_placement', {
      p_lang: lang,
      p_level: level,
    })
    return !error && typeof data === 'number' && data > 0
  } catch {
    return false
  }
}
