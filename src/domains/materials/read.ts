// ============================================================================
// Разбор ответа модели у материала: план, текст с упражнениями, «Мой текст»
// (замена — `swap.ts` `readSwap`). Без базы и сети — вызовы делает
// `lib/materials`; здесь правила, чтобы тест прогнал через них ответ по
// схеме (`schema.ts`, scripts/test-material-schema.mjs).
//
// Разбор терпим к обёртке вокруг JSON: Gemma и Groq отвечают без схемы.
// Упражнения проходят фильтр приложения (`normalizeExercises` →
// `validExercises`): что ученик не решит, выбрасывается.
// ============================================================================
import { normalizeRows } from '../../lib/exerciseFormats.ts'
import { normalizeExercises, validExercises, type ExerciseContext } from '../../lib/materialExercises.ts'
import type { MaterialExercise, MaterialPlan } from '../../types/index.ts'

/** Меньше годных упражнений — материал неполный (и схема просит не меньше). */
export const MIN_EXERCISES = 3

export interface MaterialContent {
  title: string
  body: string
  exercises: MaterialExercise[]
}

/** Достаёт JSON из ответа модели (терпит ```-обёртки и болтовню вокруг). */
export function parseJson<T>(raw: string): T {
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

const listOf = (v: unknown): MaterialExercise[] => (Array.isArray(v) ? (v as MaterialExercise[]) : [])
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * План: строки — к виду каталога (`normalizeRows`, учитель правит их на шаге
 * «План» без генерации); темы грамматики нет — `null` (по схеме модель
 * пишет пустую строку, без схемы — null).
 */
export function readPlan(raw: string): MaterialPlan {
  const plan = parseJson<MaterialPlan>(raw)
  if (!Array.isArray(plan.exercise_plan) || !Array.isArray(plan.vocabulary)) {
    throw new Error('AI вернул неполный план. Попробуй ещё раз.')
  }
  const rows = normalizeRows(plan.exercise_plan)
  if (!rows.length) throw new Error('AI вернул план без упражнений. Попробуй ещё раз.')
  return { ...plan, grammar_focus: text(plan.grammar_focus) || null, exercise_plan: rows }
}

/** Текст и упражнения (шаг 2): нужны заголовок, текст и не меньше трёх годных упражнений. */
export function readContent(raw: string, ctx: Omit<ExerciseContext, 'body'>): MaterialContent {
  const content = parseJson<Record<string, unknown>>(raw)
  const title = text(content.title)
  const body = typeof content.body === 'string' ? content.body : ''
  const exercises = validExercises(normalizeExercises(listOf(content.exercises), { ...ctx, body }))
  if (!title || !body.trim() || exercises.length < MIN_EXERCISES) {
    throw new Error('AI вернул неполный материал. Нажми «Генерировать» ещё раз.')
  }
  return { title, body, exercises }
}

/** «Мой текст»: упражнения по готовому тексту; заголовка нет — пустая строка (подставит `lib/materials`). */
export function readOwnText(raw: string, ctx: ExerciseContext): { title: string; exercises: MaterialExercise[] } {
  const content = parseJson<Record<string, unknown>>(raw)
  const exercises = validExercises(normalizeExercises(listOf(content.exercises), ctx))
  if (exercises.length < MIN_EXERCISES) {
    throw new Error('AI не собрал упражнения по тексту. Попробуй ещё раз.')
  }
  return { title: text(content.title), exercises }
}
