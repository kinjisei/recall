// ============================================================================
// Материалы — запись правки и копии (PLAN.md Ф2.25-3б, миграция 0018) и
// замена упражнения через AI (Ф2.25-4, миграция 0019).
// Прямой UPDATE `materials` у клиента закрыт: правка и копия — функциями базы,
// они сами проверяют, что материал твой. Замок сданного держит база
// (RECALL_MATERIAL_LOCKED), экран узнаёт отказ по `AppError.code`.
// Остальное про материалы с базой (генерация, сохранение, выдачи) — в
// `lib/materials` до переезда (PLAN.md Ф3); новое — сюда.
// ============================================================================
import { supabase, toJson } from '../../shared/api/supabase'
import { dbError } from '../../shared/api/errors'
import { chatReply, type SwapCounters } from '../../shared/api/ai'
import { loadIrregular } from '../../lib/wordForms'
import type { MaterialExercise } from '../../types'
import { readSwap, swapMessages, type SwapInput, type SwapResult } from './swap'

export type { SwapCounters }

/**
 * Сохранить упражнения материала из библиотеки; ответ — новая версия.
 * `version` — та, которую видел экран: правили в другой вкладке —
 * RECALL_MATERIAL_STALE; работу уже сдали — RECALL_MATERIAL_LOCKED.
 */
export async function saveMaterialExercises(id: string, exercises: MaterialExercise[], version: number): Promise<number> {
  const { data, error } = await supabase.rpc('save_material_exercises', {
    p_id: id,
    p_exercises: toJson(exercises),
    p_version: version,
  })
  if (error) throw dbError(error, 'сохранить упражнения')
  return data
}

/** «Сделать копию и править»: новый материал без выдач; ответ — его id. */
export async function copyMaterial(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('copy_material', { p_id: id })
  if (error) throw dbError(error, 'сделать копию')
  return data
}

/**
 * «↻ Заменить» и «+ Упражнение → Составит AI»: одно упражнение вида
 * `input.format` у модели, которую по виду выбирает сервер (`api/_swap.ts`).
 * Ответ — упражнение или причина (`readSwap`: не прошло фильтр приложения —
 * упражнение прежнее, а замена уже потрачена) и остаток замен на сегодня.
 * Отказы — AppError с кодом: RECALL_SWAP_LIMIT (замены кончились),
 * RECALL_SWAP_STRONG_LIMIT (кончились сильные), RECALL_PLAN_REQUIRED (нет
 * тарифа), RECALL_SWAP_SHAPE (AI ответил не упражнением — замена потрачена).
 * После любого отказа счётчик — заново `loadSwapCounters`.
 */
export async function swapExercise(input: SwapInput): Promise<{ result: SwapResult; swaps: SwapCounters | null }> {
  const { system, user } = swapMessages(input)
  const reply = await chatReply([{ role: 'user', content: user }], {
    system,
    task: 'exercise_swap',
    json: true,
    swap: { format: input.format, tricky: input.tricky === true },
  })
  const irregular = await loadIrregular(input.lang).catch(() => undefined)
  return { result: readSwap(reply.text, input, irregular), swaps: reply.swaps ?? null }
}

/** Сколько замен осталось сегодня (до первой замены — кадры d17-1, d17-3в); сбой — бросает, а не «0». */
export async function loadSwapCounters(): Promise<SwapCounters> {
  const { data, error } = await supabase.rpc('my_exercise_swaps')
  if (error) throw dbError(error, 'узнать, сколько замен осталось')
  const row = Array.isArray(data) ? data[0] : data
  return { left: row?.swaps_left ?? 0, strongLeft: row?.strong_left ?? 0 }
}
