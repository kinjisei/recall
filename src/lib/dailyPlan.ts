// ============================================================================
// План дня — работа с БД (настройка учителя в teacher_students.daily_plan).
// Чистая логика построения плана — lib/dailyPlanCore (тестируется отдельно).
// ============================================================================
import { supabase, requireUserId } from './supabase'
import type { DailyPlanConfig, PlanKind } from './dailyPlanCore'
export * from './dailyPlanCore'


/** Настройка плана от учителя (первого, кто её задал). null — дефолт. */
export async function getMyDailyPlanConfig(): Promise<DailyPlanConfig | null> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('teacher_students')
    .select('daily_plan')
    .eq('student_id', userId)
    .not('daily_plan', 'is', null)
    .limit(1)
    .maybeSingle()
  if (error || !data?.daily_plan) return null
  const raw = data.daily_plan as { kinds?: unknown; auto?: unknown }
  const valid: PlanKind[] = ['reader', 'grammar', 'pronunciation', 'conversation']
  const kinds = Array.isArray(raw.kinds)
    ? (raw.kinds.filter((k) => valid.includes(k as PlanKind)) as PlanKind[])
    : []
  return { kinds, auto: raw.auto !== false }
}

/** Учителю: текущая настройка плана ученицы. */
export async function getStudentDailyPlan(studentId: string): Promise<DailyPlanConfig | null> {
  const teacherId = await requireUserId()
  const { data, error } = await supabase
    .from('teacher_students')
    .select('daily_plan')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (error || !data?.daily_plan) return null
  const raw = data.daily_plan as { kinds?: PlanKind[]; auto?: boolean }
  return { kinds: raw.kinds ?? [], auto: raw.auto !== false }
}

/** Учителю: сохранить план (null — вернуть умный дефолт). */
export async function setDailyPlan(
  studentId: string,
  cfg: DailyPlanConfig | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_daily_plan', {
    p_student_id: studentId,
    p_plan: cfg,
  })
  if (error) throw new Error(error.message)
}
