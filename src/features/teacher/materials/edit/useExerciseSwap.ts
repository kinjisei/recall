// ============================================================================
// «↻ Заменить» и «+ Упражнение → Составит AI» (PLAN.md Ф2.25-4б, кадры
// d17-2, d17-3): одно упражнение у AI, пока он пишет — скелетон строки
// (`running`), ответ — на своё место в списке.
//
// Ответ сервера уже прошёл фильтр приложения (`readSwap`), и ещё — ту же
// проверку полей, что ручная правка (`checkEdit`): ученик не получит от AI
// того, что не пропустила бы форма. Не прошло — понятная строка у
// упражнения, оно прежнее; замена при этом потрачена (её списал сервер).
//
// Ответ приходит позже нажатия: учитель тем временем правит другое
// упражнение или убирает соседнее — замена ищет своё по содержимому
// (`keyOf`) в списке на момент ответа, а не по номеру на момент нажатия.
// Отказ по лимиту — без строки у упражнения: остаток обнуляется и говорит
// плашка «кончились» (d17-3в).
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { checkEdit, isStrongSwap, swapExercise, toDraft } from '../../../../domains/materials'
import { AppError } from '../../../../shared/api/errors'
import { loadIrregular } from '../../../../lib/wordForms'
import type { ExerciseFormatId, MaterialExercise } from '../../../../types'
import type { EditText } from './editText'
import { keyOf, swapInput, type SwapPlan, type SwapTarget } from './swapPlan'
import type { SwapBudget } from './useSwapBudget'

/** Строка «AI пишет» — у заменяемого упражнения или новая в конце. */
export interface Running {
  id: number
  /** Ключ заменяемого (`keyOf`); у нового — null. */
  key: string | null
  format: ExerciseFormatId
}

/** Почему не вышло — под упражнением (ключ) или над «+ Упражнение» (NEW). */
export interface SwapNote {
  key: string
  text: string
}

export const NEW = 'new'

/** Как легла правка: записана, своего упражнения уже нет, не сохранилась (библиотека). */
export type CommitResult = 'saved' | 'missing' | 'failed'

export function useExerciseSwap({
  text,
  plan,
  budget,
  latest,
  commit,
  onUnsaved,
}: {
  text: EditText
  plan: SwapPlan
  budget: SwapBudget
  /** Список на момент ответа. */
  latest: () => MaterialExercise[]
  /** Положить в список по очереди с остальными правками. */
  commit: (make: (list: MaterialExercise[]) => MaterialExercise[] | null) => Promise<CommitResult>
  /** Не сохранилось (библиотека): открыть ответ AI формой, чтобы он не пропал. */
  onUnsaved: (ex: MaterialExercise, key: string | null) => void
}) {
  const [running, setRunning] = useState<Running[]>([])
  const [notes, setNotes] = useState<SwapNote[]>([])
  const seq = useRef(0)
  // экран закрыли, пока AI писал, — ответ некуда класть
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const drop = (key: string) => setNotes((ns) => ns.filter((n) => n.key !== key))

  const start = async (target: SwapTarget) => {
    const input = swapInput(text, plan, latest(), target)
    const strong = isStrongSwap(input.format, input.tricky === true)
    const key = input.replacing ? keyOf(input.replacing) : null
    const noteKey = key ?? NEW
    const id = ++seq.current
    drop(noteKey)
    setRunning((r) => [...r, { id, key, format: input.format }])
    budget.spend(strong)
    let note: string | null = null
    const failed = (why: string) =>
      key ? `Замена не удалась: ${why}. Упражнение прежнее, замена потрачена — попробуй ещё раз или поправь руками.` : `Упражнение не добавлено: ${why}. Замена потрачена — попробуй ещё раз или напиши сам.`
    try {
      const { result, swaps } = await swapExercise(input)
      if (swaps) budget.set(swaps)
      else budget.reload()
      if (!result.ok) note = failed(result.reason)
      else {
        // та же проверка, что у «Готово»: слово «из текста» — и по справочнику форм
        const forms = await loadIrregular(text.lang).catch(() => undefined)
        const r = checkEdit(toDraft(result.exercise), { ...text, irregular: forms }, result.exercise)
        if (!r.ok) {
          const why = Object.values(r.problems)[0] ?? 'его нельзя решить'
          note = failed(`AI прислал упражнение, которое не проходит проверку (${why.charAt(0).toLowerCase()}${why.slice(1)})`)
        }
        else if (alive.current) {
          const ex = r.exercise
          const done = await commit((list) => {
            if (!key) return [...list, ex]
            const i = list.findIndex((e) => keyOf(e) === key)
            return i < 0 ? null : list.map((e, j) => (j === i ? ex : e))
          })
          if (done === 'missing') note = 'Упражнение поменялось, пока AI писал, — замена не применена.'
          if (done === 'failed') onUnsaved(ex, key)
        }
      }
    } catch (e) {
      const code = e instanceof AppError ? e.code : undefined
      // кончились — скажет плашка «Замены кончились», не строка у упражнения
      if (code === 'RECALL_SWAP_LIMIT' || code === 'RECALL_SWAP_STRONG_LIMIT') budget.out(code === 'RECALL_SWAP_STRONG_LIMIT')
      else note = e instanceof Error ? e.message : 'Не удалось заменить упражнение'
      budget.reload()
    } finally {
      if (alive.current) {
        setRunning((r) => r.filter((x) => x.id !== id))
        if (note) setNotes((ns) => [...ns.filter((n) => n.key !== noteKey), { key: noteKey, text: note as string }])
      }
    }
  }

  return { running, notes, start: (t: SwapTarget) => void start(t), drop }
}
