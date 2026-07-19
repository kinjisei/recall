// ============================================================================
// Материалы преподавателя: генерация текста с упражнениями через Gemini
// (двухшаговая: план → материал) + хранение и назначение (Supabase).
// Таблицы materials / material_assignments, RLS — docs/schema.sql.
// ============================================================================
import { supabase } from './supabase'
import { chat } from './gemini'
import type {
  AppLang,
  AssignmentAnswer,
  CEFRLevel,
  Material,
  MaterialAssignment,
  MaterialExercise,
  MaterialPlan,
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

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Нет авторизации')
  return user.id
}

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
    '    {"kind":"vocab","type":"fill","count":N,"note":"что именно тренируем"}',
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

  const raw = await chat([{ role: 'user', content: userMsg }], { system })
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
    '    {"kind":"vocab","type":"fill","prompt":"предложение из текста с пропущенным целевым словом ___","answer":"слово","hint":"русский перевод слова"}',
    '  ]',
    '}',
    '',
    'Жёсткие требования:',
    `1. Длина текста — строго ${req.lengthRange} слов, уровень языка — строго ${req.level}.`,
    '2. Все целевые слова из плана должны встретиться в тексте.',
    '3. Если задана грамматическая тема — конструкция используется в тексте несколько раз.',
    '4. ВСЕ упражнения строго по содержанию текста. Вопросы mcq — смысловые (не «какое слово было в тексте»), неправильные варианты правдоподобны, ровно 4 options, answer — индекс 0-3.',
    '5. Количество упражнений каждого вида — по плану.',
    '6. В fill ответ (answer) — ровно то, что пропущено в prompt на месте ___.',
    '7. Порядок упражнений: сначала comprehension, потом grammar, потом vocab.',
  ].join('\n')

  const userMsg = [
    'Заявка:',
    requestDescription(req),
    '',
    'Утверждённый план:',
    JSON.stringify(plan),
    feedback ? `\nПравки преподавателя: ${feedback}` : '',
  ].join('\n')

  const raw = await chat([{ role: 'user', content: userMsg }], { system })
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
  const { error } = await supabase
    .from('material_assignments')
    .insert({ material_id: materialId, student_id: studentId })
  if (error && !error.message.includes('duplicate')) throw error
}

export async function unassignMaterial(materialId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('material_assignments')
    .delete()
    .eq('material_id', materialId)
    .eq('student_id', studentId)
  if (error) throw error
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

/** Ученица сдаёт работу: ответы + авто-балл, статус submitted. */
export async function submitAssignment(
  assignmentId: string,
  answers: AssignmentAnswer[],
  autoScore: number,
  autoTotal: number,
): Promise<void> {
  const { error } = await supabase
    .from('material_assignments')
    .update({
      status: 'submitted',
      answers,
      auto_score: autoScore,
      auto_total: autoTotal,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
  if (error) throw error
}
