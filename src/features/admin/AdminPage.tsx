// ============================================================================
// Мини-админка владельца (роут /admin). Поиск ученика/учителя по email после
// Kaspi-перевода → включение или продление платного плана вручную.
// Охрана — get_my_plan().is_admin; сам доступ на сервере проверяют RPC
// (admin_find_user/admin_set_plan), эта проверка только чтобы не показывать
// экран не-владельцу.
// ============================================================================
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { findUsers, setPlan, type AdminUserRow, type PlanId } from '../../lib/admin'
import { Button } from '../../components/Button'
import { IconSearch, IconWarning, IconSpinner, IconHome } from '../../components/icons'

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Free',
  premium: 'Premium (самоучка)',
  teacher_mini: 'Учитель Mini (до 5)',
  teacher_start: 'Учитель Start (до 10)',
  teacher_pro: 'Учитель Pro (до 30)',
}

const PLAN_OPTIONS: PlanId[] = ['free', 'premium', 'teacher_mini', 'teacher_start', 'teacher_pro']
const MONTH_OPTIONS = [1, 3, 6, 12]

type GuardState = 'checking' | 'allowed' | 'denied'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AdminPage() {
  const [guard, setGuard] = useState<GuardState>('checking')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('get_my_plan')
        if (cancelled) return
        if (error || !data || !(data as { is_admin?: boolean }).is_admin) {
          setGuard('denied')
        } else {
          setGuard('allowed')
        }
      } catch {
        if (!cancelled) setGuard('denied')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (guard === 'checking') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--night-text-40)]">
        <IconSpinner size={24} className="animate-spin" />
      </div>
    )
  }

  if (guard === 'denied') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-[var(--night-text-40)]">
          <IconWarning size={26} />
        </span>
        <h1 className="text-xl font-medium">Доступно только владельцу</h1>
        <p className="max-w-xs text-sm text-[var(--night-text-40)]">
          У этого аккаунта нет прав администратора.
        </p>
        <Link to="/">
          <Button variant="secondary" className="mt-2">
            <IconHome size={18} /> На главную
          </Button>
        </Link>
      </div>
    )
  }

  return <AdminConsole />
}

function AdminConsole() {
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
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Админка</h1>
        <p className="mt-1 text-sm text-[var(--night-text-40)]">
          Оплата пришла на Kaspi → найди по email из комментария перевода → включи план.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch()
          }}
          placeholder="Email или его часть"
          className="h-11 flex-1 rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-3.5 text-sm outline-none focus:border-[var(--night-accent-45)]"
        />
        <Button onClick={runSearch} loading={searching} className="px-4 py-0">
          <IconSearch size={18} /> Найти
        </Button>
      </div>

      {searchError && <p className="text-sm text-red-400">{searchError}</p>}

      {searched && !searching && rows.length === 0 && !searchError && (
        <p className="text-sm text-[var(--night-text-40)]">Никого не нашлось.</p>
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
    <div className="animate-fade-up rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{row.email}</span>
        {row.display_name && (
          <span className="text-sm text-[var(--night-text-40)]">{row.display_name}</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--night-text-40)]">
        <span>
          План: <span className="text-[var(--night-text-70)]">{PLAN_LABELS[row.plan]}</span>
        </span>
        <span>
          Действует до: <span className="text-[var(--night-text-70)]">{fmtDate(row.plan_expires_at)}</span>
        </span>
        <span>
          Триал до: <span className="text-[var(--night-text-70)]">{fmtDate(row.trial_until)}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={selPlan}
          onChange={(e) => setSelPlan(e.target.value as PlanId)}
          className="h-11 rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-3 text-sm outline-none focus:border-[var(--night-accent-45)]"
        >
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PLAN_LABELS[p]}
            </option>
          ))}
        </select>

        {selPlan === 'free' ? (
          <span className="text-sm text-[var(--night-text-40)]">выключить</span>
        ) : (
          <select
            value={selMonths}
            onChange={(e) => setSelMonths(Number(e.target.value))}
            className="h-11 rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-3 text-sm outline-none focus:border-[var(--night-accent-45)]"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} мес.
              </option>
            ))}
          </select>
        )}

        <Button onClick={apply} loading={busy} variant="secondary" className="px-4 py-2.5 text-sm">
          {applied ? 'Применено' : 'Применить'}
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
