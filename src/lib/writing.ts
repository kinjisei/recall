// ============================================================================
// «Письмо»: письменные задания преподавателя (IELTS / обычное эссе). Механика —
// как материалы: writing_tasks / writing_task_assignments, RLS + RPC (schema.sql).
// 5a — создание/назначение; оценка и проверка — в 5b/5c.
// ============================================================================
import { supabase, requireUserId, toJson } from './supabase'
import { chat } from './gemini'
import type {
  AppLang,
  CEFRLevel,
  WritingGrade,
  WritingMode,
  WritingSettings,
  WritingTask,
  WritingTaskAssignment,
} from '../types'

export interface WritingTaskInput {
  lang: AppLang
  mode: WritingMode
  level: CEFRLevel
  prompt: string
  settings: WritingSettings
}

/** Создать письменное задание (прямая вставка — RLS teacher_id = auth.uid()). */
export async function createWritingTask(input: WritingTaskInput): Promise<WritingTask> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('writing_tasks')
    .insert({
      teacher_id: userId,
      lang: input.lang,
      mode: input.mode,
      level: input.level,
      prompt: input.prompt,
      settings: toJson(input.settings),
    })
    .select()
    .single()
  if (error) throw error
  return data as WritingTask
}

export async function listMyWritingTasks(): Promise<WritingTask[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('writing_tasks')
    .select('*')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WritingTask[]
}

export async function deleteWritingTask(id: string): Promise<void> {
  const { error } = await supabase.from('writing_tasks').delete().eq('id', id)
  if (error) throw error
}

export async function assignWritingTask(taskId: string, studentId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_writing_task', {
    p_task_id: taskId,
    p_student_id: studentId,
  })
  if (error) throw new Error(error.message)
}

export async function unassignWritingTask(taskId: string, studentId: string): Promise<void> {
  const { error } = await supabase.rpc('unassign_writing_task', {
    p_task_id: taskId,
    p_student_id: studentId,
  })
  if (error) throw new Error(error.message)
}

/** Назначения одного задания (для карточки задания у преподавателя). */
export async function listWritingAssignments(taskId: string): Promise<WritingTaskAssignment[]> {
  const { data, error } = await supabase
    .from('writing_task_assignments')
    .select('*')
    .eq('task_id', taskId)
  if (error) throw error
  return (data ?? []) as WritingTaskAssignment[]
}

/** Письменные задания текущей ученицы вместе с самим заданием. */
export async function getMyWritingAssignments(): Promise<
  (WritingTaskAssignment & { task: WritingTask })[]
> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('writing_task_assignments')
    .select('*, writing_tasks(*)')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as (WritingTaskAssignment & { writing_tasks: WritingTask | null })[])
    .filter((row) => row.writing_tasks)
    .map(({ writing_tasks, ...a }) => ({ ...(a as WritingTaskAssignment), task: writing_tasks as WritingTask }))
}

/** Ученица сдаёт (или пересдаёт) письмо — essay + AI-оценка, статус submitted. */
export async function submitWriting(
  assignmentId: string,
  essay: string,
  grade: WritingGrade,
  band: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_writing', {
    p_id: assignmentId,
    p_essay: essay,
    p_grade: toJson(grade),
    p_band: band,
  })
  if (error) throw new Error(error.message)
}

/** Сколько письменных заданий у ученицы (для строки в «Учёбе»). */
export async function countMyWritingTasks(): Promise<{ total: number; pending: number }> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('writing_task_assignments')
    .select('status')
    .eq('student_id', userId)
  if (error) return { total: 0, pending: 0 }
  const rows = data ?? []
  return {
    total: rows.length,
    // «новых» — ещё не сдавала (assigned) либо учитель переназначил (тоже assigned)
    pending: rows.filter((r) => r.status === 'assigned').length,
  }
}

/** Опционально: AI придумывает вопрос IELTS (teacher-only, task material). */
export async function generateIeltsQuestion(ieltsTask: 'task2' | 'gt1'): Promise<string> {
  const kind =
    ieltsTask === 'task2'
      ? 'IELTS Writing Task 2 (эссе-рассуждение на английском)'
      : 'IELTS General Training Task 1 (письмо на английском)'
  const system = [
    `Придумай ОДИН реалистичный экзаменационный вопрос для ${kind}.`,
    ieltsTask === 'task2'
      ? 'Task 2: спорное утверждение или вопрос в стиле IELTS (например «…To what extent do you agree or disagree?» или «Discuss both views and give your opinion»). Верни только сам вопрос на английском.'
      : 'General Training Task 1: короткая ситуация + строка «You should include:» с тремя пунктами (что осветить в письме), в стиле IELTS, на английском.',
    'Верни ТОЛЬКО текст задания, без пояснений и кавычек вокруг.',
  ].join('\n')
  const raw = await chat([{ role: 'user', content: 'Сгенерируй задание.' }], {
    system,
    task: 'material',
  })
  return raw.trim().replace(/^["'«»]+|["'«»]+$/g, '').trim()
}
