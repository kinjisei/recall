// ============================================================================
// Схемы ответа модели у материала (JSON Schema, PLAN.md Ф2.20-3) — по образцу
// письма (`domains/writing/schema.ts`): модель строит ответ строго по ним, и
// JSON не ломается (режим JSON без схемы у слабой модели ломался, журнал п.77).
// Схема уходит с запросом (`json: …Schema()`), сервер передаёт её модели как
// `responseJsonSchema` (api/_geminiBody.ts), если она не больше 8 КБ
// (api/_jsonMode.ts); Gemma и Groq отвечают без схемы — разбор поэтому
// остаётся терпимым (`read.ts`).
//
// Схема = то, что разбирает код, а не пожелания промпта: имена полей — как в
// разборе (`read.ts`, `swap.ts` `readSwap`) и в проверке формы у сервера
// (api/_planShape.ts, api/_exerciseShape.ts); пределы — те, за которыми
// разбор выбросит ответ. Порядок ключей — как в образце ответа в промпте
// (`lib/materialPrompts`). Только слова схемы, которые Google принимает
// (type, properties, required, items, enum, minimum/maximum,
// minItems/maxItems, anyOf): лишнее слово или слишком сложная схема — 400,
// а 400 обрывает цепочку моделей (api/_core.ts). Держит
// scripts/test-material-schema.mjs.
// ============================================================================
import { FORMATS, MAX_ROWS, formatById, rowFormat } from '../../lib/exerciseFormats.ts'
import { MATCH_EXTRA_MAX, MATCH_PAIRS, TFNG_OPTIONS, allowsNotGiven } from '../../lib/materialExercises.ts'
import type { AppLang, ExerciseFormatId, PlanExercise } from '../../types/index.ts'
import { MIN_EXERCISES } from './read.ts'

type Schema = Record<string, unknown>

/** Слов в плане и строк упражнений — не больше, чем пускает сервер (api/_planShape.ts). */
export const PLAN_WORDS_MAX = 15
/** Вариантов выбора и слов «Собери» — не больше, чем пускает сервер у замены (api/_exerciseShape.ts). */
export const OPTIONS_MAX = 6
export const ORDER_WORDS_MAX = 15

const str: Schema = { type: 'string' }
const int = (minimum: number, maximum: number): Schema => ({ type: 'integer', minimum, maximum })
const only = (...values: string[]): Schema => ({ type: 'string', enum: values })
const list = (items: Schema, min = 0, max?: number): Schema => ({
  type: 'array',
  items,
  ...(min > 0 ? { minItems: min } : {}),
  ...(max !== undefined ? { maxItems: max } : {}),
})
/** Все поля обязательны (как у письма): необязательное модель вправе опустить. */
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties) })

/**
 * Одно упражнение вида каталога: kind и type — из каталога (`lib/exerciseFormats`),
 * `format` — как его читает `formatOf`; поля — как в образце промпта
 * (`exerciseSpec`). «True / False» — кнопки на языке текста, у A1–A2 без
 * «Not given» (иначе `normalizeExercises` выбросит упражнение).
 */
export function exerciseSchema(id: ExerciseFormatId, lang: AppLang, level: string): Schema {
  const f = formatById(id)
  const head = { kind: only(f.kind), type: only(f.type) }
  const choice = (min: number, max: number) => ({ prompt: str, options: list(str, min, max), answer: int(0, max - 1) })
  switch (id) {
    case 'mcq':
    case 'word_by_definition':
      return obj({ ...head, ...choice(2, OPTIONS_MAX) })
    case 'form':
      return obj({ ...head, format: only('form'), ...choice(3, 4) })
    case 'tfng': {
      const buttons = TFNG_OPTIONS[lang].slice(0, allowsNotGiven(level) ? 3 : 2)
      const n = buttons.length
      return obj({ ...head, format: only('tfng'), prompt: str, options: list(only(...buttons), n, n), answer: int(0, n - 1), quote: str, mark: str, why: str })
    }
    case 'fill_form':
      return obj({ ...head, prompt: str, answer: str, hint: str })
    case 'fill_word':
      return obj({ ...head, prompt: str, answer: str })
    case 'order':
      return obj({ ...head, prompt: str, words: list(str, 3, ORDER_WORDS_MAX), answer: list(str, 3, ORDER_WORDS_MAX) })
    case 'match_translation':
    case 'match_definition':
      return obj({
        ...head,
        format: only(id === 'match_definition' ? 'definition' : 'translation'),
        prompt: str,
        pairs: list(obj({ left: str, right: str }), MATCH_PAIRS.min, MATCH_PAIRS.max),
        extra: list(str, 0, MATCH_EXTRA_MAX),
      })
  }
}

/** Виды строк плана без повторов; плана нет — все виды каталога. */
function formatsOf(rows: readonly PlanExercise[] | undefined): ExerciseFormatId[] {
  const ids = [...new Set((rows ?? []).map(rowFormat).filter((id): id is ExerciseFormatId => id !== null))]
  return ids.length ? ids : FORMATS.map((f) => f.id)
}

/** Упражнения материала — только виды плана (промпт: «РОВНО эти виды»), не меньше, чем принимает разбор. */
function exercisesSchema(lang: AppLang, level: string, rows: readonly PlanExercise[] | undefined): Schema {
  const shapes = formatsOf(rows).map((id) => exerciseSchema(id, lang, level))
  return list(shapes.length === 1 ? shapes[0]! : { anyOf: shapes }, MIN_EXERCISES)
}

/** План (шаг 1, `material_plan` и бесплатный повтор): `grammar_focus` — пустая строка, если темы нет (null схема не держит у всех моделей). */
export function planSchema(): Schema {
  const row = obj({ format: only(...FORMATS.map((f) => f.id)), count: int(1, Math.max(...FORMATS.map((f) => f.max))), note: str, tricky: { type: 'boolean' } })
  return obj({ comments: str, vocabulary: list(str, 0, PLAN_WORDS_MAX), grammar_focus: str, exercise_plan: list(row, 1, MAX_ROWS) })
}

/** Текст и упражнения по утверждённому плану (шаг 2). */
export function contentSchema(lang: AppLang, level: string, rows: readonly PlanExercise[]): Schema {
  return obj({ title: str, body: str, exercises: exercisesSchema(lang, level, rows) })
}

/** «Мой текст»: заголовок и упражнения по готовому тексту; видов не выбрали — любые из каталога. */
export function ownTextSchema(lang: AppLang, level: string, rows?: readonly PlanExercise[]): Schema {
  return obj({ title: str, exercises: exercisesSchema(lang, level, rows) })
}

/** Замена: ровно одно упражнение нужного вида — как пропускает сервер (`isExerciseShaped`). */
export function swapSchema(lang: AppLang, level: string, format: ExerciseFormatId): Schema {
  return obj({ exercises: list(exerciseSchema(format, lang, level), 1, 1) })
}
