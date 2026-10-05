// ============================================================================
// «Задания» учителя — хаб (макет t1-3, PLAN.md Ф2.10): проверка работ (кто
// сдал — нажал и сразу в разбор), материалы с энергией студии, письменные
// задания, методичка. Сами разделы — прежние экраны студии.
// ============================================================================
import { useEffect, useState } from 'react'
import { whenLabel } from '../../domains/notifications'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { plural } from '../../shared/lib/plural'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { RowCard } from '../../shared/ui/RowCard'
import { IconArrowRight, IconBook, IconClipboardCheck, IconPencil, IconSparkle, type IconLike } from '../../shared/ui/icons'
import { Avatar } from '../students'
import { StudioEnergy, hasStudioEnergy } from './StudioEnergy'
import { loadWaitingWorks, type WaitingWork } from './waitingWorks'

export type TaskSection = 'materials' | 'writing' | 'guide'

/** Сколько сданных работ видно в карточке; остальные — «и ещё N». */
const SHOWN = 4

function workLine(w: WaitingWork): string {
  const what = w.kind === 'writing' ? 'Письмо' : `«${w.material.title ?? w.material.topic}»`
  return w.assignment.submitted_at ? `${what} · ${whenLabel(w.assignment.submitted_at)}` : what
}

function Tile({ Icon }: { Icon: IconLike }) {
  return (
    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-soft-fg">
      <Icon size={22} />
    </span>
  )
}

function Review({ onReview }: { onReview: (id: string) => void }) {
  const { data, error, loading, reload } = useAsyncData(loadWaitingWorks, [], 'Не удалось загрузить сданные работы')
  const list = data ?? []
  const n = list.length
  const rest = n - SHOWN
  return (
    // ждут проверки — карточка выделена, как в макете; пусто — обычная
    <section className={`overflow-hidden rounded-2xl border bg-surface shadow-card ${n ? 'border-accent-line' : 'border-tint/[0.08]'}`}>
      <div className="flex items-start gap-3 p-4">
        <Tile Icon={IconClipboardCheck} />
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold">Проверка работ</h2>
          <p className="text-note text-fg-muted">Письма и задания по материалам</p>
        </div>
        {n > 0 && (
          <span className="flex-none rounded-full bg-accent px-2.5 py-1 text-note font-semibold text-accent-fg">
            {n} {plural(n, 'ждёт', 'ждут', 'ждут')}
          </span>
        )}
      </div>
      {error ? (
        <div className="px-4 pb-4">
          <LoadError message={error} onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="px-4 pb-4">
          <RowsSkeleton count={2} height={56} />
        </div>
      ) : n === 0 ? (
        <p className="px-4 pb-4 text-sm text-fg-muted">
          Сданных работ нет. Как только ученик сдаст письмо или задание, оно появится здесь.
        </p>
      ) : (
        <>
          <div className="divide-y divide-tint/[0.06] border-t border-tint/[0.06]">
            {list.slice(0, SHOWN).map((w) => (
              <RowCard
                key={w.assignment.id}
                flat
                lead={<Avatar name={w.studentName} inApp small />}
                title={w.studentName}
                desc={workLine(w)}
                onClick={() => onReview(w.assignment.id)}
              />
            ))}
          </div>
          {rest > 0 && (
            <p className="px-4 pt-2 text-note text-fg-muted">
              и ещё {rest} {plural(rest, 'работа', 'работы', 'работ')} — дальше по очереди
            </p>
          )}
          <div className="p-4 pt-3">
            {/* первой — та, что ждёт дольше всех */}
            <Button className="w-full" onClick={() => list[0] && onReview(list[0].assignment.id)}>
              Проверить
            </Button>
          </div>
        </>
      )}
    </section>
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

  return (
    <div className="flex flex-col gap-3">
      <Review onReview={onReview} />

      {/* макет t1-3 и правка владельца 05.10.2026: без лишних слов — строка
          энергии и одна кнопка; библиотека — по заголовку карточки (стрелка,
          как у соседних карточек), иначе до готовых материалов не добраться */}
      <Card className="flex flex-col gap-4">
        <button type="button" onClick={() => onSection('materials')} className="flex items-start gap-3 text-left">
          <Tile Icon={IconSparkle} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body font-semibold">Материалы</span>
            <span className="text-note text-fg-muted">AI соберёт текст и упражнения под ученика</span>
          </span>
          <IconArrowRight size={16} className="mt-1 flex-none text-fg-faint" aria-hidden />
        </button>
        {hasStudioEnergy(plan) && <StudioEnergy plan={plan} />}
        <Button variant="secondary" className="w-full" onClick={() => onSection('materials', true)}>
          Собрать материал
        </Button>
      </Card>

      <RowCard
        Icon={IconPencil}
        title="Письменные задания"
        desc="IELTS и эссе с разбором AI"
        onClick={() => onSection('writing')}
      />
      <RowCard
        Icon={IconBook}
        title="Методичка"
        desc="Цикл занятий, диагностика, методики"
        onClick={() => onSection('guide')}
      />
    </div>
  )
}
