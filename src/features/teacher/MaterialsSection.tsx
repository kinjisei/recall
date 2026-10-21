// ============================================================================
// «Материалы» преподавателя — оркестратор экранов: библиотека (макет d8-1:
// шапка «‹ Задания · Материалы» с остатком генераций и «Создать материал»,
// «На проверку», список по уровням и рядом текст материала), переходы
// библиотека → форма → план → предпросмотр → карточка материала. Сами экраны —
// в features/teacher/materials/*. Здесь только состояние и разводка.
// ============================================================================
import { useEffect, useState } from 'react'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { LoadError } from '../../shared/ui/LoadError'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { getMyPlan } from '../../lib/billing'
import { listMyMaterials } from '../../lib/materials'
import { listSubmittedWorks, type SubmittedWork } from '../../lib/reviewQueue'
import type { StudentInfo } from '../../lib/teacher'
import { useScrollTop } from '../../lib/useScrollTop'
import { useUrlState } from '../../shared/lib/useUrlState'
import { ScreenTop } from '../../shared/ui/BackButton'
import { IconPlus } from '../../shared/ui/icons'
import { ListDetail, useListDetailSplit } from '../../shared/ui/layouts'
import type { Material, MaterialAssignment } from '../../types'
import { LibraryList } from './materials/LibraryList'
import { PendingWorks } from './materials/PendingWorks'
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
import { ReviewScreen } from './ReviewScreen'

/**
 * Остаток генераций ДО того, как в него упрёшься (d8-1: «Осталось генераций
 * в этом месяце: 25 из 25»). Раньше о лимите узнавали только по отказу в
 * середине работы — а один материал стоит двух генераций (план + текст).
 */
function GensLeft({ gens }: { gens: { left: number; limit: number } }) {
  return (
    <span className="text-sm text-fg-secondary tabular-nums">
      {gens.limit === 0 ? (
        // лимит НОЛЬ — это не «закончились»: генераций не было вовсе (тариф
        // истёк). Сказать «обновятся 1-го числа» было бы неправдой.
        <>Генерация материалов входит в тариф репетитора</>
      ) : gens.left > 0 ? (
        <>
          Осталось генераций в этом месяце:{' '}
          <b className="font-semibold text-fg">
            {gens.left} из {gens.limit}
          </b>
          {gens.left < 2 && ' — на материал нужно две'}
        </>
      ) : (
        <>Генерации в этом месяце закончились — обновятся 1-го числа</>
      )}
    </span>
  )
}

export function MaterialsSection({
  students,
  startForm = false,
  onWorksChanged,
  onExit,
}: {
  students: StudentInfo[]
  /** Сразу форма нового материала — «Собрать материал» во «Заданиях» (Ф2.10). */
  startForm?: boolean
  /** Позвать, когда число работ «на проверку» могло измениться (счётчик вкладки «Задания»). */
  onWorksChanged?: () => void
  /** «‹ Задания» в шапке библиотеки — назад в хаб. */
  onExit: () => void
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
  // сданная работа — та же проверка, что из хаба «Заданий» (?work=, листалка
  // по очереди); «назад» из неё — сюда, к библиотеке
  const [, setWorkId] = useUrlState('work')
  // разбор уже проверенной работы — из «Кому выдан» карточки материала
  const [reviewing, setReviewing] = useState<{ a: MaterialAssignment; name: string } | undefined>()
  // сохранили, но кому-то назначить не вышло — скажет карточка этого материала
  const [notice, setNotice] = useState<{ id: string; text: string } | undefined>()
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
  // сданные работы — «На проверку» и «1 на проверке» в строке материала
  const { data: works } = useAsyncData<SubmittedWork[]>(() => listSubmittedWorks(), [], 'Не удалось загрузить работы')
  const split = useListDetailSplit()

  // адрес — источник правды для «какой материал открыт»; материал ищем в уже
  // загруженном списке: чужой или удалённый id показывает список, а не пустой экран
  const openMaterial = matId ? (materials ?? []).find((m) => m.id === matId) : undefined
  // у библиотеки, карточки, плана и предпросмотра своя шапка «назад» — шапку
  // раздела прячем; у формы — пока шапка раздела (её вид — d8-2, следующий шаг)
  useInnerScreen(!flow || step?.name === 'plan' || step?.name === 'preview')

  if (reviewing && openMaterial) {
    return (
      <ReviewScreen
        material={openMaterial}
        assignment={reviewing.a}
        studentName={reviewing.name}
        backLabel="Материалы"
        onDone={() => setReviewing(undefined)}
        onBack={() => setReviewing(undefined)}
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
        onOwnGenerated={(req, plan, content) => go(advance(flow, { name: 'preview', req, plan, content, own: true }))}
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
          students={students}
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
          students={students}
          onRegenerated={(content) => go(replace(flow, { ...step, content }))}
          onSaved={(material, failed) => {
            // мастер закрыт: раньше он оставался на предпросмотре, и выход из
            // карточки материала возвращал к «Сохранить» — второй экземпляр
            flowDraft.clear()
            clearDraft(REQUEST_DRAFT)
            reload()
            setNotice(failed ? { id: material.id, text: failed } : undefined)
            setMatId(material.id)
          }}
          onBack={() => go(back(flow))}
        />
      </>
    )
  }

  const pending = works ?? []
  const pendingBy = new Map<string, number>()
  for (const w of pending) pendingBy.set(w.material.id, (pendingBy.get(w.material.id) ?? 0) + 1)
  const detail = openMaterial && (
    <MaterialDetail
      key={openMaterial.id}
      material={openMaterial}
      students={students}
      initialError={notice?.id === openMaterial.id ? notice.text : undefined}
      onWorksChanged={onWorksChanged}
      onCheck={(a) => setWorkId(a.id)}
      onReview={(a, name) => setReviewing({ a, name })}
      onDeleted={() => {
        reload()
        setNotice(undefined)
        setMatId(null)
      }}
      // телефон: карточка — экраном со своим «‹ Материалы»; на компьютере список рядом
      onBack={split ? undefined : () => setMatId(null)}
    />
  )
  if (detail && !split) return detail

  return (
    <div className="flex flex-col gap-4">
      <ScreenTop
        back={{ label: 'Задания', onClick: onExit }}
        title="Материалы"
        trailing={
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {gens && <GensLeft gens={gens} />}
            <Button onClick={() => go(START)}>
              <IconPlus size={18} aria-hidden /> Создать материал
            </Button>
          </div>
        }
      />
      <PendingWorks works={pending} onCheck={(w) => setWorkId(w.assignment.id)} />
      {loadingMaterials && !materials ? (
        <RowsSkeleton count={3} />
      ) : loadError ? (
        <LoadError message={loadError} onRetry={reload} />
      ) : (materials ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-fg-muted">
            Библиотека пустая. Созданные материалы останутся здесь: их можно выдавать разным ученикам и печатать.
          </p>
        </Card>
      ) : (
        <ListDetail
          fill
          list={<LibraryList materials={materials ?? []} pending={pendingBy} selectedId={openMaterial?.id ?? null} onOpen={(m) => setMatId(m.id)} />}
          detail={detail || null}
          empty="Выбери материал слева — откроются текст, упражнения и кому он выдан."
        />
      )}
    </div>
  )
}
