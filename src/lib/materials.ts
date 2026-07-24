// ============================================================================
// Материалы преподавателя: генерация текста с упражнениями через Gemini
// (двухшаговая: план → материал) + хранение и назначение (Supabase).
// Таблицы materials / material_assignments, RLS — docs/schema.sql.
// ============================================================================
import { supabase, requireUserId } from './supabase'
import { chat } from './gemini'
import type {
  AppLang,
  AssignmentAnswer,
  CEFRLevel,
  Material,
  MaterialAssignment,
  MaterialExercise,
  MaterialPlan,
  ReviewItem,
} from '../types'

/** Заявка преподавателя (форма создания материала). */
export interface MaterialRequest {
  lang: AppLang
  level: CEFRLevel
  topic: string
  format: string
  lengthRange: '50-100' | '100-250' | '250-350'
  vocabulary: string
  grammar: string
}

export const MATERIAL_FORMATS = [
  'сказка',
  'рассказ',
  'новости',
  'диалог двух людей',
  'письмо / email',
  'статья блога',
  'интервью',
] as const

export const MATERIAL_LENGTHS = ['50-100', '100-250', '250-350'] as const

/** Достаёт JSON из ответа модели (терпит ```-обёртки и болтовню вокруг). */
function parseJson<T>(raw: string): T {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('AI вернул не-JSON. Попробуй ещё раз.')
  }
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    throw new Error('AI вернул повреждённый JSON. Попробуй ещё раз.')
  }
}

function requestDescription(req: MaterialRequest): string {
  return [
    `- Язык текста: ${req.lang === 'es' ? 'испанский' : 'английский'}`,
    `- Уровень ученика (CEFR): ${req.level}`,
    `- Тема текста: ${req.topic}`,
    `- Формат: ${req.format}`,
    `- Длина: ${req.lengthRange} слов`,
    `- Слова или тема словаря: ${req.vocabulary.trim() || 'не заданы (предложи сам 6-8 полезных слов по теме)'}`,
    `- Грамматическая тема: ${req.grammar.trim() || 'не задана'}`,
  ].join('\n')
}

function comprehensionRange(lengthRange: string): string {
  if (lengthRange === '50-100') return '3-5'
  if (lengthRange === '100-250') return '5-10'
  return '7-12'
}

/** Шаг 1: AI проверяет заявку и предлагает план материала. */
export async function generateMaterialPlan(
  req: MaterialRequest,
  feedback?: string,
): Promise<MaterialPlan> {
  const system = [
    'Ты — опытный методист по иностранным языкам в приложении Recall.',
    'Твоя задача — СПЛАНИРОВАТЬ учебный текст с упражнениями по заявке преподавателя.',
    'Проверь заявку: подходят ли слова и грамматика заявленному уровню; если нет — предложи замены.',
    'Отвечай ТОЛЬКО валидным JSON без markdown и пояснений вокруг.',
    '',
    'Формат ответа:',
    '{',
    '  "comments": "по-русски, 2-4 предложения: что проверил, что предлагаешь заменить/добавить и почему",',
    '  "vocabulary": ["6-10 целевых слов на целевом языке, скорректированных под уровень"],',
    '  "grammar_focus": "итоговая грамматическая тема" | null,',
    '  "exercise_plan": [',
    '    {"kind":"comprehension","type":"mcq","count":N,"note":"вопросы по смыслу текста"},',
    '    {"kind":"grammar","type":"fill","count":N,"note":"что именно тренируем"},',
    '    {"kind":"vocab","type":"mcq","count":N,"note":"матч: определение слова → выбор из 4 слов"}',
    '  ]',
    '}',
    '',
    `Правила: вопросов на понимание (comprehension) — ${comprehensionRange(req.lengthRange)} (длина текста ${req.lengthRange} слов).`,
    'Грамматических и словарных упражнений — по 4-6, если тема/слова заданы; kind "grammar" пропусти, если грамматика не задана.',
  ].join('\n')

  const userMsg = [
    'Заявка преподавателя:',
    requestDescription(req),
    feedback ? `\nПравки преподавателя к прошлому плану: ${feedback}` : '',
  ].join('\n')

  // генерация материалов — сложная составная задача: Pro-уровень моделей
  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: 'material' })
  const plan = parseJson<MaterialPlan>(raw)
  if (!Array.isArray(plan.exercise_plan) || !Array.isArray(plan.vocabulary)) {
    throw new Error('AI вернул неполный план. Попробуй ещё раз.')
  }
  return plan
}

export interface MaterialContent {
  title: string
  body: string
  exercises: MaterialExercise[]
}

/** Шаг 2: полная генерация текста и упражнений по утверждённому плану. */
export async function generateMaterialContent(
  req: MaterialRequest,
  plan: MaterialPlan,
  feedback?: string,
): Promise<MaterialContent> {
  const langName = req.lang === 'es' ? 'испанском' : 'английском'
  const system = [
    'Ты — автор учебных материалов по иностранным языкам.',
    'Создай текст и упражнения по заявке и утверждённому плану.',
    'Отвечай ТОЛЬКО валидным JSON без markdown.',
    '',
    'Формат ответа:',
    '{',
    `  "title": "заголовок на ${langName}",`,
    `  "body": "сам текст на ${langName}; абзацы разделяй \\n\\n; в диалоге каждая реплика с новой строки: Имя: реплика",`,
    '  "exercises": [',
    '    {"kind":"comprehension","type":"mcq","prompt":"вопрос по смыслу на целевом языке","options":["A","B","C","D"],"answer":0},',
    '    {"kind":"grammar","type":"fill","prompt":"предложение ИЗ текста с пропуском ___","answer":"пропущенная часть","hint":"подсказка по-русски"},',
    '    {"kind":"vocab","type":"mcq","prompt":"определение/объяснение целевого слова НА ЦЕЛЕВОМ ЯЗЫКЕ (само слово не называть!)","options":["слово1","слово2","слово3","слово4"],"answer":0}',
    '  ]',
    '}',
    '',
    'Жёсткие требования:',
    `1. Длина текста — строго ${req.lengthRange} слов, уровень языка — строго ${req.level}.`,
    '2. Все целевые слова из плана должны встретиться в тексте.',
    '3. Если задана грамматическая тема — конструкция используется в тексте несколько раз.',
    '4. ВСЕ упражнения строго по содержанию текста. Вопросы comprehension — смысловые (не «какое слово было в тексте»), неправильные варианты правдоподобны, ровно 4 options, answer — индекс 0-3.',
    '5. Количество упражнений каждого вида — по плану.',
    '6. В fill ответ (answer) — ровно то, что пропущено в prompt на месте ___.',
    '7. Словарные (vocab) — матч по определению: prompt — простое определение слова на целевом языке (уровня ученика, БЕЗ самого слова), options — 4 слова: правильное + 3 других слова из текста или того же уровня, answer — индекс правильного.',
    '8. Порядок упражнений: сначала comprehension, потом grammar, потом vocab.',
  ].join('\n')

  const userMsg = [
    'Заявка:',
    requestDescription(req),
    '',
    'Утверждённый план:',
    JSON.stringify(plan),
    feedback ? `\nПравки преподавателя: ${feedback}` : '',
  ].join('\n')

  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: 'material' })
  const content = parseJson<MaterialContent>(raw)

  // Валидация: выбрасываем битые упражнения, требуем минимум приличный набор.
  const valid = (content.exercises ?? []).filter((e) => {
    if (!e || typeof e !== 'object') return false
    if (e.type === 'mcq') {
      return (
        typeof e.prompt === 'string' &&
        Array.isArray(e.options) &&
        e.options.length >= 2 &&
        typeof e.answer === 'number' &&
        e.answer >= 0 &&
        e.answer < e.options.length
      )
    }
    if (e.type === 'fill') {
      return typeof e.prompt === 'string' && typeof e.answer === 'string' && e.answer.length > 0
    }
    return false
  })
  if (!content.title || !content.body || valid.length < 3) {
    throw new Error('AI вернул неполный материал. Нажми «Генерировать» ещё раз.')
  }
  return { title: content.title, body: content.body, exercises: valid }
}

// ---------------------------------------------------------------------------
// Хранение и назначение.
// ---------------------------------------------------------------------------

export async function saveMaterial(
  req: MaterialRequest,
  plan: MaterialPlan,
  content: MaterialContent,
): Promise<Material> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('materials')
    .insert({
      teacher_id: userId,
      lang: req.lang,
      level: req.level,
      topic: req.topic,
      format: req.format,
      length_range: req.lengthRange,
      title: content.title,
      body: content.body,
      exercises: content.exercises,
      plan,
    })
    .select()
    .single()
  if (error) throw error
  return data as Material
}

export async function listMyMaterials(): Promise<Material[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Material[]
}

export async function deleteMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('materials').delete().eq('id', id)
  if (error) throw error
}

export async function assignMaterial(materialId: string, studentId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_material', {
    p_material_id: materialId,
    p_student_id: studentId,
  })
  if (error) throw new Error(error.message)
}

export async function unassignMaterial(materialId: string, studentId: string): Promise<void> {
  const { error } = await supabase.rpc('unassign_material', {
    p_material_id: materialId,
    p_student_id: studentId,
  })
  if (error) throw new Error(error.message)
}

/** Назначения одного материала (для карточки материала у преподавателя). */
export async function listMaterialAssignments(
  materialId: string,
): Promise<MaterialAssignment[]> {
  const { data, error } = await supabase
    .from('material_assignments')
    .select('*')
    .eq('material_id', materialId)
  if (error) throw error
  return (data ?? []) as MaterialAssignment[]
}

/** Задания текущей ученицы вместе с материалами. */
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

/** Ученица сдаёт работу: ответы + авто-балл, статус submitted (через RPC). */
export async function submitAssignment(
  assignmentId: string,
  answers: AssignmentAnswer[],
  autoScore: number,
  autoTotal: number,
): Promise<void> {
  const { error } = await supabase.rpc('submit_material', {
    p_id: assignmentId,
    p_answers: answers,
    p_auto_score: autoScore,
    p_auto_total: autoTotal,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Фаза B: проверка работ (AI-разбор → вердикты преподавателя).
// ---------------------------------------------------------------------------

/** Сколько сданных работ ждут проверки (для бейджа преподавателя). */
export async function countSubmittedWorks(): Promise<number> {
  // RLS отдаёт преподавателю только назначения его материалов
  const { count, error } = await supabase
    .from('material_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')
  if (error) return 0
  return count ?? 0
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
  const { data, error } = await supabase
    .from('material_assignments')
    .select('*, materials(*)')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as (MaterialAssignment & { materials: Material | null })[]
  if (rows.length === 0) return []

  // имена учениц одним запросом (RLS «linked profiles visible» разрешает)
  const ids = [...new Set(rows.map((r) => r.student_id))]
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ids)
  const names = new Map((profs ?? []).map((p) => [p.id as string, p.display_name as string | null]))

  return rows
    .filter((r) => r.materials)
    .map(({ materials, ...assignment }) => ({
      assignment,
      material: materials as Material,
      studentName: names.get(assignment.student_id) ?? 'Ученица',
    }))
}

/** AI-разбор сданной работы: вердикт и комментарий по каждому упражнению. */
export async function generateAiReview(
  material: Material,
  assignment: MaterialAssignment,
): Promise<ReviewItem[]> {
  const answers = assignment.answers ?? []
  const items = material.exercises.map((ex, i) => {
    const a = answers.find((x) => x.index === i)
    return {
      index: i,
      kind: ex.kind,
      prompt: ex.prompt,
      correct: ex.type === 'mcq' ? ex.options[ex.answer] : ex.type === 'fill' ? ex.answer : '',
      options: ex.type === 'mcq' ? ex.options : undefined,
      given: a?.given ?? '(нет ответа)',
      auto_ok: a?.auto_ok ?? false,
    }
  })

  const system = [
    'Ты — ассистент преподавателя иностранного языка: делаешь ПЕРВИЧНУЮ проверку работы ученика.',
    'Отвечай ТОЛЬКО валидным JSON без markdown:',
    '{"items":[{"index":0,"ok":true,"comment":"..."}]}',
    '',
    'Правила:',
    '- comment по-русски, 1-2 предложения;',
    '- если ответ НЕВЕРНЫЙ: объясни, что именно не так, и приведи правильный вариант;',
    '- если ответ верный: пустая строка или короткая похвала;',
    '- ok=true можно поставить даже там, где авто-проверка сочла ошибкой, если ответ по сути верен (мелкая опечатка, другой регистр, допустимый синоним) — поясни это в comment;',
    '- index — как в присланном списке; верни вердикт по КАЖДОМУ упражнению.',
  ].join('\n')

  const userMsg = [
    'Текст материала:',
    material.body,
    '',
    'Упражнения и ответы ученика:',
    JSON.stringify(items),
  ].join('\n')

  // разбор работы — не «мелочь», но и не генерация: средний уровень
  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: 'review' })
  const parsed = parseJson<{ items: ReviewItem[] }>(raw)
  if (!Array.isArray(parsed.items)) throw new Error('AI вернул неполный разбор.')
  // страховка: вердикт на каждое упражнение (чего нет — берём авто-результат)
  return material.exercises.map((_, i) => {
    const found = parsed.items.find((x) => x.index === i)
    if (found) return { index: i, ok: Boolean(found.ok), comment: found.comment ?? '' }
    const a = answers.find((x) => x.index === i)
    return { index: i, ok: a?.auto_ok ?? false, comment: '' }
  })
}

/** Сохранить черновик AI-разбора (чтобы не генерировать повторно; через RPC). */
export async function saveAiReview(
  assignmentId: string,
  review: ReviewItem[],
): Promise<void> {
  const { error } = await supabase.rpc('save_material_ai_review', {
    p_id: assignmentId,
    p_review: review,
  })
  if (error) throw new Error(error.message)
}

/** Финал проверки: вердикты преподавателя, статус reviewed (через RPC). */
export async function finishReview(
  assignmentId: string,
  review: ReviewItem[],
): Promise<void> {
  const { error } = await supabase.rpc('finish_material_review', {
    p_id: assignmentId,
    p_review: review,
  })
  if (error) throw new Error(error.message)
}

/**
 * Переназначить проверенный материал той же ученице: текущая работа уходит
 * в историю (attempts), назначение сбрасывается в assigned, note — комментарий
 * преподавателя «на что обратить внимание в этот раз». Снимок и сброс — на
 * сервере (RPC), чтобы клиент не мог подделать историю.
 */
export async function reassignAssignment(
  assignment: MaterialAssignment,
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('reassign_material', {
    p_id: assignment.id,
    p_note: note,
  })
  if (error) throw new Error(error.message)
}
