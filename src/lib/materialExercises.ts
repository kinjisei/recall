// ============================================================================
// Отбор упражнений из ответа модели — единственный фильтр между свободным
// текстом AI и тем, что увидит ученик.
//
// Вынесено отдельным ЧИСТЫМ модулем (без supabase и сети) ровно затем, чтобы
// его можно было проверить юнит-тестом: scripts/test-material-exercises.mjs.
// Тот же приём, что у dailyPlanCore и distractors.
// ============================================================================
import type { MaterialExercise } from '../types'

/**
 * Валидные упражнения из ответа AI (общая для генерации текста и «Мой текст»).
 * Экспортируется ради юнит-проверки: scripts/test-material-exercises.mjs.
 */
export function validExercises(list: MaterialExercise[]): MaterialExercise[] {
  return (list ?? []).filter((e) => {
    if (!e || typeof e !== 'object') return false
    if (e.type === 'mcq') {
      return (
        typeof e.prompt === 'string' &&
        Array.isArray(e.options) &&
        e.options.length >= 2 &&
        typeof e.answer === 'number' &&
        e.answer >= 0 &&
        e.answer < e.options.length
      )
    }
    if (e.type === 'fill') {
      return typeof e.prompt === 'string' && typeof e.answer === 'string' && e.answer.length > 0
    }
    if (e.type === 'order') {
      // ⚠️ Мало проверить, что массивы на месте: если words и answer не
      // совпадают по составу, упражнение НЕВОЗМОЖНО собрать — ученик перебирает
      // слова и не может дойти до верного ответа. Сверяем мультимножества.
      if (
        typeof e.prompt !== 'string' ||
        !Array.isArray(e.words) ||
        !Array.isArray(e.answer) ||
        e.answer.length < 3 ||
        e.words.length !== e.answer.length
      ) {
        return false
      }
      const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
      const bank = e.words.map(norm).sort()
      const right = e.answer.map(norm).sort()
      return bank.every((w, i) => w.length > 0 && w === right[i])
    }
    return false
  })
}
