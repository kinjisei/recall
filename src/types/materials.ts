// ============================================================================
// Материалы преподавателя: сгенерированный текст + упражнения, назначение
// ученику и его работа (таблицы materials, material_assignments). Вынесены из
// types/index.ts (Ф2.25-1): файл в списке больших и расти не должен;
// импортировать — по-прежнему из `types` (реэкспорт).
// ============================================================================
import type { AppLang, GrammarExercise } from './base'

/** Категория упражнения материала. */
export type MaterialExerciseKind = 'comprehension' | 'grammar' | 'vocab'

/** Упражнение материала: формат грамматики + категория. */
export type MaterialExercise = GrammarExercise & { kind: MaterialExerciseKind }

/** План будущего материала (шаг 1 генерации, ответ AI). */
export interface MaterialPlan {
  comments: string
  vocabulary: string[]
  grammar_focus: string | null
  exercise_plan: { kind: MaterialExerciseKind; type: string; count: number; note: string }[]
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
  given: string
  auto_ok: boolean
}

/** Вердикт по одному упражнению (AI — черновик, учитель — финал). */
export interface ReviewItem {
  index: number
  ok: boolean
  comment: string
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
