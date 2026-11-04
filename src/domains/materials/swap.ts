// ============================================================================
// «↻ Заменить» и «+ Упражнение → Составит AI» (PLAN.md Ф2.25-4, журнал п.76
// (8), (22)): запрос к модели на ОДНО упражнение выбранного вида и разбор
// ответа. Без базы и без сети — их делает `api.ts`; здесь правила, их же
// зовёт замер качества (`scripts/check-ai-swap.mjs`).
//
// Ответ модели проходит тот же фильтр, что упражнения целого материала
// (`normalizeExercises` → `validExercises`): слово не из текста, несобираемое
// «Собери», «Not given» у A2 — выброшены. Принимается, только если осталось
// ровно одно упражнение и оно того вида, что просили.
// ============================================================================
import { normalizeExercises, validExercises } from '../../lib/materialExercises.ts'
import { formatById, formatOf } from '../../lib/exerciseFormats.ts'
import type { IrregularForms } from '../../lib/wordForms.ts'
import { swapPrompt } from '../../lib/materialPrompts.ts'
import type { AppLang, ExerciseFormatId, MaterialExercise, PlanExercise } from '../../types/index.ts'

/** Замен в сутки на учителя и из них сильных — те же числа у сервера (`api/_swap.ts`) и в базе (0019); совпадение держит test-exercise-swap. */
export const SWAPS_PER_DAY = 25
export const STRONG_PER_DAY = 5

/**
 * Сильная замена (Flash, до 5 в сутки) — каверзные True / False и «Собери
 * предложение»: лёгкая модель в замере их портила (журнал п.76 (24)). То же
 * правило, что у сервера (`api/_swap.ts` `isStrongSwap`), — экрану, чтобы
 * подписать «сложных осталось N из 5» и выключить кнопку, когда кончились.
 */
export function isStrongSwap(format: ExerciseFormatId, tricky: boolean): boolean {
  return (format === 'tfng' && tricky) || format === 'order'
}

export interface SwapInput {
  /** Текст материала, его язык и уровень. */
  body: string
  lang: AppLang
  level: string
  /** Какой вид нужен (у «↻ Заменить» — вид заменяемого). */
  format: ExerciseFormatId
  /** «Каверзное» True / False. */
  tricky?: boolean
  /** Пар у «Соедини пары» (у замены — столько же, сколько было). */
  pairs?: number
  /** Что заменяем (у «+ Упражнение» — ничего). */
  replacing?: MaterialExercise | null
  /** Остальные упражнения материала — не повторять. */
  others: readonly MaterialExercise[]
  /** Слова и грамматика плана. */
  words?: readonly string[]
  grammar?: string
}

/** Строка плана на одно упражнение этого вида. */
export function swapRow(input: Pick<SwapInput, 'format' | 'tricky' | 'pairs'>): PlanExercise {
  const f = formatById(input.format)
  const count = f.type === 'match' ? Math.min(f.max, Math.max(f.min, input.pairs ?? f.def)) : 1
  return { format: f.id, kind: f.kind, type: f.type, count, note: '', ...(f.id === 'tfng' && input.tricky ? { tricky: true } : {}) }
}

/** Инструкция и сообщение модели. */
export function swapMessages(input: SwapInput): { system: string; user: string } {
  const row = swapRow(input)
  return swapPrompt(input.lang, input.level, row, {
    body: input.body,
    words: input.words ?? [],
    grammar: input.grammar ?? '',
    replacing: input.replacing ?? null,
    others: input.others,
  })
}

export type SwapResult = { ok: true; exercise: MaterialExercise } | { ok: false; reason: string }

/** Ответ модели → одно упражнение нужного вида или причина отказа. */
export function readSwap(raw: string, input: SwapInput, irregular?: IrregularForms): SwapResult {
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  let parsed: unknown
  try {
    parsed = s >= 0 && e > s ? JSON.parse(raw.slice(s, e + 1)) : null
  } catch {
    parsed = null
  }
  const list = parsed && typeof parsed === 'object' ? (parsed as { exercises?: unknown }).exercises : null
  if (!Array.isArray(list)) return { ok: false, reason: 'AI ответил не упражнением' }
  if (list.length !== 1) return { ok: false, reason: `AI прислал ${list.length} упражнений вместо одного` }
  const kept = validExercises(normalizeExercises(list as MaterialExercise[], { body: input.body, lang: input.lang, level: input.level, irregular }))
  const [ex] = kept
  if (!ex) return { ok: false, reason: 'упражнение не прошло проверку: слово не из текста или его нельзя решить' }
  if (formatOf(ex) !== input.format) return { ok: false, reason: `AI сделал «${formatById(formatOf(ex)).label}», а просили «${formatById(input.format).label}»` }
  return { ok: true, exercise: ex }
}
