// ============================================================================
// Поиск пользователя по email или личному коду из сообщения к переводу.
// У найденного — «Подтвердить оплату» (перевёл, а «Оплата отправлена» не
// нажал; правило — confirm_payment, PLAN.md Ф2.1) и ручная правка тарифа БЕЗ
// оплаты: подарок, исправление, выключить. Ручная правка оплатой не
// считается — ни в журнале оплат, ни в воронке. Доступ проверяют RPC
// (admin_find_user, admin_set_plan, confirm_payment).
// ============================================================================
import { useState } from 'react'
import { findUsers, setPlan, type AdminUserRow, type PlanId } from '../../lib/admin'
import { Button } from '../../shared/ui/Button'
import { Picker } from '../../shared/ui/Picker'
import { IconSearch } from '../../shared/ui/icons'
import { confirmWarnings, isPaidPlan } from '../../domains/billing'
import { ConfirmPayment } from './payments/ConfirmPayment'

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Free',
  premium: 'Premium (самоучка)',
  teacher_mini: 'Учитель Mini (до 5)',
  teacher_start: 'Учитель Start (до 10)',
  teacher_pro: 'Учитель Pro (до 30)',
}

const PLAN_OPTIONS: PlanId[] = ['free', 'premium', 'teacher_mini', 'teacher_start', 'teacher_pro']
const MONTH_OPTIONS = [1, 3, 6, 12]

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function UserSearch({ onPaid }: { onPaid: () => void }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const runSearch = async () => {
    setSearching(true)
    setSearchError(null)
    try {
      const found = await findUsers(query)
      setRows(found)
      setSearched(true)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Не удалось искать')
    } finally {
      setSearching(false)
    }
  }

  const patchRow = (id: string, patch: Partial<AdminUserRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch()
          }}
          placeholder="Email, его часть или код из перевода"
          className="h-11 flex-1 rounded-xl border border-tint/[0.10] bg-input px-3.5 text-sm outline-none focus:border-accent-line"
        />
        <Button onClick={runSearch} loading={searching} className="px-4 py-0">
          <IconSearch size={18} /> Найти
        </Button>
      </div>

      {searchError && <p className="text-sm text-danger-strong">{searchError}</p>}

      {searched && !searching && rows.length === 0 && !searchError && (
        <p className="text-sm text-fg-muted">Никого не нашлось.</p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <UserRow key={row.id} row={row} onUpdated={(patch) => patchRow(row.id, patch)} onPaid={onPaid} />
        ))}
      </div>
    </div>
  )
}

function UserRow({
  row,
  onUpdated,
  onPaid,
}: {
  row: AdminUserRow
  onUpdated: (patch: Partial<AdminUserRow>) => void
  onPaid: () => void
}) {
  const [paying, setPaying] = useState(false)
  const [selPlan, setSelPlan] = useState<PlanId>(row.plan)
  const [selMonths, setSelMonths] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const apply = async () => {
    setBusy(true)
    setError(null)
    setApplied(false)
    try {
      const result = await setPlan(row.id, selPlan, selPlan === 'free' ? 0 : selMonths)
      onUpdated({ plan: result.plan, plan_expires_at: result.plan_expires_at })
      setApplied(true)
      setTimeout(() => setApplied(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось применить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade-up rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{row.email}</span>
        {row.display_name && (
          <span className="text-sm text-fg-muted">{row.display_name}</span>
        )}
        {row.code && <span className="text-sm text-fg-muted">код {row.code}</span>}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-muted">
        <span>
          План: <span className="text-fg-secondary">{PLAN_LABELS[row.plan]}</span>
        </span>
        <span>
          Действует до: <span className="text-fg-secondary">{fmtDate(row.plan_expires_at)}</span>
        </span>
        <span>
          Триал до: <span className="text-fg-secondary">{fmtDate(row.trial_until)}</span>
        </span>
        {typeof row.students === 'number' && row.students > 0 && (
          <span>
            Учеников: <span className="text-fg-secondary">{row.students}</span>
          </span>
        )}
      </div>

      {paying ? (
        <ConfirmPayment
          payer={{ id: row.id, name: row.display_name || row.email, state: row, students: row.students ?? 0 }}
          onDone={() => {
            setPaying(false)
            onPaid()
          }}
          onCancel={() => setPaying(false)}
        />
      ) : (
        <Button onClick={() => setPaying(true)} className="mt-3 min-h-11 px-4 text-sm">
          Подтвердить оплату
        </Button>
      )}

      <p className="mt-4 text-note text-fg-muted">Ручная правка без оплаты — подарок, исправление, выключить:</p>
      {/* кого из учеников покрывать, решает база (covering_teacher); здесь —
          сколько останется без покрытия и не понижается ли действующий тариф */}
      {isPaidPlan(selPlan) &&
        confirmWarnings(row, selPlan, row.students ?? 0).map((w) => (
          <p key={w} className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-soft-fg">
            {w}
          </p>
        ))}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Picker
          value={selPlan}
          onChange={(id) => setSelPlan(id as PlanId)}
          label="Тариф"
          options={PLAN_OPTIONS.map((p) => ({ id: p, label: PLAN_LABELS[p] }))}
          triggerClassName="flex h-11 items-center justify-between gap-2 rounded-xl border border-tint/[0.10] bg-input px-3 text-sm outline-none focus:border-accent-line"
        />

        {selPlan === 'free' ? (
          <span className="text-sm text-fg-muted">выключить</span>
        ) : (
          <Picker
            value={String(selMonths)}
            onChange={(id) => setSelMonths(Number(id))}
            label="Срок"
            options={MONTH_OPTIONS.map((m) => ({ id: String(m), label: `${m} мес.` }))}
            triggerClassName="flex h-11 items-center justify-between gap-2 rounded-xl border border-tint/[0.10] bg-input px-3 text-sm outline-none focus:border-accent-line"
          />
        )}

        <Button onClick={apply} loading={busy} variant="secondary" className="px-4 py-2.5 text-sm">
          {applied ? 'Применено' : 'Применить'}
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-danger-strong">{error}</p>}
    </div>
  )
}
