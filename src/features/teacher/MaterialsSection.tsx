// ============================================================================
// «Материалы» преподавателя — оркестратор экранов: список + блок «На проверку»,
// переходы список → форма → план → предпросмотр → карточка материала.
// Сами экраны — в features/teacher/materials/* (форма/план/предпросмотр/деталь/
// список по уровням). Здесь только состояние Mode и разводка.
// ============================================================================
import { useEffect, useState } from 'react'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { LoadError } from '../../shared/ui/LoadError'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { getMyPlan } from '../../lib/billing'
import { listMyMaterials, listSubmittedWorks, type SubmittedWork } from '../../lib/materials'
import type { StudentInfo } from '../../lib/teacher'
import { useScrollTop } from '../../lib/useScrollTop'
import { useUrlState } from '../../shared/lib/useUrlState'
import type { Material, MaterialAssignment } from '../../types'
import { MaterialsByLevel } from './materials/MaterialsByLevel'
import { REQUEST_DRAFT, RequestForm } from './materials/RequestForm'
import { useDraft } from '../../shared/lib/useDraft'
import { clearDraft } from '../../shared/lib/drafts'
import { DraftRestored } from '../../shared/ui/DraftRestored'
import { PlanScreen } from './materials/PlanScreen'
import { PreviewScreen } from './materials/PreviewScreen'
import { MaterialDetail } from './materials/MaterialDetail'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { START, advance, ahead, back, current, forward, fromDraft, replace, type Flow } from './materials/wizard'
import { useInnerScreen } from './innerScreen'

export function MaterialsSection({
  students,
  startForm = false,
  onWorksChanged,
}: {
  students: StudentInfo[]
  /** Сразу форма нового материала — «Собрать материал» во «Заданиях» (Ф2.10). */
  startForm?: boolean
  /** Позвать, когда число работ «на проверку» могло измениться (счётчик вкладки «Задания»). */
  onWorksChanged?: () => void
}) {
  // Шаги мастера — черновик (Ф1.14): план и текст уже стоили генерации AI, и
  // перезагрузка (новая версия включается сразу) не должна их выбрасывать.
  // null — список; стирается, когда материал сохранён или работу выбросили.
  // «Назад» внутри мастера готовое тоже не выбрасывает (Ф2.11, wizard.ts).
  const [saved, setFlow, flowDraft] = useDraft<unknown>('material-flow', null)
  const flow = fromDraft(saved)
  const step = flow ? current(flow) : null
  const next = flow ? ahead(flow) : undefined
  const go = (f: Flow | null) => setFlow(f)
  const discard = () => {
    flowDraft.clear()
    clearDraft(REQUEST_DRAFT)
  }
  const restoredNote = flowDraft.restored && <DraftRestored onClear={discard} className="mb-3" />
  // «Собрать материал»: форма — если мастер не продолжается с прошлого раза
  // (начатый план или текст не выбрасываем ради пустой формы)
  useEffect(() => {
    if (startForm && !flow) setFlow(START)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // список → форма → предпросмотр → материал: каждый шаг с верха экрана
  useScrollTop(step?.name ?? 'list')

  // Открытый материал — в адресе (?mat=<id>): «назад» возвращает к списку
  // материалов, а не выбрасывает из студии, и на материал можно дать ссылку.
  //
  // ⚠️ Шаги мастера генерации (plan, preview) в адрес НЕ выносим сознательно:
  // они держат уже сгенерированный AI-ответ (на этом устройстве — в черновике),
  // восстановить его по ссылке нельзя. Адресуемая ссылка открывала бы пустой
  // мастер и выглядела как поломка — честнее, чтобы этих шагов в истории не было.
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
  // у материала, плана и предпросмотра своя шапка «назад» — шапку раздела прячем
  useInnerScreen(!!openMaterial || step?.name === 'plan' || step?.name === 'preview')
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

  if (flow && step?.name === 'form') {
    return (
      <RequestForm
        students={students}
        resumeLabel={next && (next.name === 'plan' ? 'Вернуться к плану' : 'Вернуться к упражнениям')}
        onResume={() => go(forward(flow))}
        onCancel={() => go(null)}
        onPlanned={(req, plan) => go(advance(flow, { name: 'plan', req, plan }))}
        onOwnGenerated={(req, plan, content) =>
          go(advance(flow, { name: 'preview', req, plan, content, own: true }))
        }
      />
    )
  }
  if (flow && step?.name === 'plan') {
    return (
      <>
        {restoredNote}
        <PlanScreen
          req={step.req}
          plan={step.plan}
          onBack={() => go(back(flow))}
          onForward={next ? () => go(forward(flow)) : undefined}
          onReplanned={(plan) => go(replace(flow, { ...step, plan }))}
          onGenerated={(content) => go(advance(flow, { name: 'preview', req: step.req, plan: step.plan, content }))}
        />
      </>
    )
  }
  if (flow && step?.name === 'preview') {
    return (
      <>
        {restoredNote}
        <PreviewScreen
          req={step.req}
          plan={step.plan}
          content={step.content}
          own={step.own}
          onRegenerated={(content) => go(replace(flow, { ...step, content }))}
          onSaved={(material) => {
            // мастер закрыт: раньше он оставался на предпросмотре, и выход из
            // карточки материала возвращал к «Сохранить» — второй экземпляр
            flowDraft.clear()
            clearDraft(REQUEST_DRAFT)
            reload()
            setMatId(material.id)
          }}
          onBack={() => go(back(flow))}
        />
      </>
    )
  }
  const pending = works ?? []
  return (
    <div className="flex flex-col gap-3">
      {/* На проверку: кто сдал, какой материал — сразу в проверку одним тапом */}
      {pending.length > 0 && (
        <Card tone="warning" className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-warning-soft-fg">
            На проверку: {pending.length}
          </p>
          {pending.map((w) => (
            <button
              key={w.assignment.id}
              onClick={() => {
                setReview({ a: w.assignment, name: w.studentName })
                setMatId(w.material.id)
              }}
              className="flex items-center justify-between gap-2 rounded-xl border border-tint/[0.08] px-3 py-2 text-left transition-transform active:scale-[0.99]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {w.studentName} · {w.material.title ?? w.material.topic}
                </span>
                <span className="block text-xs text-fg-muted">
                  авто-балл {w.assignment.auto_score}/{w.assignment.auto_total}
                  {w.assignment.submitted_at
                    ? ` · сдано ${new Date(w.assignment.submitted_at).toLocaleDateString('ru-RU')}`
                    : ''}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-accent-strong">
                Проверить ›
              </span>
            </button>
          ))}
        </Card>
      )}

      <Card>
        <p className="text-sm text-fg-secondary">
          Генератор учебных текстов: тема, уровень, формат — AI составит план,
          сгенерирует текст и упражнения. Материал можно назначить ученикам или
          просто хранить в библиотеке.
        </p>
        <Button className="mt-3" onClick={() => go(START)}>
          + Создать материал
        </Button>
        {/* Остаток генераций ДО того, как в него упрёшься. Раньше о лимите
            узнавали только по отказу в середине работы — а один материал
            стоит двух генераций (план + текст), и это тоже стоит сказать. */}
        {gens && (
          <p className="mt-2 text-xs text-fg-muted">
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
        <RowsSkeleton count={3} />
      ) : loadError ? (
        <LoadError message={loadError} onRetry={reload} />
      ) : (materials ?? []).length === 0 ? (
        <p className="text-sm text-fg-muted">Библиотека пустая. Созданные материалы останутся здесь: их можно назначать разным ученикам и печатать.</p>
      ) : (
        <MaterialsByLevel
          materials={materials ?? []}
          onOpen={(material) => setMatId(material.id)}
        />
      )}
    </div>
  )
}
