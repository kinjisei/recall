// ============================================================================
// «Письмо»: письменные задания преподавателя (IELTS / обычное эссе). Механика —
// как материалы: writing_tasks / writing_task_assignments, RLS + RPC (schema.sql).
// 5a — создание/назначение; оценка и проверка — в 5b/5c.
// ============================================================================
import { supabase, requireUserId, toJson } from './supabase'
import { dbError } from './dbError'
import { chat } from './gemini'
import type {
  AppLang,
  CEFRLevel,
  ChartSpec,
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
  if (error) throw dbError(error, 'назначить письменное задание')
}

export async function unassignWritingTask(taskId: string, studentId: string): Promise<void> {
  const { error } = await supabase.rpc('unassign_writing_task', {
    p_task_id: taskId,
    p_student_id: studentId,
  })
  if (error) throw dbError(error, 'снять письменное задание')
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

/** Письменные задания текущего ученика вместе с самим заданием. */
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

/** Ученик сдаёт (или пересдаёт) письмо — essay + AI-оценка, статус submitted. */
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
  if (error) throw dbError(error, 'отправить письмо')
}

/** Преподаватель завершает проверку письма: свой вердикт + итоговый band. */
export async function finishWritingReview(
  assignmentId: string,
  review: WritingGrade,
  band: string,
): Promise<void> {
  const { error } = await supabase.rpc('finish_writing_review', {
    p_id: assignmentId,
    p_review: toJson(review),
    p_band: band,
  })
  if (error) throw dbError(error, 'сохранить проверку письма')
}

/** Переназначить письмо тому же ученику (текущий цикл уходит в историю). */
export async function reassignWriting(assignmentId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('reassign_writing', { p_id: assignmentId, p_note: note })
  if (error) throw dbError(error, 'переназначить письмо')
}

/** Сколько писем ждут проверки (для бейджа вкладки «Письмо» у преподавателя). */
export async function countSubmittedWriting(): Promise<number> {
  const { count, error } = await supabase
    .from('writing_task_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')
  if (error) return 0
  return count ?? 0
}

/** Сколько письменных заданий у ученика (для строки в «Учёбе»). */
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

// ---------------------------------------------------------------------------
// IELTS Academic Task 1: AI генерит ДАННЫЕ графика (не картинку), рисуем сами.
// ---------------------------------------------------------------------------

const KIND_RU: Record<ChartSpec['kind'], string> = {
  bar: 'столбчатая диаграмма',
  line: 'линейный график',
  pie: 'круговая диаграмма',
  table: 'таблица',
}

/** Санитайз данных графика от AI — гарантируем валидную структуру и числа. */
function sanitizeChart(raw: unknown, kind: ChartSpec['kind']): ChartSpec | null {
  const o = (raw ?? {}) as Record<string, unknown>
  const seriesRaw = Array.isArray(o.series) ? o.series : []
  const series = seriesRaw
    .slice(0, kind === 'pie' ? 1 : 4)
    .map((s) => {
      const so = (s ?? {}) as Record<string, unknown>
      const points = (Array.isArray(so.points) ? so.points : [])
        .slice(0, 12)
        .map((p) => {
          const po = (p ?? {}) as Record<string, unknown>
          const value = typeof po.value === 'number' && isFinite(po.value) ? po.value : NaN
          return { label: typeof po.label === 'string' ? po.label : '', value }
        })
        .filter((p) => p.label && !Number.isNaN(p.value))
      return { name: typeof so.name === 'string' && so.name ? so.name : 'Ряд', points }
    })
    .filter((s) => s.points.length >= 2)
  if (series.length === 0) return null
  // все ряды по числу точек равняем на первый (иначе оси разъедутся)
  const n = series[0]!.points.length
  for (const s of series) s.points = s.points.slice(0, n)
  return {
    kind,
    title: typeof o.title === 'string' && o.title ? o.title : 'Chart',
    xLabel: typeof o.xLabel === 'string' ? o.xLabel : undefined,
    yLabel: typeof o.yLabel === 'string' ? o.yLabel : undefined,
    unit: typeof o.unit === 'string' ? o.unit : undefined,
    series,
  }
}

/**
 * Задание IELTS Academic Task 1: AI придумывает вопрос + реалистичные данные
 * графика выбранного типа. Рисуем данные сами (ChartView). teacher-only (Pro).
 */
export async function generateChartTask(
  kind: ChartSpec['kind'],
  topic: string,
): Promise<{ prompt: string; chart: ChartSpec }> {
  const system = [
    'Ты — составитель заданий IELTS Academic Writing Task 1 (описание визуальных данных).',
    `Тип визуализации: ${KIND_RU[kind]} (kind: "${kind}").`,
    'Верни ТОЛЬКО валидный JSON без markdown:',
    `{"prompt":"...","chart":{"kind":"${kind}","title":"...","xLabel":"...","yLabel":"...","unit":"%","series":[{"name":"...","points":[{"label":"...","value":123}]}]}}`,
    'prompt — формулировка задания на английском в стиле IELTS: одно вводное предложение про то, что показывает график, затем «Summarise the information by selecting and reporting the main features, and make comparisons where relevant.»',
    'Данные РЕАЛИСТИЧНЫЕ и в разумном диапазоне; 4–8 точек по горизонтали; подписи короткие (годы, страны, категории).',
    kind === 'pie'
      ? 'pie: РОВНО один ряд, значения — доли, в сумме примерно 100 (unit "%").'
      : kind === 'table'
        ? 'table: 2–4 ряда (это столбцы таблицы), у всех одинаковые label точек (строки).'
        : 'bar/line: 1–3 ряда с ОДИНАКОВЫМ набором label точек. Укажи xLabel, yLabel, unit.',
    'Числа целые или с одним знаком после запятой.',
    topic.trim()
      ? `Тема данных: ${topic.trim()}.`
      : 'Тему выбери сам (население, продажи, температуры, доли рынка, интернет-пользователи и т.п.).',
  ].join('\n')

  const raw = await chat([{ role: 'user', content: 'Сгенерируй задание с данными.' }], {
    system,
    task: 'material',
  })
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error('AI вернул не-JSON. Попробуй ещё раз.')
  const o = JSON.parse(raw.slice(s, e + 1)) as { prompt?: string; chart?: unknown }
  const chart = sanitizeChart(o.chart, kind)
  if (!chart) throw new Error('AI не собрал корректные данные графика. Попробуй ещё раз.')
  const prompt =
    (typeof o.prompt === 'string' && o.prompt.trim()) ||
    'The chart below shows the given data. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.'
  return { prompt, chart }
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
