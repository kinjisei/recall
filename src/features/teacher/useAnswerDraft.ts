// ============================================================================
// Ответы домашки переживают и выход в список, и перезагрузку (PLAN.md Ф1.14).
//
// Раньше черновик ответов жил в памяти страницы: выход кареткой в список его
// не стирал (ревью навигации), а перезагрузка — стирала. Новая версия PWA
// включается сразу и перезагружает страницу (журнал п.58), поэтому ответы
// теперь в черновиках на устройстве (shared/lib/drafts): свои у каждого, кто
// вошёл, до отправки, не дольше 7 дней.
//
// Черновик помнит версию упражнений (Ф2.25-3б, миграция 0018): учитель
// поправил задание — ответы по номерам съехали бы на чужие вопросы, поэтому
// черновик другой версии сбрасывается целиком, а экран говорит «Учитель
// обновил задание». Черновик без версии (до 0018) — версии 1: до неё
// материалы не правились.
// ============================================================================
import { useEffect, useState } from 'react'
import { clearDraft, readDraft, writeDraft } from '../../shared/lib/drafts'
import type { AssignmentAnswer } from '../../types'

type Draft = { answers: Record<number, AssignmentAnswer>; index: number; version?: number }

export function useAnswerDraft(rowId: string, version = 1) {
  const scope = `assignment:${rowId}`
  // стартуем с того места, где человек остановился в прошлый заход; черновик
  // чужой версии не берём (стирает его эффект ниже — инициализатор без записи)
  const [init] = useState(() => {
    const saved = readDraft<Draft>(scope)
    const updated = !!saved && (saved.version ?? 1) !== version
    return { saved: updated ? null : saved, updated }
  })
  const { saved } = init
  const [index, setIndex] = useState(saved?.index ?? 0)
  // ответы по индексу упражнения (а не push) — повторный ответ на то же
  // упражнение перезаписывает запись, не задваивая балл и не плодя дубли
  const [answerMap, setAnswerMap] = useState<Record<number, AssignmentAnswer>>(saved?.answers ?? {})
  const [restored, setRestored] = useState(Boolean(saved && Object.keys(saved.answers).length > 0))

  useEffect(() => {
    // ничего не начато — не черновик
    const started = index > 0 || Object.keys(answerMap).length > 0
    writeDraft(scope, started ? { answers: answerMap, index, version } : null)
  }, [scope, answerMap, index, version])

  return {
    index,
    setIndex,
    answerMap,
    setAnswerMap,
    restored,
    /** Учитель поправил задание после того, как ученик начал: прежние ответы сброшены. */
    updated: init.updated,
    /** «Очистить»: начать задание с чистого листа. */
    clear: () => {
      clearDraft(scope)
      setIndex(0)
      setAnswerMap({})
      setRestored(false)
    },
    /** Работа сдана или раунд без пересдачи закончен — черновик больше не нужен. */
    forget: () => {
      clearDraft(scope)
      setRestored(false)
    },
  }
}
