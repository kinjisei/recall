// ============================================================================
// Уроки глазами ученика — слой данных (PLAN.md Ф2.9; журнал п.32, 33, 43):
// «Мои уроки» и тихий остаток. Отдельным файлом от api.ts, где всё учительское
// расписание: Главную открывает каждый ученик, и без этого в её стартовый
// бандл уезжали бы все учительские запросы (модуль попадает в бандл целиком).
// ============================================================================
import { supabase } from '../../shared/api/supabase'
import { dbError } from '../../shared/api/errors'
import type { LessonKind, LessonStatus, MyLesson, MyLessonBalance } from './model'

/** «Мои уроки» за период: только свои, без других участников. */
export async function loadMyLessons(from: Date, to: Date): Promise<MyLesson[]> {
  const { data, error } = await supabase.rpc('get_my_lessons', { p_from: from.toISOString(), p_to: to.toISOString() })
  if (error) throw dbError(error, 'загрузить уроки')
  return (data ?? []).map((r) => ({
    id: r.lesson_id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    kind: r.kind as LessonKind,
    status: r.status as LessonStatus,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    title: r.title ?? null,
    link: r.link ?? null,
    movedFrom: r.moved_from ?? null,
    version: r.version,
  }))
}

/** Остаток оплаченных уроков ученику — по каждому учителю, без минуса. */
export async function loadMyLessonBalances(): Promise<MyLessonBalance[]> {
  const { data, error } = await supabase.rpc('get_my_lesson_balances')
  if (error) throw dbError(error, 'загрузить остаток уроков')
  return (data ?? []).map((r) => ({
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    tracked: r.tracked === true,
    lessonsLeft: r.lessons_left,
  }))
}
