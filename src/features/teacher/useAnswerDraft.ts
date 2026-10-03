// ============================================================================
// Ответы домашки переживают и выход в список, и перезагрузку (PLAN.md Ф1.14).
//
// Раньше черновик ответов жил в памяти страницы: выход кареткой в список его
// не стирал (ревью навигации), а перезагрузка — стирала. Новая версия PWA
// включается сразу и перезагружает страницу (журнал п.58), поэтому ответы
// теперь в черновиках на устройстве (shared/lib/drafts): свои у каждого, кто
// вошёл, до отправки, не дольше 7 дней.
// ============================================================================
import { useEffect, useState } from 'react'
import { clearDraft, readDraft, writeDraft } from '../../shared/lib/drafts'
import type { AssignmentAnswer } from '../../types'

type Draft = { answers: Record<number, AssignmentAnswer>; index: number }

export function useAnswerDraft(rowId: string) {
  const scope = `assignment:${rowId}`
  // стартуем с того места, где человек остановился в прошлый заход
  const [saved] = useState(() => readDraft<Draft>(scope))
  const [index, setIndex] = useState(saved?.index ?? 0)
  // ответы по индексу упражнения (а не push) — повторный ответ на то же
  // упражнение перезаписывает запись, не задваивая балл и не плодя дубли
  const [answerMap, setAnswerMap] = useState<Record<number, AssignmentAnswer>>(saved?.answers ?? {})
  const [restored, setRestored] = useState(Boolean(saved && Object.keys(saved.answers).length > 0))

  useEffect(() => {
    // ничего не начато — не черновик
    const started = index > 0 || Object.keys(answerMap).length > 0
    writeDraft(scope, started ? { answers: answerMap, index } : null)
  }, [scope, answerMap, index])

  return {
    index,
    setIndex,
    answerMap,
    setAnswerMap,
    restored,
    /** «Очистить»: начать задание с чистого листа. */
    clear: () => {
      clearDraft(scope)
      setIndex(0)
      setAnswerMap({})
      setRestored(false)
    },
    /** Раунд закончен — черновик больше не нужен: «тренироваться ещё раз» начинается заново. */
    forget: () => {
      clearDraft(scope)
      setRestored(false)
    },
  }
}
