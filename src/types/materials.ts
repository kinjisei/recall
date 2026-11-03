// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Материалы преподавателя: сгенерированный текст + упражнения, назначение
// ученику и его работа (таблицы materials, material_assignments). Вынесены из
// types/index.ts (Ф2.25-1): файл в списке больших и расти не должен;
// импортировать — по-прежнему из `types` (реэкспорт).
// ============================================================================
import type { AppLang, GrammarExercise } from './base'

/** Категория упражнения материала. */
export type MaterialExerciseKind = 'comprehension' | 'grammar' | 'vocab'

/**
 * Выбор ответа в материале (Ф2.25): обычный вопрос, «True / False / Not
 * given» (`tfng`: варианты на языке текста — True / False / Not given,
 * Verdadero / Falso / No se dice; у текста A1–A2 — без третьего) или «Выбери
 * правильную форму» (`form`). Сервер считает все три одной веткой `mcq` —
 * по тексту выбранного варианта.
 */
export type MaterialMcq = Extract<GrammarExercise, { type: 'mcq' }> & {
  format?: 'tfng' | 'form'
  /** «True / False»: строка текста, где это видно (u5-3), и что в ней выделить. */
  quote?: string
  mark?: string
  /** «True / False»: коротко, почему так, — после ответа (u5-3). */
  why?: string
}

/**
 * «Соедини пары» (Ф2.25): слово ↔ перевод на русский (`translation`) или
 * объяснение на языке текста (`definition`). Справа — правые половины
 * вперемешку и `extra` лишних (макет u5: на один вариант больше, чем слов, —
 * последнюю пару не угадать исключением). Балл — за каждую верную пару
 * (журнал п.76 (8)); `prompt` — подпись упражнения для разбора и печати.
 */
export interface MatchExercise {
  type: 'match'
  format: 'translation' | 'definition'
  prompt: string
  pairs: { left: string; right: string }[]
  extra?: string[]
}

/** Упражнение материала: формат + категория. */
export type MaterialExercise = (MaterialMcq | Exclude<GrammarExercise, { type: 'mcq' }> | MatchExercise) & {
  kind: MaterialExerciseKind
}

/** Вид упражнения материала — id каталога `lib/exerciseFormats` (Ф2.25-2). */
export type ExerciseFormatId = 'mcq' | 'tfng' | 'match_translation' | 'match_definition' | 'word_by_definition' | 'fill_word' | 'fill_form' | 'order' | 'form'

/**
 * Строка плана упражнений: вид (`format`), сколько (у «Соедини пары» — пар в
 * одном упражнении), пометка. `kind` и `type` — для планов до Ф2.25-2 и для
 * модели; учитель правит план без генерации (макет d16). `tricky` — у True /
 * False: каверзные утверждения.
 */
export interface PlanExercise {
  kind: MaterialExerciseKind
  type: string
  count: number
  note: string
  format?: ExerciseFormatId
  tricky?: boolean
}

/** План будущего материала (шаг 1 генерации, ответ AI). */
export interface MaterialPlan {
  comments: string
  vocabulary: string[]
  grammar_focus: string | null
  exercise_plan: PlanExercise[]
}

/** Сохранённый материал (таблица materials). */
export interface Material {
  id: string
  teacher_id: string
  lang: AppLang
  level: string
  topic: string
  format: string
  length_range: string
  title: string | null
  body: string
  exercises: MaterialExercise[]
  plan: MaterialPlan | null
  created_at: string
}

export type AssignmentStatus = 'assigned' | 'submitted' | 'reviewed'

/** Ответ ученика на одно упражнение. */
export interface AssignmentAnswer {
  index: number
  /** Ответ строкой; у «Соедини пары» — «delay → задержка; gate → …». */
  given: string
  /** Верно ли упражнение целиком (у пар — все пары). */
  auto_ok: boolean
  /** «Соедини пары»: что соединено с каждым словом — правая половина по порядку `pairs`. */
  pairs?: string[]
}

/** Вердикт по одному упражнению (AI — черновик, учитель — финал). */
export interface ReviewItem {
  index: number
  ok: boolean
  comment: string
  /** «Соедини пары»: отметка у каждой пары — балл за пару (d18). */
  pairs?: boolean[]
}

/** Снимок прошлой попытки (при переназначении материала). */
export interface AttemptSnapshot {
  answers: AssignmentAnswer[] | null
  auto_score: number | null
  auto_total: number | null
  teacher_review: ReviewItem[] | null
  submitted_at: string | null
  reviewed_at: string | null
  note: string | null
}

/** Назначение материала ученику + его работа (таблица material_assignments). */
export interface MaterialAssignment {
  id: string
  material_id: string
  student_id: string
  status: AssignmentStatus
  answers: AssignmentAnswer[] | null
  auto_score: number | null
  auto_total: number | null
  ai_review: ReviewItem[] | null
  teacher_review: ReviewItem[] | null
  submitted_at: string | null
  reviewed_at: string | null
  attempts: AttemptSnapshot[] | null
  note: string | null
  created_at: string
}
