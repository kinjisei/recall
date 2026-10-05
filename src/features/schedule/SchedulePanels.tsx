// ============================================================================
// Шторки и тост расписания — одним местом: что открыто, решает
// useScheduleActions; шторка урока — по адресу (?lesson=).
// ============================================================================
import { almatyMinutes, defaultSlot, type Lesson, type LessonBalance, type Series } from '../../domains/schedule'
import { provisionalCard, type StudentCard } from '../../domains/students'
import { CardForm } from '../students'
import { UndoToast } from '../../shared/ui/UndoToast'
import { CancelSheet } from './CancelSheet'
import { LessonForm } from './LessonForm'
import { LessonSheet } from './LessonSheet'
import { MoveSheet } from './MoveSheet'
import { PaySheet } from './PaySheet'
import { TellSheet } from './TellSheet'
import type { useScheduleActions } from './useScheduleActions'

export function SchedulePanels({
  act,
  lesson,
  cards,
  series,
  balances,
  defaultLink,
  canWrite,
  today,
  now,
  closeLesson,
  refresh,
}: {
  act: ReturnType<typeof useScheduleActions>
  /** Открытый по адресу урок. */
  lesson: Lesson | null
  cards: StudentCard[]
  series: Map<string, Series>
  balances: Map<string, LessonBalance>
  defaultLink: string | null
  canWrite: boolean
  today: string
  now: Date
  closeLesson: () => void
  refresh: () => void
}) {
  const cardMap = new Map(cards.map((c) => [c.id, c]))
  const inApp = (id: string) => cardMap.get(id)?.inApp === true
  const seriesOf = (l: Lesson) => (l.seriesId ? (series.get(l.seriesId) ?? null) : null)
  const p = act.panel
  const close = () => act.setPanel(null)

  return (
    <>
      {lesson && !p && (
        <LessonSheet
          lesson={lesson}
          now={now}
          today={today}
          series={seriesOf(lesson)}
          cards={cardMap}
          balances={balances}
          canWrite={canWrite}
          busy={act.busy}
          error={act.error}
          onClose={closeLesson}
          actions={{
            onMove: () => act.setPanel({ kind: 'move', lesson }),
            onEdit: () => act.setPanel({ kind: 'form', mode: { kind: 'edit', lesson, series: seriesOf(lesson) } }),
            onCancel: () => act.setPanel({ kind: 'cancel', lesson }),
            onRestore: () => void act.restore(lesson),
            onRemind: () => act.remind(lesson),
            onMark: (cardId, outcome) => void act.mark(lesson, cardId, outcome),
            onAllPresent: () => void act.allPresent(lesson),
            onTrialAnswer: (cardId, name, stays) => void act.answerTrial(cardId, name, stays),
          }}
        />
      )}
      {p?.kind === 'form' && (
        <LessonForm
          mode={p.mode}
          cards={cards}
          defaultLink={defaultLink}
          today={today}
          now={now}
          onClose={close}
          onDone={act.done}
          onCardCreated={refresh}
        />
      )}
      {p?.kind === 'move' && (
        <MoveSheet lesson={p.lesson} series={seriesOf(p.lesson)} defaultLink={defaultLink} today={today} now={now} inApp={inApp} onClose={close} onDone={act.done} />
      )}
      {p?.kind === 'cancel' && (
        <CancelSheet
          lesson={p.lesson}
          series={seriesOf(p.lesson)}
          balance={p.lesson.kind === 'group' ? null : (balances.get(p.lesson.participants[0]?.cardId ?? '') ?? null)}
          now={now}
          inApp={inApp}
          onClose={close}
          onDone={act.done}
        />
      )}
      {p?.kind === 'paid' && (
        <PaySheet
          cardId={p.cardId}
          name={p.name}
          title={`${p.name} теперь занимается`}
          later
          balance={balances.get(p.cardId) ?? null}
          today={today}
          onClose={close}
          onPaid={(n) => {
            close()
            refresh()
            act.say(`Отмечено: +${n}`)
          }}
        />
      )}
      {p?.kind === 'card' && (
        <CardForm
          card={null}
          onClose={close}
          onSaved={(id, saved) => {
            refresh()
            // первая карточка → сразу первый урок (t2-4: пустое состояние ведёт к обоим);
            // карточку отдаём форме сразу — список ещё перечитывается
            const seed = [provisionalCard(id, saved, new Date().toISOString())]
            act.setPanel({ kind: 'form', mode: { kind: 'new', ...defaultSlot(today, today, almatyMinutes(now)), cardIds: [id], seed } })
          }}
        />
      )}
      {p?.kind === 'tell' && <TellSheet tell={p.tell} onClose={close} />}
      {act.leavingSheet}
      {act.toast && (
        <UndoToast key={act.toast.id} text={act.toast.text} actionLabel={act.toast.actionLabel} onAction={act.toast.action} onClose={act.closeToast} />
      )}
    </>
  )
}
