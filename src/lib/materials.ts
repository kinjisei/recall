// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Материалы преподавателя: генерация текста с упражнениями через Gemini
// (двухшаговая: план → материал) + хранение и назначение (Supabase).
// Таблицы materials / material_assignments, RLS — supabase/migrations.
// ============================================================================
import { supabase, requireUserId, toJson } from '../shared/api/supabase'
import { dbError } from '../shared/api/errors'
import { chat, chatReply, type ReplanGrant } from '../shared/api/ai'
import { comprehensionRange, lengthRangeOf } from './materialLengths'
import { correctAnswerText } from './text'
import { normalizeExercises, validExercises } from './materialExercises'
import { loadIrregular } from './wordForms'
import { normalizeRows } from './exerciseFormats'
import { contentSystem, ownTextSystem, planSystem, requestDescription, reviewSystem, type MaterialRequest } from './materialPrompts'
import { aiVerdict } from './assignmentScore'
import { groupBriefBlock } from './diagnosticsBrief'
import { track } from './analytics'
import type {
  AppLang,
  CEFRLevel,
  Material,
  MaterialAssignment,
  MaterialExercise,
  MaterialPlan,
  PlanExercise,
  ReviewItem,
} from '../types'

export type { MaterialRequest } from './materialPrompts'

/** Какой задачей генерить: сам себе (self_material) или учитель (material). */
const genTask = (req: MaterialRequest): 'self_material' | 'material' =>
  req.self ? 'self_material' : 'material'

export const MATERIAL_FORMATS = [
  'сказка',
  'рассказ',
  'новости',
  'диалог двух людей',
  'письмо / email',
  'статья блога',
  'интервью',
] as const

export { MATERIAL_LENGTHS, lengthRangeOf } from './materialLengths'

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

/** Для кого материал — им же он назначится при сохранении. */
export const audienceOf = (req: MaterialRequest): string[] => req.studentIds ?? (req.studentId ? [req.studentId] : [])

/** Сводка «что известно про ученика (учеников)» — общая с программой (lib/diagnosticsBrief), своей копии нет. */
const studentBrief = (req: MaterialRequest): Promise<string> => groupBriefBlock(audienceOf(req), req.lang)



/**
 * Шаг 1: AI проверяет заявку и предлагает план материала. Учителю план —
 * задача material_plan (генерация + право на 3 бесплатных повтора, его отдаёт
 * onReplan); `replan` — повтор этим правом, без генерации (PLAN.md Ф2.17-4в-2б).
 */
export async function generateMaterialPlan(
  req: MaterialRequest,
  feedback?: string,
  opts: { replan?: string; onReplan?: (g: ReplanGrant) => void } = {},
): Promise<MaterialPlan> {
  const system = planSystem(req)

  const userMsg = [
    'Заявка преподавателя:',
    requestDescription(req),
    await studentBrief(req),
    feedback ? `\nПравки преподавателя к прошлому плану: ${feedback}` : '',
  ].join('\n')

  const task = req.self ? 'self_material' : opts.replan ? 'material_replan' : 'material_plan'
  const { text: raw, replan } = await chatReply([{ role: 'user', content: userMsg }], { system, task, json: true, replan: opts.replan })
  if (replan) opts.onReplan?.(replan)
  const plan = parseJson<MaterialPlan>(raw)
  if (!Array.isArray(plan.exercise_plan) || !Array.isArray(plan.vocabulary)) {
    throw new Error('AI вернул неполный план. Попробуй ещё раз.')
  }
  // виды — из каталога (Ф2.25-2): учитель правит их на шаге «План» без генерации
  const rows = normalizeRows(plan.exercise_plan)
  if (!rows.length) throw new Error('AI вернул план без упражнений. Попробуй ещё раз.')
  return { ...plan, exercise_plan: rows }
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
  // предпоследний шаг воронки преподавателя: материал сгенерирован
  void track('material_generated', { lang: req.lang, level: req.level })

  const system = contentSystem(req, { ...plan, exercise_plan: normalizeRows(plan.exercise_plan) })

  const userMsg = [
    'Заявка:',
    requestDescription(req),
    await studentBrief(req),
    '',
    'Утверждённый план:',
    JSON.stringify(plan),
    feedback ? `\nПравки преподавателя: ${feedback}` : '',
  ].join('\n')

  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: genTask(req), json: true })
  const content = parseJson<MaterialContent>(raw)

  // Валидация: выбрасываем битые упражнения, требуем минимум приличный набор.
  const irregular = await loadIrregular(req.lang).catch(() => undefined) // к нашему виду (Ф2.25): normalizeExercises
  const valid = validExercises(normalizeExercises(content.exercises ?? [], { body: content.body ?? '', lang: req.lang, level: req.level, irregular }))
  if (!content.title || !content.body || valid.length < 3) {
    throw new Error('AI вернул неполный материал. Нажми «Генерировать» ещё раз.')
  }
  return { title: content.title, body: content.body, exercises: valid }
}

/** Первая строка/предложение текста — запасной заголовок для «Мой текст». */
function firstLine(body: string): string {
  const line = body.trim().split(/\n/)[0] ?? ''
  const sent = line.split(/(?<=[.!?…])\s/)[0] ?? line
  return (sent.length > 60 ? sent.slice(0, 57).trimEnd() + '…' : sent) || 'Свой текст'
}

/**
 * «Мой текст»: упражнения СТРОГО по готовому тексту преподавателя (генерация
 * текста пропускается). Возвращает MaterialContent с ТЕМ ЖЕ body — дальше поток
 * как обычно (предпросмотр → сохранить → назначить). opts.feedback — правки при
 * перегенерации упражнений.
 */
export async function generateExercisesForText(
  body: string,
  lang: AppLang,
  level: CEFRLevel,
  opts?: { vocabulary?: string; grammar?: string; feedback?: string; rows?: readonly PlanExercise[] },
): Promise<MaterialContent> {
  const system = ownTextSystem(lang, level, comprehensionRange(lengthRangeOf(body)), opts)

  const userMsg = ['Текст:', body, opts?.feedback ? `\nПравки преподавателя: ${opts.feedback}` : '']
    .filter(Boolean)
    .join('\n')

  // «Свой текст» — путь преподавателя, задача material (в 3b не входит).
  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: 'material', json: true })
  const content = parseJson<{ title?: string; exercises?: MaterialExercise[] }>(raw)
  const valid = validExercises(normalizeExercises(content.exercises ?? [], { body, lang, level, irregular: await loadIrregular(lang).catch(() => undefined) }))
  if (valid.length < 3) {
    throw new Error('AI не собрал упражнения по тексту. Попробуй ещё раз.')
  }
  const title = (typeof content.title === 'string' && content.title.trim()) || firstLine(body)
  return { title, body, exercises: valid }
}

/** Синтетическая заявка для сохранения «своего текста» (saveMaterial ждёт req+plan). */
export function ownTextRequest(
  lang: AppLang,
  level: CEFRLevel,
  body: string,
  accent?: { vocabulary?: string; grammar?: string },
): MaterialRequest {
  return {
    lang,
    level,
    topic: firstLine(body),
    format: 'мой текст',
    lengthRange: lengthRangeOf(body),
    // сохраняем акцент, чтобы перегенерация упражнений его учитывала
    vocabulary: accent?.vocabulary ?? '',
    grammar: accent?.grammar ?? '',
  }
}

/** План «своего текста»: генерации плана не было, упражнения — выбранные в заявке (d16-3). */
export function ownTextPlan(rows: readonly PlanExercise[] = []): MaterialPlan {
  return { comments: 'Материал по своему тексту преподавателя.', vocabulary: [], grammar_focus: null, exercise_plan: normalizeRows(rows) }
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
      exercises: toJson(content.exercises),
      plan: toJson(plan),
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

/**
 * Самоучка назначает материал СЕБЕ (режим самоучки, 3b). Через security-definer
 * RPC self_assign_material, а не прямой вставкой: запись в material_assignments
 * у клиента отозвана (инвариант «только через функции», см. CLAUDE.md). RPC
 * вставляет student_id = свой uid и требует владения материалом.
 */
export async function selfAssignMaterial(materialId: string): Promise<void> {
  const { error } = await supabase.rpc('self_assign_material', {
    p_material_id: materialId,
  })
  if (error) throw dbError(error, 'добавить материал себе')
}

/**
 * Полный путь «собрать материал себе»: план → контент → сохранить → назначить
 * себе. Задача уходит как self_material (см. genTask/req.self): не teacherOnly,
 * из своего месячного лимита генераций, дешёвая модель. studentId=свой uid, так
 * материал подстроится под собственную диагностику.
 */
export async function createSelfMaterial(
  req: Omit<MaterialRequest, 'self' | 'studentId'> & { studentId: string },
): Promise<Material> {
  const full: MaterialRequest = { ...req, self: true }
  const plan = await generateMaterialPlan(full)
  const content = await generateMaterialContent(full, plan)
  const material = await saveMaterial(full, plan, content)
  await selfAssignMaterial(material.id)
  return material
}

export async function assignMaterial(materialId: string, studentId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_material', {
    p_material_id: materialId,
    p_student_id: studentId,
  })
  if (error) throw dbError(error, 'назначить материал')
}

export async function unassignMaterial(materialId: string, studentId: string): Promise<void> {
  const { error } = await supabase.rpc('unassign_material', {
    p_material_id: materialId,
    p_student_id: studentId,
  })
  if (error) throw dbError(error, 'снять назначение')
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

// ---------------------------------------------------------------------------
// Фаза B: проверка работ (AI-разбор → вердикты преподавателя).
// ---------------------------------------------------------------------------

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
      correct: correctAnswerText(ex),
      options: ex.type === 'mcq' ? ex.options : undefined,
      given: a?.given ?? '(нет ответа)',
      auto_ok: a?.auto_ok ?? false,
      // «Соедини пары»: слово, что соединил ученик, верный ответ (Ф2.25-1б)
      pairs: ex.type === 'match' ? ex.pairs.map((p, j) => ({ word: p.left, chosen: a?.pairs?.[j] ?? '', correct: p.right })) : undefined,
    }
  })

  const system = reviewSystem(material.lang)

  const userMsg = [
    'Текст материала:',
    material.body,
    '',
    'Упражнения и ответы ученика:',
    JSON.stringify(items),
  ].join('\n')

  // разбор работы — не «мелочь», но и не генерация: средний уровень
  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: 'review', json: true })
  const parsed = parseJson<{ items: ReviewItem[] }>(raw)
  if (!Array.isArray(parsed.items)) throw new Error('AI вернул неполный разбор.')
  // страховка: вердикт на каждое упражнение (чего нет — авто), у пар AI только добавляет зачёт
  return material.exercises.map((ex, i) => aiVerdict(ex, answers.find((x) => x.index === i), i, parsed.items.find((x) => x.index === i)))
}

/** Сохранить черновик AI-разбора (чтобы не генерировать повторно; через RPC). */
export async function saveAiReview(
  assignmentId: string,
  review: ReviewItem[],
): Promise<void> {
  const { error } = await supabase.rpc('save_material_ai_review', {
    p_id: assignmentId,
    p_review: toJson(review),
  })
  if (error) throw dbError(error, 'сохранить черновик проверки')
}

/** Финал проверки: вердикты преподавателя, статус reviewed (через RPC). */
export async function finishReview(
  assignmentId: string,
  review: ReviewItem[],
): Promise<void> {
  const { error } = await supabase.rpc('finish_material_review', {
    p_id: assignmentId,
    p_review: toJson(review),
  })
  if (error) throw dbError(error, 'сохранить проверку')
}

/**
 * Переназначить проверенный материал тому же ученику: текущая работа уходит
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
  if (error) throw dbError(error, 'переназначить работу')
}
