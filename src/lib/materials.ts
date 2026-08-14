// ============================================================================
// Материалы преподавателя: генерация текста с упражнениями через Gemini
// (двухшаговая: план → материал) + хранение и назначение (Supabase).
// Таблицы materials / material_assignments, RLS — docs/schema.sql.
// ============================================================================
import { supabase, requireUserId, toJson } from './supabase'
import { dbError } from './dbError'
import { chat } from './gemini'
import { correctAnswerText } from './text'
import { validExercises } from './materialExercises'
import { studentBriefBlock } from './diagnosticsBrief'
import { track } from './analytics'
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
  /**
   * Для кого собираем. Необязательно: материал по-прежнему можно сделать
   * «вообще» и назначить нескольким. Но если ученик указан, AI получает его
   * диагностику — буксующие слова и темы, где он реально ошибается.
   *
   * Ради этого поля всё и затевалось: без него генератор материалов делает то
   * же, что любой чат, и платить за него незачем.
   */
  studentId?: string | null
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

/**
 * Абзац «что известно про этого ученика» для промпта — общий с программой
 * обучения и сборкой домашки (lib/diagnosticsBrief.ts). Своей копии здесь нет
 * намеренно: разъехавшись, три места представляли бы одного ученика по-разному.
 */
const studentBrief = (req: MaterialRequest): Promise<string> =>
  studentBriefBlock(req.studentId, req.lang)

/** Инструкция AI, как пользоваться диагностикой. Без неё сводка — просто текст. */
const USE_DIAGNOSTICS = [
  'Если ниже дана диагностика ученика — опирайся на неё, а не на общие соображения:',
  '- буксующие слова ОБЯЗАТЕЛЬНО включи в текст (естественно, по смыслу) и хотя бы в одно упражнение;',
  '- слабые темы грамматики бери как приоритет, даже если преподаватель не назвал тему;',
  '- категорию, где балл ниже прочих, усиль на одно-два упражнения;',
  '- НЕ упоминай диагностику в самом материале: ученик не должен читать про свои слабые места.',
].join('\n')

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

/** Длина-корзина по числу слов в теле текста (для «Мой текст»). */
export function lengthRangeOf(body: string): MaterialRequest['lengthRange'] {
  const n = body.split(/\s+/).filter(Boolean).length
  return n < 100 ? '50-100' : n <= 250 ? '100-250' : '250-350'
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
    '    {"kind":"grammar","type":"order","count":N,"note":"собрать предложение из слов"},',
    '    {"kind":"vocab","type":"mcq","count":N,"note":"матч: определение слова → выбор из 4 слов"}',
    '  ]',
    '}',
    '',
    `Правила: вопросов на понимание (comprehension) — ${comprehensionRange(req.lengthRange)} (длина текста ${req.lengthRange} слов).`,
    'Грамматических и словарных упражнений — по 4-6, если тема/слова заданы; kind "grammar" пропусти, если грамматика не задана.',
    'Грамматику ОБЯЗАТЕЛЬНО раздели на два типа: часть fill (вписать), часть order (собрать предложение из слов). ' +
      'Одинаковые упражнения подряд превращают задание в механическую работу; ученик должен и вписывать, и строить фразу целиком.',
    '',
    USE_DIAGNOSTICS,
    'В comments отдельной фразой скажи, что именно взял из диагностики — преподаватель должен видеть, почему план такой.',
  ].join('\n')

  const userMsg = [
    'Заявка преподавателя:',
    requestDescription(req),
    await studentBrief(req),
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
  // предпоследний шаг воронки преподавателя: материал сгенерирован
  void track('material_generated', { lang: req.lang, level: req.level })

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
    '    {"kind":"grammar","type":"order","prompt":"перевод предложения по-русски","words":["слова","в","любом","порядке"],"answer":["слова","в","правильном","порядке"]},',
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
    '6. В fill ответ (answer) — ровно то, что пропущено в prompt на месте ___. ' +
      'Символ «/» в answer используй ТОЛЬКО чтобы перечислить равноправные варианты (например was/were); ' +
      'не ставь «/» как часть самого ответа (даты, дроби) — иначе он не засчитается.',
    '7. Словарные (vocab) — матч по определению: prompt — простое определение слова на целевом языке (уровня ученика, БЕЗ самого слова), options — 4 слова: правильное + 3 других слова из текста или того же уровня, answer — индекс правильного.',
    '8. Порядок упражнений: сначала comprehension, потом grammar, потом vocab.',
    '9. В order: answer — предложение из текста, разбитое на слова В ПРАВИЛЬНОМ ПОРЯДКЕ (3-10 слов); words — РОВНО ТЕ ЖЕ слова, ничего не добавляя и не убирая (порядок неважен, приложение перемешает). prompt — перевод этого предложения на русский. Если состав words и answer разойдётся, упражнение станет несобираемым и будет выброшено.',
    '',
    USE_DIAGNOSTICS,
  ].join('\n')

  const userMsg = [
    'Заявка:',
    requestDescription(req),
    await studentBrief(req),
    '',
    'Утверждённый план:',
    JSON.stringify(plan),
    feedback ? `\nПравки преподавателя: ${feedback}` : '',
  ].join('\n')

  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: 'material' })
  const content = parseJson<MaterialContent>(raw)

  // Валидация: выбрасываем битые упражнения, требуем минимум приличный набор.
  const valid = validExercises(content.exercises ?? [])
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
  opts?: { vocabulary?: string; grammar?: string; feedback?: string },
): Promise<MaterialContent> {
  const langName = lang === 'es' ? 'испанском' : 'английском'
  const compr = comprehensionRange(lengthRangeOf(body))
  const system = [
    'Ты — автор учебных упражнений по иностранным языкам.',
    `Дан ГОТОВЫЙ текст на ${langName} (уровень ученика — ${level}). Составь упражнения СТРОГО по этому тексту.`,
    'Отвечай ТОЛЬКО валидным JSON без markdown.',
    '',
    'Формат ответа:',
    '{',
    '  "title": "короткий заголовок текста на целевом языке",',
    '  "exercises": [',
    '    {"kind":"comprehension","type":"mcq","prompt":"вопрос по смыслу на целевом языке","options":["A","B","C","D"],"answer":0},',
    '    {"kind":"grammar","type":"fill","prompt":"предложение ИЗ текста с пропуском ___","answer":"пропущенная часть","hint":"подсказка по-русски"},',
    '    {"kind":"grammar","type":"order","prompt":"перевод предложения по-русски","words":["слова","в","любом","порядке"],"answer":["слова","в","правильном","порядке"]},',
    '    {"kind":"vocab","type":"mcq","prompt":"определение слова НА ЦЕЛЕВОМ ЯЗЫКЕ (само слово не называть!)","options":["слово1","слово2","слово3","слово4"],"answer":0}',
    '  ]',
    '}',
    '',
    'Жёсткие требования:',
    '1. ВСЕ упражнения строго по содержанию ДАННОГО текста. Не выдумывай фактов, которых в тексте нет.',
    `2. Вопросов на понимание (comprehension) — ${compr}; грамматических — 3-6 (часть fill, часть order, чтобы задание не было однообразным); словарных (vocab) — 3-6.`,
    opts?.grammar?.trim() ? `3. Сделай акцент на грамматике: ${opts.grammar.trim()}.` : '',
    opts?.vocabulary?.trim() ? `4. В словарных упражнениях приоритет словам: ${opts.vocabulary.trim()}.` : '',
    'В fill ответ (answer) — ровно то, что пропущено на месте ___; «/» только для равноправных вариантов (was/were), не как часть самого ответа.',
    'В vocab prompt — простое определение слова уровня ученика БЕЗ самого слова; options — 4 слова (правильное + 3 из текста/того же уровня); answer — индекс правильного.',
    'В order: answer — предложение ИЗ текста, разбитое на слова в правильном порядке (3-10 слов); ' +
      'words — РОВНО ТЕ ЖЕ слова (порядок неважен, приложение перемешает); prompt — перевод предложения на русский. ' +
      'Разошёлся состав words и answer — упражнение несобираемое, оно будет выброшено.',
    'Порядок упражнений: сначала comprehension, потом grammar, потом vocab.',
  ]
    .filter(Boolean)
    .join('\n')

  const userMsg = ['Текст:', body, opts?.feedback ? `\nПравки преподавателя: ${opts.feedback}` : '']
    .filter(Boolean)
    .join('\n')

  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: 'material' })
  const content = parseJson<{ title?: string; exercises?: MaterialExercise[] }>(raw)
  const valid = validExercises(content.exercises ?? [])
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

/** Минимальный план для «своего текста» (генерации плана не было). */
export function ownTextPlan(): MaterialPlan {
  return { comments: 'Материал по своему тексту преподавателя.', vocabulary: [], grammar_focus: null, exercise_plan: [] }
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

/** Ученик сдаёт работу: ответы + авто-балл, статус submitted (через RPC). */
export async function submitAssignment(
  assignmentId: string,
  answers: AssignmentAnswer[],
  autoScore: number,
  autoTotal: number,
): Promise<void> {
  const { error } = await supabase.rpc('submit_material', {
    p_id: assignmentId,
    p_answers: toJson(answers),
    p_auto_score: autoScore,
    p_auto_total: autoTotal,
  })
  if (error) throw dbError(error, 'отправить работу')
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

  // имена учеников одним запросом (RLS «linked profiles visible» разрешает)
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
      studentName: names.get(assignment.student_id) ?? 'Ученик',
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
      correct: correctAnswerText(ex),
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
    // Общее правило «будь снисходителен к опечаткам» в промпте было, но по
    // замеру ревью не срабатывало. Помогают не правила, а ЭТАЛОНЫ — тот же
    // приём, что вылечил «Диалог» (см. lib/correctionRules).
    '- ok=true можно поставить даже там, где авто-проверка сочла ошибкой, если ответ по сути верен (мелкая опечатка, другой регистр, допустимый синоним) — поясни это в comment;',
    '- примеры, где ok=true несмотря на несовпадение: «wich» вместо «which», «Went» вместо «went», «begin» вместо «start», «don’t» вместо «do not»;',
    '- и наоборот: НЕ придумывай ошибку там, где ответ верен. Если сомневаешься, что именно имел в виду ученик, ставь ok=true и напиши сомнение в comment;',
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
