// ============================================================================
// Поиск пользователя по email и ручная правка тарифа (включить, продлить,
// снять). Вынесено из AdminPage.tsx без изменений: страница админки выросла
// за предел размера файла. Доступ проверяют RPC (admin_find_user,
// admin_set_plan).
// ============================================================================
import { useState } from 'react'
import { findUsers, setPlan, type AdminUserRow, type PlanId } from '../../lib/admin'
import { Button } from '../../shared/ui/Button'
import { Picker } from '../../shared/ui/Picker'
import { IconSearch } from '../../shared/ui/icons'

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

export function UserSearch() {
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
          placeholder="Email или его часть"
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
          <UserRow key={row.id} row={row} onUpdated={(patch) => patchRow(row.id, patch)} />
        ))}
      </div>
    </div>
  )
}

function UserRow({
  row,
  onUpdated,
}: {
  row: AdminUserRow
  onUpdated: (patch: Partial<AdminUserRow>) => void
}) {
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

      {/* У преподавателя без тарифа мест не ограничено, и при покупке МЛАДШЕГО
          тарифа все набранные ученики разом получают платные лимиты AI.
          Проверка мест стоит только при привязке, при активации не пересчитывается —
          поэтому предупреждаем глазами. */}
      {typeof row.students === 'number' &&
        row.students > 5 &&
        !row.plan.startsWith('teacher_') && (
          <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-soft-fg">
            У этого аккаунта уже {row.students} учеников. После включения тарифа все они
            получат повышенные лимиты AI — проверь, что это ожидаемо.
          </p>
        )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
