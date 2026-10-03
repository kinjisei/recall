// ============================================================================
// «Подтвердить оплату» (PLAN.md Ф2.1). Владелец сверил перевод в Kaspi и
// подтверждает: база одной транзакцией пишет оплату, продлевает тариф,
// закрывает заявку и шлёт человеку «Оплата получена» (confirm_payment).
//
// Подсказка «станет: … до …» считается клиентской копией правила продления
// (domains/billing, termAfterPayment) — сервер считает сам, пара сверяется
// check-billing.mjs. Номер нажатия (requestId) живёт, пока форма открыта:
// ответ потерялся, нажал ещё раз — база вернёт ту же оплату, второго
// продления не будет.
// ============================================================================
import { useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { ChoiceGroup } from '../../../shared/ui/ChoiceGroup'
import {
  amountFor,
  confirmPayment,
  confirmWarnings,
  dayLabel,
  PAID_PLANS,
  PAY_METHODS,
  planCard,
  planNowLabel,
  planShortTitle,
  termAfterPayment,
  type ConfirmResult,
  type PaidPlan,
  type PayMethod,
  type PlanState,
} from '../../../domains/billing'

const MONTHS = ['1', '3', '6', '12'] as const

export interface PayerInfo {
  id: string
  name: string
  state: PlanState
  students: number
}

export function ConfirmPayment({
  payer,
  claim,
  onDone,
  onCancel,
}: {
  payer: PayerInfo
  /** Заявка, которую закрывает эта оплата (из списка «Ждут подтверждения»). */
  claim?: { id: string; plan: PaidPlan; months: number }
  onDone: (r: ConfirmResult) => void
  onCancel: () => void
}) {
  const [plan, setPlan] = useState<PaidPlan>(claim?.plan ?? 'teacher_mini')
  const [months, setMonths] = useState(String(claim?.months ?? 1))
  // сумма — то, что пришло на счёт; пока её не трогали, следует за тарифом
  const [amountText, setAmountText] = useState<string | null>(null)
  const [method, setMethod] = useState<PayMethod>('kaspi_gold')
  const [note, setNote] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const m = Number(months)
  const amount = amountText === null ? amountFor(plan, m) : Number(amountText.replace(/\s/g, ''))
  const term = termAfterPayment(payer.state, m)
  const warnings = confirmWarnings(payer.state, plan, payer.students)
  const amountOk = Number.isInteger(amount) && amount > 0

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(
        await confirmPayment({ userId: payer.id, plan, months: m, amount, method, note, claimId: claim?.id, requestId }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось подтвердить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-tint/[0.04] p-3">
      <p className="text-note text-fg-muted">Сейчас: {planNowLabel(payer.state)}</p>
      <ChoiceGroup
        label="Тариф"
        value={plan}
        onChange={setPlan}
        options={PAID_PLANS.map((id) => ({ id, label: planShortTitle(id) }))}
      />
      <ChoiceGroup label="Срок" value={months} onChange={setMonths} options={MONTHS.map((id) => ({ id, label: `${id} мес` }))} />
      <label className="flex flex-col gap-1 text-note text-fg-muted">
        Сколько пришло, ₸
        <input
          value={amountText ?? String(amount)}
          onChange={(e) => setAmountText(e.target.value)}
          inputMode="numeric"
          className="h-11 rounded-xl border border-tint/[0.10] bg-input px-3.5 text-sm text-fg outline-none focus:border-accent-line"
        />
      </label>
      <ChoiceGroup label="Способ" value={method} onChange={setMethod} options={PAY_METHODS.map((p) => ({ id: p.id, label: p.label }))} />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Заметка (необязательно): от кого перевод, если без кода"
        className="h-11 rounded-xl border border-tint/[0.10] bg-input px-3.5 text-sm outline-none focus:border-accent-line"
      />

      <p className="text-sm">
        Станет: <span className="font-medium">{planCard(plan).title}</span> до {dayLabel(term.end)}
        <span className="text-fg-muted"> (срок с {dayLabel(term.start)})</span>
      </p>
      {warnings.map((w) => (
        <p key={w} className="rounded-xl bg-warning/10 px-3 py-2 text-note text-warning-soft-fg">
          {w}
        </p>
      ))}
      {error && <p className="text-sm text-danger-strong">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} loading={busy} disabled={!amountOk} className="min-h-11 px-4 text-sm">
          Подтвердить оплату {amountOk ? `${amount.toLocaleString('ru-RU')} ₸` : ''}
        </Button>
        <Button variant="ghost" onClick={onCancel} className="min-h-11 px-4 text-sm">
          Отмена
        </Button>
      </div>
      <p className="text-caption text-fg-muted">Подтверждение — {payer.name}. Тариф включится сразу.</p>
    </div>
  )
}
