// ============================================================================
// «Исправить запись» задним числом (макет t7-2): урок — отметка «был / не был»
// и списание; отменённый — «поздняя отмена» ↔ «не списывать»; оплата — снять
// её записью с минусом (журнал оплат только дописывается, п.29). Рядом с
// каждым вариантом — остаток после. Запись в истории остаётся — меняется
// только отметка.
// ============================================================================
import { useState } from 'react'
import {
  addPaidLessons,
  allowedOutcomes,
  balanceAfter,
  historyRow,
  isCharged,
  lessonsCount,
  markParticipant,
  outcomeOf,
  setCancelCharge,
  type HistoryItem,
  type LessonBalance,
  type Outcome,
} from '../../domains/schedule'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { IconClose } from '../../shared/ui/icons'
import { Sheet } from '../../shared/ui/Sheet'

const signedLessons = (n: number) => (n < 0 ? `−${lessonsCount(-n)}` : lessonsCount(n))

const LABEL: Record<Outcome, string> = {
  present: 'Был, списать',
  present_free: 'Был, не списывать',
  absent: 'Не был, не списывать',
  late_cancel: 'Не был, списать — поздняя отмена',
}

export function FixRecordSheet({
  cardId,
  item,
  balance,
  now,
  onClose,
  onFixed,
}: {
  cardId: string
  item: HistoryItem
  balance: LessonBalance | null
  now: Date
  onClose: () => void
  onFixed: () => void
}) {
  const row = historyRow(item)
  const wasCharged = isCharged(item.charge)
  const tracked = (balance?.paid ?? 0) > 0
  const after = (charge: boolean) => (tracked && balance ? balanceAfter(balance.balance, wasCharged, charge) : undefined)
  const current = row.fix === 'lesson' ? outcomeOf({ attended: item.attended, charge: item.charge, trial: item.trial === true }) : null
  const outcomes =
    row.fix === 'lesson' && item.startsAt
      ? allowedOutcomes({ status: item.lessonStatus ?? 'planned', startsAt: item.startsAt }, { trial: item.trial === true }, now)
      : []
  const [choice, setChoice] = useState<string | null>(row.fix === 'cancelled' ? (wasCharged ? 'charge' : 'free') : current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (row.fix === 'payment') await addPaidLessons(cardId, -(item.n ?? 0), 'исправление')
      else if (row.fix === 'cancelled') await setCancelCharge(item.id, cardId, choice === 'charge')
      else if (choice) await markParticipant(item.id, cardId, choice as Outcome)
      onFixed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось исправить')
      setBusy(false)
    }
  }
  const unchanged = row.fix === 'cancelled' ? choice === (wasCharged ? 'charge' : 'free') : row.fix === 'lesson' ? choice === current : false

  return (
    <Sheet onClose={onClose} labelledBy="fix-title">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-1">
        <div className="flex items-center justify-between gap-3">
          <h2 id="fix-title" className="text-lg font-semibold">
            {row.fix === 'payment' ? 'Исправить оплату' : 'Исправить запись'}
          </h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-muted hover:bg-tint/[0.06]">
            <IconClose size={20} />
          </button>
        </div>
        <p className="rounded-xl bg-tint/[0.04] px-3 py-2.5 text-sm">
          <span className="font-semibold">{row.title}</span>
          <span className="block text-note text-fg-muted">{row.detail} · так записано сейчас</span>
        </p>

        {row.fix === 'payment' && (
          <p className="text-sm text-fg-secondary">
            Оплата +{item.n} отмечена по ошибке? Её снимет запись «исправление оплаты −{item.n}» — журнал оплат только
            дописывается.{tracked && balance && ` Станет ${signedLessons(balance.balance - (item.n ?? 0))}.`}
          </p>
        )}
        {row.fix === 'cancelled' && (
          <ChoiceGroup
            variant="cards"
            label="Списать урок?"
            value={choice}
            onChange={setChoice}
            options={[
              { id: 'charge', label: 'Списать — поздняя отмена', hint: after(true) },
              { id: 'free', label: 'Не списывать', hint: after(false) },
            ]}
          />
        )}
        {row.fix === 'lesson' && (
          <ChoiceGroup
            variant="cards"
            label="Как было на уроке"
            value={choice}
            onChange={setChoice}
            options={outcomes.map((o) => ({ id: o, label: LABEL[o], hint: after(o === 'present' || o === 'late_cancel') }))}
          />
        )}
        {error && (
          <p role="alert" className="text-sm text-danger-soft-fg">
            {error}
          </p>
        )}
        <Button className="w-full" variant={row.fix === 'payment' ? 'danger-outline' : 'primary'} onClick={() => void save()} disabled={unchanged || (!choice && row.fix !== 'payment')} loading={busy}>
          {row.fix === 'payment' ? `Снять оплату +${item.n}` : 'Исправить'}
        </Button>
      </div>
    </Sheet>
  )
}
