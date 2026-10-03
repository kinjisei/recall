// ============================================================================
// Блок «Оплаты» в /admin (PLAN.md Ф2.1): заявки «Оплата отправлена», которые
// ждут сверки с Kaspi, и последние подтверждённые оплаты. Владелец видит
// заявку и в колокольчике, но колокольчик отмечает всё прочитанным при
// открытии, а заявка висит здесь, пока её не подтвердят или не уберут.
// ============================================================================
import { useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { LoadError } from '../../../shared/ui/LoadError'
import { RowsSkeleton } from '../../../shared/ui/Loading'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import {
  dayLabel,
  dismissPaymentClaim,
  isPaidPlan,
  loadPaymentClaims,
  loadRecentPayments,
  PAY_METHODS,
  planCard,
  type ClaimRow,
  type PaymentRow,
} from '../../../domains/billing'
import { ConfirmPayment } from './ConfirmPayment'

const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** version — внешний счётчик: подтвердили оплату из поиска — список перечитывается. */
export function Payments({ version, onChanged }: { version: number; onChanged: () => void }) {
  const claims = useAsyncData(loadPaymentClaims, [version], 'Не удалось загрузить заявки')
  const recent = useAsyncData(() => loadRecentPayments(10), [version], 'Не удалось загрузить оплаты')

  return (
    <section className="rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card">
      <h2 className="font-medium">Оплаты</h2>
      <p className="mt-1 text-note text-fg-muted">
        Сверь перевод в Kaspi (код из сообщения или имя отправителя) и подтверди — тариф включится сразу, человеку
        придёт «Оплата получена». Перевёл, а кнопку не нажал — найди его поиском ниже.
      </p>

      <h3 className="mt-4 text-sm font-medium">
        Ждут подтверждения{claims.data && claims.data.length > 0 ? ` · ${claims.data.length}` : ''}
      </h3>
      <div className="mt-2 flex flex-col gap-2">
        {claims.error ? (
          <LoadError message={claims.error} onRetry={claims.reload} />
        ) : !claims.data ? (
          <RowsSkeleton count={1} />
        ) : claims.data.length === 0 ? (
          <p className="text-sm text-fg-muted">Новых заявок нет.</p>
        ) : (
          claims.data.map((c) => <Claim key={c.id} claim={c} onChanged={onChanged} />)
        )}
      </div>

      <h3 className="mt-5 text-sm font-medium">Последние оплаты</h3>
      <div className="mt-2 flex flex-col gap-1">
        {recent.error ? (
          <LoadError message={recent.error} onRetry={recent.reload} />
        ) : !recent.data ? (
          <RowsSkeleton count={1} height={40} />
        ) : recent.data.length === 0 ? (
          <p className="text-sm text-fg-muted">Пока ни одной.</p>
        ) : (
          recent.data.map((p) => <Paid key={p.id} p={p} />)
        )}
      </div>
    </section>
  )
}

function Claim({ claim, onChanged }: { claim: ClaimRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = claim.display_name || claim.email
  const plan = isPaidPlan(claim.claim_plan) ? claim.claim_plan : 'teacher_mini'

  const dismiss = async () => {
    if (!confirm(`Убрать заявку ${name}? Деньги не нашлись — человек сможет отправить её заново.`)) return
    setBusy(true)
    setError(null)
    try {
      await dismissPaymentClaim(claim.id)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось убрать')
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-tint/[0.08] p-3" data-claim={claim.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{name}</span>
        <span className="text-note text-fg-muted">{when(claim.created_at)}</span>
      </div>
      <p className="mt-1 text-sm text-fg-secondary">
        {planCard(plan).title} · {claim.months} мес · код <span className="font-medium tracking-wide">{claim.code ?? '—'}</span>
      </p>
      <p className="text-note text-fg-muted">{claim.email}</p>
      {error && <p className="mt-2 text-sm text-danger-strong">{error}</p>}
      {open ? (
        <ConfirmPayment
          payer={{ id: claim.user_id, name, state: claim, students: claim.students }}
          claim={{ id: claim.id, plan, months: claim.months }}
          onDone={onChanged}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)} className="min-h-11 px-4 text-sm">
            Подтвердить
          </Button>
          <Button variant="ghost" onClick={dismiss} loading={busy} className="min-h-11 px-4 text-sm">
            Не пришло
          </Button>
        </div>
      )}
    </div>
  )
}

function Paid({ p }: { p: PaymentRow }) {
  const method = PAY_METHODS.find((m) => m.id === p.method)?.label ?? p.method
  const plan = isPaidPlan(p.plan) ? planCard(p.plan).title : p.plan
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-tint/[0.06] py-2 text-sm last:border-b-0">
      <span>
        {p.display_name || p.email || 'аккаунт удалён'} · {plan} · {p.months} мес
      </span>
      <span className="text-fg-muted">
        {p.amount.toLocaleString('ru-RU')} ₸ · {method} · до {dayLabel(new Date(p.ends_at))}
      </span>
    </div>
  )
}
