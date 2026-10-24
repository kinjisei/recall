// ============================================================================
// «Задания» учителя — хаб (макеты t1-3 — телефон, d7-1 — компьютер; PLAN.md
// Ф2.10, Ф2.17-4в-1): проверка работ (кто сдал — сразу в разбор), материалы с
// энергией студии, письменные задания, методичка. Сами разделы — свои экраны.
//
// Компьютер (d7-1): слева «Проверка работ» — в строке что сдано, отрывок и
// «Проверить», справа материалы, письма и методичка. Проверять нечего —
// проверка сжимается до строки «Всё проверено · последняя работа — вчера»,
// материалы переходят в главную колонку, «Собрать материал» — главная кнопка.
// ============================================================================
import { useEffect, useState, type ReactNode } from 'react'
import { whenDone } from '../../domains/schedule'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { writingName } from '../../lib/writingLabels'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useOnReturn } from '../../shared/lib/useOnReturn'
import { plural } from '../../shared/lib/plural'
import { Avatar } from '../../shared/ui/Avatar'
import { Button, buttonClass } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { RowCard } from '../../shared/ui/RowCard'
import { MainAside, useAsideSplit } from '../../shared/ui/layouts'
import {
  IconArrowRight,
  IconBook,
  IconCheck,
  IconChevronRight,
  IconClipboardCheck,
  IconPencil,
  IconSparkle,
  type IconLike,
} from '../../shared/ui/icons'
import { StudioEnergy, hasStudioEnergy } from './StudioEnergy'
import { loadLastReviewedAt, loadWaitingWorks, type WaitingWork } from './waitingWorks'

export type TaskSection = 'materials' | 'writing' | 'guide'

/** Сколько сданных работ видно в карточке; остальные — «и ещё N», дальше — листалкой в разборе. */
const SHOWN = 4

/** «Письмо IELTS Task 2 · сегодня, 15:40» / «"My morning" · задание по материалу · вчера, 9:10». */
function workLine(w: WaitingWork, short: boolean): string {
  const when = whenDone(w.assignment.submitted_at)
  const what =
    w.kind === 'writing'
      ? writingName(w.task)
      : `«${w.material.title ?? w.material.topic}»${short ? '' : ' · задание по материалу'}`
  return when ? `${what} · ${when}` : what
}

/** Третья строка (d7-1): начало письма или что предлагает AI по упражнениям. */
function workPreview(w: WaitingWork): string {
  if (w.kind === 'writing') {
    const text = (w.assignment.essay ?? '').trim().replace(/\s+/g, ' ')
    return text ? `«${text}…»` : ''
  }
  const total = w.material.exercises.length
  const ex = plural(total, 'упражнение', 'упражнения', 'упражнений')
  const ai = w.assignment.ai_review
  return ai ? `${total} ${ex} · AI предлагает засчитать ${ai.filter((r) => r.ok).length} из ${total}` : `${total} ${ex}`
}

/** Разбор AI уже лежит — проверка откроется сразу, без ожидания. */
const aiReady = (w: WaitingWork) => !!w.assignment.ai_review

function Tile({ Icon }: { Icon: IconLike }) {
  return (
    <span className="flex size-11 flex-none items-center justify-center rounded-control-sm bg-accent-soft text-accent-soft-fg">
      <Icon size={22} />
    </span>
  )
}

/** Строка сданной работы на компьютере (d7-1 `.qr`): кто, что, отрывок, «черновик AI готов», «Проверить». */
function WorkRow({ w, first, onReview }: { w: WaitingWork; first: boolean; onReview: (id: string) => void }) {
  return (
    <button
      type="button"
      data-row
      onClick={() => onReview(w.assignment.id)}
      className="flex w-full items-center gap-3.5 border-t border-line px-5 py-4 text-left transition-colors duration-(--dur-1) hover:bg-row-press active:bg-row-press"
    >
      <Avatar name={w.studentName} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base font-semibold text-fg">{w.studentName}</span>
        <span className="text-sm text-fg-secondary">{workLine(w, false)}</span>
        <span className="truncate text-note text-fg-muted">{workPreview(w)}</span>
      </span>
      {aiReady(w) && (
        <span className="inline-flex h-6 flex-none items-center gap-1 whitespace-nowrap rounded-full bg-input px-2 text-xs font-medium text-fg-secondary">
          <IconSparkle size={12} aria-hidden />
          черновик AI готов
        </span>
      )}
      <span aria-hidden className={`${buttonClass(first ? 'primary' : 'secondary', 'sm')} flex-none px-3.5`}>
        Проверить
      </span>
    </button>
  )
}

type Works = ReturnType<typeof useAsyncData<WaitingWork[]>>

function ReviewCard({ wide, works, onReview }: { wide: boolean; works: Works; onReview: (id: string) => void }) {
  const { data, error, loading, reload } = works
  const list = data ?? []
  const n = list.length
  const rest = n - SHOWN
  const badge = n > 0 && `${n} ${plural(n, 'ждёт', 'ждут', 'ждут')}`

  const body = error ? (
    <div className="px-4 pb-4">
      <LoadError message={error} onRetry={reload} />
    </div>
  ) : loading && !data ? (
    <div className="px-4 pb-4">
      <RowsSkeleton count={2} height={56} />
    </div>
  ) : wide ? (
    list.slice(0, SHOWN).map((w, i) => <WorkRow key={w.assignment.id} w={w} first={i === 0} onReview={onReview} />)
  ) : (
    <>
      <div className="divide-y divide-line border-t border-line">
        {list.slice(0, SHOWN).map((w) => (
          <RowCard
            key={w.assignment.id}
            flat
            lead={<Avatar name={w.studentName} />}
            title={w.studentName}
            desc={workLine(w, true)}
            onClick={() => onReview(w.assignment.id)}
          />
        ))}
      </div>
    </>
  )
  const more = rest > 0 && (
    <p className={`text-note text-fg-muted ${wide ? 'border-t border-line px-5 py-3' : 'px-4 pt-2'}`}>
      и ещё {rest} {plural(rest, 'работа', 'работы', 'работ')} — дальше по очереди
    </p>
  )

  if (wide) {
    return (
      <section aria-label="Проверка работ" className="overflow-hidden rounded-card bg-surface shadow-card">
        <header className="flex items-baseline gap-2.5 px-5 pb-3 pt-4.5">
          <h2 className="text-lg font-semibold text-fg">Проверка работ</h2>
          {badge && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-note font-semibold text-accent-soft-fg">{badge}</span>}
          {n > 1 && <small className="ml-auto text-note text-fg-muted">старые — ниже</small>}
        </header>
        {body}
        {more}
      </section>
    )
  }
  return (
    // телефон (t1-3): ждут проверки — карточка выделена, одна кнопка «Проверить» под строками
    <section aria-label="Проверка работ" className={`overflow-hidden rounded-card border bg-surface shadow-card ${n ? 'border-accent-line' : 'border-transparent'}`}>
      <div className="flex items-start gap-3 p-4">
        <Tile Icon={IconClipboardCheck} />
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold">Проверка работ</h2>
          <p className="text-note text-fg-muted">Письма и задания по материалам</p>
        </div>
        {badge && <span className="flex-none rounded-full bg-accent px-2.5 py-1 text-note font-semibold text-accent-fg">{badge}</span>}
      </div>
      {body}
      {more}
      {n > 0 && (
        <div className="p-4 pt-3">
          {/* первой — та, что сдана последней (как в списке) */}
          <Button className="w-full" onClick={() => list[0] && onReview(list[0].assignment.id)}>
            Проверить
          </Button>
        </div>
      )}
    </section>
  )
}

/** Проверять нечего (схема d7-1): строка вместо карточки. */
function AllChecked() {
  // дата — подпись, а не повод для плашки: не пришла — «Всё проверено» без неё
  const { data: last } = useAsyncData(loadLastReviewedAt, [], '')
  return (
    <section aria-label="Проверка работ" className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-row bg-surface px-4 py-3 shadow-card">
      <IconCheck size={18} aria-hidden className="flex-none text-success-strong" />
      <span className="text-body font-semibold text-fg">{last === null ? 'Сданных работ пока нет' : 'Всё проверено'}</span>
      {last && <span className="text-sm text-fg-muted">· последняя работа — {whenDone(last)}</span>}
    </section>
  )
}

function MaterialsCard({
  wide,
  main,
  plan,
  onOpen,
  onCreate,
}: {
  wide: boolean
  /** Главная колонка (проверять нечего): «Собрать материал» — главная кнопка. */
  main: boolean
  plan: MyPlan | null
  onOpen: () => void
  onCreate: () => void
}) {
  // макет t1-3 и правка владельца 05.10.2026: без лишних слов — строка
  // энергии и одна кнопка; библиотека — по заголовку карточки (стрелка),
  // иначе до готовых материалов не добраться (d7-1 стрелку не рисует)
  const head = wide ? (
    <button type="button" onClick={onOpen} className="-mx-1 -my-1.5 flex min-h-11 items-center gap-2.5 rounded-control-sm px-1 text-left active:bg-ghost-press">
      <IconSparkle size={20} aria-hidden className="flex-none text-accent-strong" />
      <span className="flex-1 text-base font-semibold text-fg">Материалы</span>
      <IconChevronRight size={18} aria-hidden className="flex-none text-fg-faint" />
    </button>
  ) : (
    <button type="button" onClick={onOpen} className="flex items-start gap-3 text-left">
      <Tile Icon={IconSparkle} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-semibold">Материалы</span>
        <span className="text-note text-fg-muted">AI соберёт текст и упражнения под ученика</span>
      </span>
      <IconArrowRight size={16} className="mt-1 flex-none text-fg-faint" aria-hidden />
    </button>
  )
  return (
    <Card className={`flex flex-col ${wide ? 'gap-2.5 p-4.5!' : 'gap-4'}`}>
      {head}
      {wide && <p className="text-sm text-fg-secondary">AI соберёт текст и упражнения под ученика</p>}
      {hasStudioEnergy(plan) && <StudioEnergy plan={plan} />}
      <Button variant={main ? 'primary' : 'secondary'} size={wide && !main ? 'sm' : 'md'} className="w-full" onClick={onCreate}>
        Собрать материал
      </Button>
    </Card>
  )
}

/** Письменные задания и методичка: на компьютере — строка в карточке (d7-1 `.sc7 .rowa`), на телефоне — строка-карточка. */
function SectionRow({ wide, Icon, title, desc, onClick }: { wide: boolean; Icon: IconLike; title: string; desc: string; onClick: () => void }) {
  if (!wide) return <RowCard Icon={Icon} title={title} desc={desc} onClick={onClick} />
  return (
    <Card className="overflow-hidden p-0!">
      <RowCard flat lead={<Icon size={20} aria-hidden className="flex-none text-accent-strong" />} title={title} desc={desc} onClick={onClick} className="py-3.5 pl-4.5" />
    </Card>
  )
}

export function TasksHub({
  onSection,
  onReview,
}: {
  /** form — «Собрать материал»: раздел материалов сразу с формой. */
  onSection: (s: TaskSection, form?: boolean) => void
  onReview: (assignmentId: string) => void
}) {
  // энергия студии — необязательная подпись: не пришла — карточка без неё
  const [plan, setPlan] = useState<MyPlan | null>(null)
  useEffect(() => {
    let alive = true
    getMyPlan()
      .then((p) => alive && setPlan(p))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const wide = useAsideSplit()
  const works = useAsyncData(loadWaitingWorks, [], 'Не удалось загрузить сданные работы')
  // ученик сдал работу, пока приложение было свёрнуто, — список узнает сам
  useOnReturn(works.reload)
  const quiet = !!works.data && works.data.length === 0

  const materials = (
    <MaterialsCard wide={wide} main={quiet} plan={plan} onOpen={() => onSection('materials')} onCreate={() => onSection('materials', true)} />
  )
  const rest: ReactNode = (
    <>
      <SectionRow wide={wide} Icon={IconPencil} title="Письменные задания" desc="IELTS и эссе с разбором AI" onClick={() => onSection('writing')} />
      <SectionRow wide={wide} Icon={IconBook} title="Методичка" desc="Цикл занятий, диагностика, методики" onClick={() => onSection('guide')} />
    </>
  )
  return (
    <MainAside
      label="Разделы заданий"
      main={
        <div className="flex flex-col gap-3.5">
          {quiet ? <AllChecked /> : <ReviewCard wide={wide} works={works} onReview={onReview} />}
          {quiet && materials}
        </div>
      }
      aside={
        <>
          {!quiet && materials}
          {rest}
        </>
      }
    />
  )
}
