// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Названия видов упражнений материала — одни на проверку работы (d18),
// библиотеку и печать: «Выбери ответ», «Верно / Неверно», «Соедини слово и
// перевод»… Каталог форматов с группами и пределами — Ф2.25-2 (этот модуль).
// ============================================================================
import type { MaterialExercise } from '../types'

/** Полное название вида: шапка упражнения в проверке и печать. */
export function formatLabel(ex: MaterialExercise): string {
  if (ex.type === 'match') return ex.format === 'definition' ? 'Соедини слово и объяснение' : 'Соедини слово и перевод'
  if (ex.type === 'mcq') {
    if (ex.format === 'tfng') return ex.options.length > 2 ? 'Верно / Неверно / Не сказано' : 'Верно / Неверно'
    if (ex.format === 'form') return 'Выбери правильную форму'
    return ex.kind === 'vocab' ? 'Слово по объяснению' : 'Выбери ответ'
  }
  if (ex.type === 'fill') return ex.kind === 'vocab' ? 'Вставь слово из текста' : 'Вставь форму'
  return 'Собери предложение'
}

/** Короткое название — строка итога проверки (d18: «Соедини пары», «Верно / Неверно»). */
export function shortLabel(ex: MaterialExercise): string {
  if (ex.type === 'match') return 'Соедини пары'
  if (ex.type === 'mcq' && ex.format === 'tfng') return 'Верно / Неверно'
  return formatLabel(ex)
}
