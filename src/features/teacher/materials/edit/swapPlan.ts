// ============================================================================
// Замена через AI на экране (PLAN.md Ф2.25-4б, макет d17): из чего собрать
// запрос — текст, план материала, остальные упражнения — и что можно
// сейчас по остатку. Лимиты и правило «сложных» — `domains/materials` (те
// же, что у сервера и в базе); здесь только сборка для экрана.
// ============================================================================
import { isStrongSwap, type SwapCounters, type SwapInput } from '../../../../domains/materials'
import { formatById, formatOf, normalizeRows } from '../../../../lib/exerciseFormats'
import type { ExerciseFormatId, MaterialExercise, MaterialPlan, PlanExercise } from '../../../../types'
import type { EditText } from './editText'

/** Что модели знать о материале сверх текста: слова и грамматика плана, строки упражнений. */
export interface SwapPlan {
  words: string[]
  grammar: string
  rows: PlanExercise[]
}

export const swapPlanOf = (plan: MaterialPlan | null | undefined): SwapPlan => ({
  words: plan?.vocabulary ?? [],
  grammar: plan?.grammar_focus ?? '',
  rows: normalizeRows(plan?.exercise_plan),
})

/** «Каверзные» True / False — из строки плана с этим видом; строки нет — обычные. */
export const trickyOf = (plan: SwapPlan, format: ExerciseFormatId): boolean => format === 'tfng' && plan.rows.some((r) => r.format === 'tfng' && r.tricky === true)

/** Сложная ли замена этого вида в этом материале (каверзные True / False, «Собери предложение»). */
export const strongOf = (plan: SwapPlan, format: ExerciseFormatId): boolean => isStrongSwap(format, trickyOf(plan, format))

/** Есть ли в материале упражнение сложного вида — тогда остаток сложных виден «по месту» (журнал п.76 (25)). */
export const hasStrong = (plan: SwapPlan, list: readonly MaterialExercise[]): boolean => list.some((ex) => strongOf(plan, formatOf(ex)))

/** Ключ упражнения: по нему ответ AI находит своё место, даже если список сдвинулся. */
export const keyOf = (ex: MaterialExercise): string => JSON.stringify(ex)

/** Что заменяем: готовое упражнение («↻ Заменить») или новый вид («+ Упражнение → Составит AI»). */
export type SwapTarget = { replacing: MaterialExercise } | { format: ExerciseFormatId }

/** Запрос замены: вид, каверзность и число пар — от заменяемого или из плана. */
export function swapInput(text: EditText, plan: SwapPlan, list: readonly MaterialExercise[], target: SwapTarget): SwapInput {
  const replacing = 'replacing' in target ? target.replacing : null
  const format = replacing ? formatOf(replacing) : (target as { format: ExerciseFormatId }).format
  const row = plan.rows.find((r) => r.format === format)
  const pairs = replacing?.type === 'match' ? replacing.pairs.length : formatById(format).type === 'match' ? row?.count : undefined
  return {
    body: text.body,
    lang: text.lang,
    level: text.level,
    format,
    tricky: trickyOf(plan, format),
    ...(pairs ? { pairs } : {}),
    replacing,
    others: replacing ? list.filter((e) => e !== replacing) : [...list],
    words: plan.words,
    grammar: plan.grammar,
  }
}

/** Можно ли заменить сейчас: остаток не знаем — можно (решит сервер), иначе — есть ли замены и, у сложного вида, сложные. */
export const canSwap = (c: SwapCounters | null, strong: boolean): boolean => !c || (c.left > 0 && (!strong || c.strongLeft > 0))

/** Остаток сразу после нажатия (d17-2 — «23 из 25», пока AI пишет); сложных не больше, чем всех. */
export function spent(c: SwapCounters, strong: boolean): SwapCounters {
  const left = Math.max(0, c.left - 1)
  return { left, strongLeft: Math.min(left, strong ? Math.max(0, c.strongLeft - 1) : c.strongLeft) }
}

/** Подпись на «Составит AI» (d17-3): «ещё 23 сегодня», у сложного вида — «сложных ещё 4 сегодня». */
export function aiButtonNote(c: SwapCounters | null, strong: boolean): string | null {
  if (!c) return null
  return strong ? `сложных ещё ${c.strongLeft} сегодня` : `ещё ${c.left} сегодня`
}
