// ============================================================================
// «Материалы» преподавателя — оркестратор экранов: список + блок «На проверку»,
// переходы список → форма → план → предпросмотр → карточка материала.
// Сами экраны — в features/teacher/materials/* (форма/план/предпросмотр/деталь/
// список по уровням). Здесь только состояние Mode и разводка.
// ============================================================================
import { useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { LoadError } from '../../components/LoadError'
import { useAsyncData } from '../../lib/useAsyncData'
import {
  listMyMaterials,
  listSubmittedWorks,
  type MaterialContent,
  type MaterialRequest,
  type SubmittedWork,
} from '../../lib/materials'
import type { StudentInfo } from '../../lib/teacher'
import { useScrollTop } from '../../lib/useScrollTop'
import type { Material, MaterialAssignment, MaterialPlan } from '../../types'
import { MaterialsByLevel } from './materials/MaterialsByLevel'
import { RequestForm } from './materials/RequestForm'
import { PlanScreen } from './materials/PlanScreen'
import { PreviewScreen } from './materials/PreviewScreen'
import { MaterialDetail } from './materials/MaterialDetail'

type Mode =
  | { name: 'list' }
  | { name: 'form' }
  | { name: 'plan'; req: MaterialRequest; plan: MaterialPlan }
  // own: материал по своему тексту преподавателя (плана нет, назад — к форме)
  | { name: 'preview'; req: MaterialRequest; plan: MaterialPlan; content: MaterialContent; own?: boolean }
  // review — сразу открыть проверку конкретной работы (из блока «На проверку»)
  | { name: 'detail'; material: Material; review?: { a: MaterialAssignment; name: string } }

export function MaterialsSection({
  students,
  onWorksChanged,
}: {
  students: StudentInfo[]
  /** Позвать, когда число работ «на проверку» могло измениться (для бейджа вкладки). */
  onWorksChanged?: () => void
}) {
  const [mode, setMode] = useState<Mode>({ name: 'list' })
  // список → форма → предпросмотр → материал: каждый шаг с верха экрана
  useScrollTop(mode.name)
  // ошибка RLS/сети не должна выглядеть как «материалов нет»
  const {
    data: materials,
    error: loadError,
    loading: loadingMaterials,
    reload,
  } = useAsyncData<Material[]>(() => listMyMaterials(), [], 'Не удалось загрузить материалы')
  // сданные работы — блок «На проверку»: кто сдал и что проверять
  const { data: works, reload: reloadWorks } = useAsyncData<SubmittedWork[]>(
    () => listSubmittedWorks(),
    [],
    'Не удалось загрузить работы',
  )

  if (mode.name === 'form') {
    return (
      <RequestForm
        onCancel={() => setMode({ name: 'list' })}
        onPlanned={(req, plan) => setMode({ name: 'plan', req, plan })}
        onOwnGenerated={(req, plan, content) =>
          setMode({ name: 'preview', req, plan, content, own: true })
        }
      />
    )
  }
  if (mode.name === 'plan') {
    return (
      <PlanScreen
        req={mode.req}
        plan={mode.plan}
        onBack={() => setMode({ name: 'form' })}
        onReplanned={(plan) => setMode({ ...mode, plan })}
        onGenerated={(content) => setMode({ name: 'preview', req: mode.req, plan: mode.plan, content })}
      />
    )
  }
  if (mode.name === 'preview') {
    return (
      <PreviewScreen
        req={mode.req}
        plan={mode.plan}
        content={mode.content}
        own={mode.own}
        onRegenerated={(content) => setMode({ ...mode, content })}
        onSaved={(material) => {
          reload()
          setMode({ name: 'detail', material })
        }}
        onBack={() =>
          mode.own
            ? setMode({ name: 'form' })
            : setMode({ name: 'plan', req: mode.req, plan: mode.plan })
        }
      />
    )
  }
  if (mode.name === 'detail') {
    return (
      <MaterialDetail
        material={mode.material}
        students={students}
        initialReview={mode.review}
        onWorksChanged={onWorksChanged}
        onDeleted={() => {
          reload()
          setMode({ name: 'list' })
        }}
        onBack={() => {
          reloadWorks() // проверенная работа должна исчезнуть из «На проверку»
          onWorksChanged?.() // и бейдж вкладки пересчитать
          setMode({ name: 'list' })
        }}
      />
    )
  }

  const pending = works ?? []
  return (
    <div className="flex flex-col gap-3">
      {/* На проверку: кто сдал, какой материал — сразу в проверку одним тапом */}
      {pending.length > 0 && (
        <Card className="flex flex-col gap-2 border-amber-300/40 bg-amber-400/[0.06]">
          <p className="text-sm font-semibold text-amber-200">
            На проверку: {pending.length}
          </p>
          {pending.map((w) => (
            <button
              key={w.assignment.id}
              onClick={() =>
                setMode({
                  name: 'detail',
                  material: w.material,
                  review: { a: w.assignment, name: w.studentName },
                })
              }
              className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-left transition-transform active:scale-[0.99]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {w.studentName} · {w.material.title ?? w.material.topic}
                </span>
                <span className="block text-xs text-[var(--night-text-40)]">
                  авто-балл {w.assignment.auto_score}/{w.assignment.auto_total}
                  {w.assignment.submitted_at
                    ? ` · сдано ${new Date(w.assignment.submitted_at).toLocaleDateString('ru-RU')}`
                    : ''}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-[var(--night-accent-text)]">
                Проверить ›
              </span>
            </button>
          ))}
        </Card>
      )}

      <Card>
        <p className="text-sm text-[var(--night-text-70)]">
          Генератор учебных текстов: тема, уровень, формат — AI составит план,
          сгенерирует текст и упражнения. Материал можно назначить ученикам или
          просто хранить в библиотеке.
        </p>
        <Button className="mt-3" onClick={() => setMode({ name: 'form' })}>
          + Создать материал
        </Button>
      </Card>

      {loadingMaterials ? (
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={reload} />
      ) : (materials ?? []).length === 0 ? (
        <p className="text-sm text-[var(--night-text-40)]">Пока нет сохранённых материалов.</p>
      ) : (
        <MaterialsByLevel
          materials={materials ?? []}
          onOpen={(material) => setMode({ name: 'detail', material })}
        />
      )}
    </div>
  )
}
