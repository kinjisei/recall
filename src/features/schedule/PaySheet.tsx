// ============================================================================
// «Отметить оплату» (макеты t7-1, t7-4, d3-4; журнал п.29, 67): сколько уроков
// оплачено (+4 · +8 · +12 · своё), дата оплаты (по умолчанию сегодня), «было 3
// → станет 11». Только число уроков, без сумм: деньги Recall не касаются.
// После «Да» на пробном — та же шторка с заголовком «<имя> теперь занимается»
// и «Позже».
// ============================================================================
import { useState } from 'react'
import { addPaidLessons, dayShort, lessonsCount, type LessonBalance } from '../../domains/schedule'
import { addDays } from '../../shared/lib/days'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { DatePicker } from '../../shared/ui/DatePicker'
import { FieldButton } from '../../shared/ui/FieldButton'
import { IconArrowRight, IconCalendar, IconClose } from '../../shared/ui/icons'
import { Sheet, SHEET_BODY } from '../../shared/ui/Sheet'

type Choice = '4' | '8' | '12' | 'own'
const signed = (n: number) => (n < 0 ? `−${-n}` : String(n))

export function PaySheet({
  cardId,
  name,
  balance,
  today,
  title = 'Отметить оплату',
  later = false,
  onClose,
  onPaid,
}: {
  cardId: string
  name: string
  /** Сейчас — для «было → станет»; null — учёт ещё не вёлся. */
  balance: LessonBalance | null
  today: string
  title?: string
  /** «Позже» вместо одного крестика (после пробного, t7-4). */
  later?: boolean
  onClose: () => void
  onPaid: (count: number) => void
}) {
  const [choice, setChoice] = useState<Choice>('8')
  const [own, setOwn] = useState('')
  const [day, setDay] = useState(today)
  const [calendar, setCalendar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const count = choice === 'own' ? Number(own) : Number(choice)
  const valid = Number.isInteger(count) && count >= 1 && count <= 100
  const now = balance?.balance ?? 0

  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await addPaidLessons(cardId, count, undefined, day === today ? undefined : day)
      onPaid(count)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить оплату')
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="pay-title">
      <div className={SHEET_BODY}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="pay-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-sm text-fg-secondary">
              {name}
              {balance && balance.paid > 0 ? ` · сейчас осталось ${signed(now)}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-muted hover:bg-tint/[0.06]">
            <IconClose size={20} />
          </button>
        </div>

        <section aria-label="Сколько уроков оплачено" className="flex flex-col gap-1.5">
          <span className="text-note text-fg-muted">Сколько уроков оплачено?</span>
          <ChoiceGroup<Choice>
            label="Сколько уроков оплачено"
            stretch
            value={choice}
            onChange={setChoice}
            options={[
              { id: '4', label: '+4' },
              { id: '8', label: '+8' },
              { id: '12', label: '+12' },
              { id: 'own', label: 'Своё' },
            ]}
          />
          {choice === 'own' && (
            <input
              inputMode="numeric"
              autoFocus
              aria-label="Своё число уроков"
              placeholder="Сколько уроков"
              value={own}
              onChange={(e) => setOwn(e.target.value.replace(/\D/g, '').slice(0, 3))}
              className="min-h-12 rounded-xl bg-input px-3.5 text-base ring-1 ring-control-line outline-none focus:ring-2 focus:ring-accent-line"
            />
          )}
        </section>

        <section aria-label="Дата оплаты" className="flex flex-col gap-1.5">
          <span className="text-note text-fg-muted">Дата оплаты</span>
          <FieldButton Icon={IconCalendar} label="Дата оплаты" open={calendar} onClick={() => setCalendar((o) => !o)}>
            {day === today ? `Сегодня, ${dayShort(day)}` : dayShort(day)}
          </FieldButton>
          {calendar && (
            <DatePicker value={day} today={today} min={addDays(today, -366)} max={today} onChange={setDay} onDone={() => setCalendar(false)} label="Дата оплаты" />
          )}
        </section>

        {valid && (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-tint/[0.04] px-3 py-2.5 text-sm" data-pay-preview>
            <span className="text-fg-muted">Было {signed(now)}</span>
            <IconArrowRight size={16} aria-hidden className="text-fg-muted" />
            <span className="font-semibold">станет {lessonsCount(now + count).replace(/^-/, '−')}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger-soft-fg">
            {error}
          </p>
        )}
        <Button className="w-full" onClick={() => void save()} disabled={!valid} loading={busy}>
          Отметить
        </Button>
        {later && (
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={busy}>
            Позже
          </Button>
        )}
        <p className="text-center text-note text-fg-muted">Recall хранит только число уроков, без сумм</p>
      </div>
    </Sheet>
  )
}
