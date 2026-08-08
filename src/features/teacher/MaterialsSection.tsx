// ============================================================================
// «Материалы» преподавателя — оркестратор экранов: список + блок «На проверку»,
// переходы список → форма → план → предпросмотр → карточка материала.
// Сами экраны — в features/teacher/materials/* (форма/план/предпросмотр/деталь/
// список по уровням). Здесь только состояние Mode и разводка.
// ============================================================================
import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { LoadError } from '../../components/LoadError'
import { useAsyncData } from '../../lib/useAsyncData'
import { getMyPlan } from '../../lib/billing'
import {
  listMyMaterials,
  listSubmittedWorks,
  type MaterialContent,
  type MaterialRequest,
  type SubmittedWork,
} from '../../lib/materials'
import type { StudentInfo } from '../../lib/teacher'
import { useScrollTop } from '../../lib/useScrollTop'
import { useUrlState } from '../../lib/useUrlState'
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

  // Открытый материал — в адресе (?mat=<id>): «назад» возвращает к списку
  // материалов, а не выбрасывает из студии, и на материал можно дать ссылку.
  //
  // ⚠️ Шаги мастера генерации (plan, preview) в адрес НЕ выносим сознательно:
  // они держат в памяти уже сгенерированный AI-ответ, восстановить его по
  // ссылке нельзя. Адресуемая ссылка открывала бы пустой мастер и выглядела
  // как поломка — честнее, чтобы этих шагов в истории не было.
  const [matId, setMatId] = useUrlState('mat')
  // какую именно работу открыть на проверке (вход из блока «На проверку»);
  // в адрес не выносим — это указание «открой сразу проверку», а не место
  const [review, setReview] = useState<{ a: MaterialAssignment; name: string } | undefined>()
  // остаток генераций (get_my_plan): показываем заранее, а не по факту отказа
  const [gens, setGens] = useState<{ left: number; limit: number } | null>(null)
  useEffect(() => {
    let alive = true
    getMyPlan()
      .then((p) => {
        if (!alive || !p || typeof p.gen_limit !== 'number') return
        setGens({ left: Math.max(0, p.gen_limit - (p.gen_used ?? 0)), limit: p.gen_limit })
      })
      .catch(() => {}) // счётчик необязателен — молча без него
    return () => {
      alive = false
    }
  }, [])
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

  // адрес — источник правды для «какой материал открыт»; mode отвечает только
  // за шаги мастера. Материал ищем в уже загруженном списке: чужой или
  // удалённый id показывает список, а не пустой экран.
  const openMaterial = matId ? (materials ?? []).find((m) => m.id === matId) : undefined
  if (matId && openMaterial) {
    return (
      <MaterialDetail
        material={openMaterial}
        students={students}
        initialReview={review}
        onWorksChanged={onWorksChanged}
        onDeleted={() => {
          reload()
          setReview(undefined)
          setMatId(null)
        }}
        onBack={() => {
          reloadWorks() // проверенная работа должна исчезнуть из «На проверку»
          onWorksChanged?.() // и бейдж вкладки пересчитать
          setReview(undefined)
          setMatId(null)
        }}
      />
    )
  }

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
          setMatId(material.id)
        }}
        onBack={() =>
          mode.own
            ? setMode({ name: 'form' })
            : setMode({ name: 'plan', req: mode.req, plan: mode.plan })
        }
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
              onClick={() => {
                setReview({ a: w.assignment, name: w.studentName })
                setMatId(w.material.id)
              }}
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
        {/* Остаток генераций ДО того, как в него упрёшься. Раньше о лимите
            узнавали только по отказу в середине работы — а один материал
            стоит двух генераций (план + текст), и это тоже стоит сказать. */}
        {gens && (
          <p className="mt-2 text-xs text-[var(--night-text-40)]">
            {gens.limit === 0 ? (
              // лимит НОЛЬ — это не «закончились»: генераций не было вовсе
              // (тариф истёк). Сказать «обновятся 1-го числа» было бы неправдой.
              <>Генерация материалов входит в тариф репетитора.</>
            ) : gens.left > 0 ? (
              <>
                Осталось генераций в этом месяце: {gens.left} из {gens.limit}
                {gens.left < 2 && ' — на целый материал нужно две (план и текст)'}
              </>
            ) : (
              <>Генерации в этом месяце закончились — обновятся 1-го числа.</>
            )}
          </p>
        )}
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
          onOpen={(material) => setMatId(material.id)}
        />
      )}
    </div>
  )
}
