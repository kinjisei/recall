// ============================================================================
// Сбор ответов раунда упражнений (грамматика: уроки, «Мои ошибки», мини-игры)
// для разбора «Посмотреть результаты» (RoundReview + «Почему?»). Общий для всех
// раннеров: ExerciseView сначала зовёт onAnswered(ok), затем onGiven(текст) —
// на onGiven у нас есть и ok, и ответ ученика, поэтому кладём готовый ReviewItem.
// ============================================================================
import { useRef, useState } from 'react'
import type { ReviewItem } from './RoundReview'
import { correctAnswerText } from './exercises'
import type { GrammarExercise } from '../types'

export function useExerciseReview() {
  const [results, setResults] = useState<ReviewItem[]>([])
  const pendingOk = useRef(false)

  /**
   * Обёртки колбэков для ExerciseView. `onOk` — существующая логика раннера
   * (счётчик верных, банк ошибок). Порядок вызовов ExerciseView гарантирует,
   * что onGiven идёт последним и видит зафиксированный ok.
   */
  const handlers = (exercise: GrammarExercise, onOk: (ok: boolean) => void) => ({
    onAnswered: (ok: boolean) => {
      pendingOk.current = ok
      onOk(ok)
    },
    onGiven: (given: string) => {
      const ok = pendingOk.current
      setResults((r) => [
        ...r,
        { prompt: exercise.prompt, given, correct: correctAnswerText(exercise), ok },
      ])
    },
  })

  const reset = () => setResults([])
  return { results, handlers, reset }
}
