// ============================================================================
// Шторка урока (макеты t4-1 … t4-3, t5-4, t9-3): когда, повтор, «Войти в
// урок», остаток, после урока — кто был (MarksBlock), действия: перенести,
// изменить, отменить, напомнить, карточка ученика. Отменённый — «Вернуть
// урок». Без тарифа — всё видно, действия выключены с объяснением.
// Открыт ли урок — в адресе (?lesson=): «назад» закрывает шторку.
// ============================================================================
import {
  canEdit,
  dayTitle,
  durationLabel,
  lessonBadge,
  lessonDay,
  lessonMinutes,
  lessonName,
  lessonPhase,
  lessonsCount,
  movedFromLabel,
  relativeLabel,
  repeatLabel,
  timeRange,
  type Lesson,
  type LessonBalance,
  type Outcome,
  type Series,
} from '../../domains/schedule'
import type { StudentCard } from '../../domains/students'
import { Button } from '../../shared/ui/Button'
import { IconClose, IconPencil, IconRefresh, IconRepeat, IconReschedule, IconSend, IconTicket, IconUser, IconVideo, IconXCircle } from '../../shared/ui/icons'
import { plural } from '../../shared/lib/plural'
import { RowCard } from '../../shared/ui/RowCard'
import { Sheet } from '../../shared/ui/Sheet'
import { Badge, LessonAvatar } from './LessonParts'
import { MarksBlock } from './MarksBlock'
import { PlanRequired } from './ReadOnly'

export interface LessonSheetActions {
  onMove: () => void
  onEdit: () => void
  onCancel: () => void
  onRestore: () => void
  onRemind: () => void
  onMark: (cardId: string, outcome: Outcome) => void
  onAllPresent: () => void
  onTrialAnswer: (cardId: string, name: string, stays: boolean) => void
}

function subtitle(l: Lesson, inApp: (id: string) => boolean): string {
  const n = l.participants.length
  if (l.kind === 'group') return `Группа · ${n} ${plural(n, 'ученик', 'ученика', 'учеников')}`
  const p = l.participants[0]
  const where = p && inApp(p.cardId) ? 'в приложении' : 'без приложения'
  return `${l.kind === 'trial' || p?.trial ? 'Пробный' : 'Индивидуальный'} · ${where}`
}

/** «Осталось 3 урока» — только если учитель ведёт учёт (отмечал оплаты); минус виден учителю (журнал п.29). */
function balanceLine(b: LessonBalance | undefined): string | null {
  if (!b || b.paid <= 0) return null
  if (b.balance <= 0) return b.balance === 0 ? 'Оплаченные уроки закончились' : `Остаток −${lessonsCount(-b.balance)}`
  return `Осталось ${lessonsCount(b.balance)}`
}

export function LessonSheet({
  lesson,
  now,
  today,
  series,
  cards,
  balances,
  canWrite,
  busy,
  error,
  onClose,
  actions,
}: {
  lesson: Lesson
  now: Date
  today: string
  series: Series | null
  cards: Map<string, StudentCard>
  balances: Map<string, LessonBalance>
  canWrite: boolean
  busy: boolean
  /** Действие не прошло — причина словами. */
  error: string | null
  onClose: () => void
  actions: LessonSheetActions
}) {
  const inApp = (id: string) => cards.get(id)?.inApp === true
  const phase = lessonPhase(lesson, now)
  const badge = lessonBadge(lesson, now)
  const group = lesson.kind === 'group'
  const single = group ? null : (lesson.participants[0] ?? null)
  const balance = single ? balanceLine(balances.get(single.cardId)) : null
  const cancelled = phase === 'cancelled'
  const askTrial = single && single.trial && single.cardStatus === 'trial' && (phase === 'unmarked' || phase === 'done') && single.attended !== false
  const moved = movedFromLabel(lesson)

  return (
    <Sheet onClose={onClose} labelledBy="lesson-title" maxH="88dvh">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-1">
        <div className="flex items-center gap-3">
          <LessonAvatar lesson={lesson} inApp={inApp} />
          <div className="min-w-0 flex-1">
            <h2 id="lesson-title" className="truncate text-lg font-semibold">
              {lessonName(lesson)}
            </h2>
            <p className="text-note text-fg-muted">{subtitle(lesson, inApp)}</p>
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-muted hover:bg-tint/[0.06]">
            <IconClose size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xl font-bold">{dayTitle(lessonDay(lesson), today)}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-secondary">
            <span className="tabular-nums">{timeRange(lesson)}</span>· {durationLabel(lessonMinutes(lesson))}
            {(phase === 'upcoming' || phase === 'live') && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent-soft-fg">{relativeLabel(lesson, now)}</span>
            )}
          </p>
          {(series || moved) && (
            <p className="flex items-center gap-1.5 text-note text-fg-muted">
              <IconRepeat size={15} aria-hidden />
              {[moved && `Перенесён ${moved}`, series && repeatLabel(series.weekdays, series.everyWeeks)].filter(Boolean).join(' · ')}
            </p>
          )}
          {badge && <Badge badge={badge} className="self-start" />}
        </div>

        {lesson.link && !cancelled && (
          <div className="flex flex-col gap-1">
            <Button className="w-full" onClick={() => window.open(lesson.link ?? '', '_blank', 'noopener,noreferrer')}>
              <IconVideo size={20} aria-hidden /> Войти в урок
            </Button>
            <p className="truncate text-center text-caption text-fg-muted">{lesson.link.replace(/^https?:\/\//, '')}</p>
          </div>
        )}

        {balance && (
          <p className="flex items-center gap-2 text-sm text-fg-secondary">
            <IconTicket size={18} aria-hidden className="text-fg-muted" /> {balance}
          </p>
        )}

        {askTrial && single && canWrite && (
          <div className="flex flex-col gap-2 rounded-2xl border border-accent-line p-3">
            <p className="text-sm font-semibold">{single.name} остаётся заниматься?</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="min-h-11 flex-1 py-2 text-sm" disabled={busy} onClick={() => actions.onTrialAnswer(single.cardId, single.name, true)}>
                Да
              </Button>
              <Button variant="ghost" className="min-h-11 flex-1 py-2 text-sm" disabled={busy} onClick={() => actions.onTrialAnswer(single.cardId, single.name, false)}>
                Нет
              </Button>
            </div>
          </div>
        )}

        {!cancelled && phase !== 'upcoming' && (
          <MarksBlock
            lesson={lesson}
            now={now}
            inApp={inApp}
            balances={balances}
            canWrite={canWrite}
            busy={busy}
            onMark={actions.onMark}
            onAllPresent={actions.onAllPresent}
          />
        )}

        {group && (phase === 'upcoming' || cancelled) && (
          <section aria-label="Участники" className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold text-fg-secondary">Участники · {lesson.participants.length}</h3>
            <div className="divide-y divide-tint/[0.06] overflow-hidden rounded-2xl border border-tint/[0.08]">
              {lesson.participants.map((p) => (
                <RowCard key={p.cardId} flat to={`/teacher?student=${p.cardId}`} title={p.name} desc={inApp(p.cardId) ? undefined : 'без приложения'} />
              ))}
            </div>
            {phase === 'upcoming' && <p className="text-note text-fg-muted">После урока здесь отмечается, кто был.</p>}
          </section>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger-soft-fg">
            {error}
          </p>
        )}
        {!canWrite && <PlanRequired />}

        <nav aria-label="Действия с уроком" className="divide-y divide-tint/[0.06] overflow-hidden rounded-2xl border border-tint/[0.08]">
          {cancelled ? (
            <RowCard flat Icon={IconRefresh} title="Вернуть урок" onClick={actions.onRestore} disabled={!canWrite || busy} />
          ) : (
            <>
              {canEdit(lesson) && <RowCard flat Icon={IconReschedule} title="Перенести" onClick={actions.onMove} disabled={!canWrite} />}
              {canEdit(lesson) && <RowCard flat Icon={IconPencil} title="Изменить" onClick={actions.onEdit} disabled={!canWrite} />}
              {(phase === 'upcoming' || phase === 'live') && <RowCard flat Icon={IconSend} title="Напомнить об уроке" onClick={actions.onRemind} />}
              <RowCard flat Icon={IconXCircle} title="Отменить урок" onClick={actions.onCancel} disabled={!canWrite} />
            </>
          )}
          {single && <RowCard flat Icon={IconUser} title="Карточка ученика" to={`/teacher?student=${single.cardId}`} />}
        </nav>
      </div>
    </Sheet>
  )
}
