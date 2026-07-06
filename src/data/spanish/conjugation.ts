// ============================================================================
// Спряжения глаголов (испанский) — перенесены из приложения spanish.
//   conjugationReference — 14 времён: окончания -AR/-ER/-IR + примеры глаголов;
//   endingsExercises     — 110 упражнений тренажёра окончаний.
//
// Модуль грузится ЛЕНИВО (`await import('../data/spanish/conjugation')`) — нужен
// только в разделе «Глаголы» экрана «Грамматика».
// ============================================================================
import type { ConjugationReference, EndingsExercise } from '../../types'

import referenceJson from './conjugation_reference.json'
import trainerJson from './endings_trainer.json'

/** Справочник спряжений: persons (6 лиц) + tenses (14 времён). */
export const conjugationReference = referenceJson as ConjugationReference

/** Упражнения тренажёра окончаний (выбор правильной формы). */
export const endingsExercises = (trainerJson as { exercises: EndingsExercise[] })
  .exercises

/** Уровни, встречающиеся среди времён (для группировки в UI). */
export const conjugationLevels = ['A1', 'A2', 'B1', 'B2'] as const
