// ============================================================================
// Упражнения материала в библиотеке (макет d17-4, PLAN.md Ф2.25-3б).
// Пока работу никто не сдал — та же правка, что на шаге «Текст» мастера
// (`ExerciseList`): «Готово» и «Убрать» сразу пишут в базу с версией, которую
// видел экран. Сдали — у каждого «🔒 правка закрыта», плашка с копией — выше
// (`LockNotice`). Не знаем, сдали ли (выдачи не загрузились), — без действий:
// правка, на которую база ответит замком, хуже кнопки, которой нет.
//
// Замена через AI (Ф2.25-4б) — та же запись: ответ AI ложится в базу, как
// «Готово»; под «+ Упражнение» — тихая строка остатка замен (журнал п.76
// (25)). Записи идут по очереди, версия — последней записи, а не той, что
// была при отрисовке: ответ AI и «Готово» подряд не спотыкаются друг о друга.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { saveMaterialExercises } from '../../../domains/materials'
import { AppError } from '../../../shared/api/errors'
import { ErrorText } from '../../../shared/ui/ErrorText'
import { IconLock } from '../../../shared/ui/icons'
import type { Material, MaterialExercise } from '../../../types'
import { DetailHead, ExerciseRow } from './detailParts'
import { ExerciseList } from './edit/ExerciseList'
import { SwapLine } from './edit/swapParts'
import { hasStrong, swapPlanOf } from './edit/swapPlan'
import { useSwapBudget } from './edit/useSwapBudget'

/** Черновик открытой формы правки в библиотеке — свой у каждого материала; копия забирает его себе. */
export const libraryEditScope = (materialId: string) => `material-edit:${materialId}`

export function LibraryExercises({
  material,
  mode,
  onSaved,
  onLocked,
  onStale,
}: {
  material: Material
  /** edit — никто не сдал; locked — сдали; unknown — выдачи не загрузились. */
  mode: 'edit' | 'locked' | 'unknown'
  onSaved: (m: Material) => void
  /** База ответила замком: работу сдали, пока учитель правил. */
  onLocked: () => void
  /** Правили в другой вкладке: экрану — перечитать материал. */
  onStale: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const n = material.exercises.length
  // версия последней записи: следующая запись в очереди идёт раньше, чем экран перерисуется
  const version = useRef({ id: material.id, v: material.exercises_version })
  useEffect(() => {
    const cur = version.current
    version.current = { id: material.id, v: cur.id === material.id ? Math.max(cur.v, material.exercises_version) : material.exercises_version }
  }, [material.id, material.exercises_version])

  const save = async (next: MaterialExercise[]): Promise<boolean> => {
    setError(null)
    try {
      const v = await saveMaterialExercises(material.id, next, version.current.v)
      version.current = { id: material.id, v }
      onSaved({ ...material, exercises: next, exercises_version: v })
      return true
    } catch (e) {
      const code = e instanceof AppError ? e.code : undefined
      if (code === 'RECALL_MATERIAL_LOCKED') onLocked()
      else {
        if (code === 'RECALL_MATERIAL_STALE') onStale()
        setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      }
      return false
    }
  }

  return (
    <>
      {/* заголовок раздела не склоняется по числу: «Упражнения · 5» (d17-4), а не «Упражнений · 5» */}
      <DetailHead>Упражнения · {n}</DetailHead>
      {mode === 'edit' ? (
        <LibraryEdit material={material} save={save} />
      ) : (
        <div className="@container flex flex-col gap-2.5">
          {material.exercises.map((ex, i) => (
            <ExerciseRow key={i} n={i + 1} ex={ex} lang={material.lang} actions={mode === 'locked' ? <LockedMark /> : undefined} />
          ))}
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </>
  )
}

/** Правка и замена через AI до сдачи: остаток замен грузится только здесь — у закрытого материала его не видно. */
function LibraryEdit({ material, save }: { material: Material; save: (next: MaterialExercise[]) => Promise<boolean> }) {
  const budget = useSwapBudget()
  const plan = swapPlanOf(material.plan)
  return (
    <>
      <ExerciseList
        exercises={material.exercises}
        onChange={save}
        text={{ body: material.body, lang: material.lang, level: material.level }}
        draftScope={libraryEditScope(material.id)}
        ai={{ budget, plan }}
      />
      <SwapLine budget={budget} strong={hasStrong(plan, material.exercises)} />
    </>
  )
}

/** «🔒 правка закрыта» на месте «Изменить · Убрать» (d17-4 `.ac17 .lk7x`). */
function LockedMark() {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 px-1.5 text-note text-fg-muted">
      <IconLock size={14} aria-hidden /> правка закрыта
    </span>
  )
}
