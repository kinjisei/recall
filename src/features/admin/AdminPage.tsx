// ============================================================================
// Мини-админка владельца (роут /admin). Поиск ученика/учителя по email после
// Kaspi-перевода → включение или продление платного плана вручную.
// Охрана — get_my_plan().is_admin; сам доступ на сервере проверяют RPC
// (admin_find_user/admin_set_plan), эта проверка только чтобы не показывать
// экран не-владельцу.
// ============================================================================
import { useEffect, useState } from 'react'

import { supabase } from '../../lib/supabase'
import {
  findUsers,
  listRecentErrors,
  setPlan,
  type AdminUserRow,
  type ClientErrorRow,
  type PlanId,
  listFeedback,
  type FeedbackRow,
} from '../../lib/admin'
import { Button } from '../../components/Button'
import { IconSearch, IconWarning, IconSpinner, IconHome } from '../../components/icons'
import { AppLink } from '../../components/AppLink'
import { RowsSkeleton } from '../../components/Loading'

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
        <AppLink to="/">
          <Button variant="secondary" className="mt-2">
            <IconHome size={18} /> На главную
          </Button>
        </AppLink>
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

      <Funnel />
      <FeedbackList />
      <RecentErrors />

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
        {typeof row.students === 'number' && row.students > 0 && (
          <span>
            Учеников: <span className="text-[var(--night-text-70)]">{row.students}</span>
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
          <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            У этого аккаунта уже {row.students} учеников. После включения тарифа все они
            получат повышенные лимиты AI — проверь, что это ожидаемо.
          </p>
        )}

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

/* ===== Воронка =============================================================
 * Аналитика, в которую надо лезть запросом, не читается никем — поэтому
 * сводка живёт прямо здесь. Считаются ЛЮДИ (distinct), а не события: иначе
 * один активный пользователь выглядит как двадцать.
 * Источник берётся ПЕРВЫЙ по времени (first touch): человек мог прийти из
 * телеграма, а зарегистрироваться через неделю по прямой ссылке.
 * ========================================================================== */

interface FunnelStep {
  ord: number
  step: string
  people: number
}
interface FunnelSource {
  source: string
  visits: number
  signups: number
  payments: number
}

function Funnel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<{ steps: FunnelStep[]; sources: FunnelSource[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase
      .rpc('admin_funnel', { p_days: days })
      .then(({ data, error }) => {
        if (!alive) return
        // блок аналитики никогда не должен ронять админку: показываем текст,
        // а не пустой экран (частый случай — миграция ещё не залита)
        if (error) setErr(error.message)
        else setData(data as unknown as { steps: FunnelStep[]; sources: FunnelSource[] })
      })
    return () => {
      alive = false
    }
  }, [days])

  const top = data?.steps?.[0]?.people ?? 0

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Воронка</h2>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`min-h-11 rounded-lg px-3 text-sm ${
                days === d
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'text-[var(--night-text-40)] hover:text-[var(--night-text)]'
              }`}
            >
              {d} дн
            </button>
          ))}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-amber-300">Аналитика недоступна: {err}</p>}
      {!err && !data && <p className="mt-3 text-sm text-[var(--night-text-40)]">Считаю…</p>}

      {data && (
        <>
          <div className="mt-3 flex flex-col gap-1.5">
            {data.steps.map((s) => (
              <div key={s.ord} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-sm text-[var(--night-text-70)]">{s.step}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[var(--night-accent)]"
                    style={{ width: top > 0 ? `${Math.round((s.people / top) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm tabular-nums">{s.people}</span>
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-medium">Источники</h3>
          {data.sources.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--night-text-40)]">Пока нет данных.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--night-text-40)]">
                    <th className="py-1 pr-3 font-medium">Источник</th>
                    <th className="py-1 pr-3 font-medium">Визиты</th>
                    <th className="py-1 pr-3 font-medium">Регистрации</th>
                    <th className="py-1 font-medium">Оплаты</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((s) => (
                    <tr key={s.source} className="border-t border-white/[0.06]">
                      <td className="py-1.5 pr-3">{s.source}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{s.visits}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{s.signups}</td>
                      <td className="py-1.5 tabular-nums">{s.payments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Ошибки с прода.
//
// Раньше о поломке у пользователя мы узнавали, только если он напишет — а он
// обычно не пишет, а уходит. Теперь клиент записывает ошибки событием
// client_error (src/lib/errorLog.ts), а здесь они видны там же, где воронка:
// в отдельную панель стороннего сервиса владелец бы просто не заходил.
// ---------------------------------------------------------------------------

function RecentErrors() {
  const [days, setDays] = useState(7)
  const [rows, setRows] = useState<ClientErrorRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listRecentErrors(days, 50)
      .then((r) => alive && setRows(r))
      // как и у воронки: миграция может быть не залита — показываем текст,
      // а не пустой экран
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'не удалось'))
    return () => {
      alive = false
    }
  }, [days])

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Ошибки у пользователей</h2>
        <div className="flex gap-1">
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`min-h-11 rounded-lg px-3 text-sm font-medium ${
                days === d
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'bg-white/[0.06] text-[var(--night-text-40)]'
              }`}
            >
              {d} дн.
            </button>
          ))}
        </div>
      </div>

      {err ? (
        <p className="mt-3 text-sm text-[var(--night-text-40)]">{err}</p>
      ) : rows === null ? (
        <RowsSkeleton count={3} height={56} />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--night-text-40)]">
          За этот период ошибок не было.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {rows.map((r) => {
            const key = `${r.where_}|${r.message}`
            return (
              <button
                key={key}
                onClick={() => setOpen(open === key ? null : key)}
                className="rounded-xl border border-white/[0.08] p-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-sm font-medium">{r.message ?? '(без текста)'}</span>
                  <span className="shrink-0 text-xs text-[var(--night-text-40)]">
                    {r.times}× · {r.people} чел.
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--night-text-40)]">
                  {r.where_} · {new Date(r.last_at).toLocaleString('ru-RU')}
                  {!r.any_online && ' · офлайн'}
                </p>
                {open === key && (
                  <div className="mt-2 border-t border-white/[0.08] pt-2">
                    <p className="text-xs text-[var(--night-text-40)]">
                      Экран: {r.last_path ?? '—'}
                    </p>
                    {r.last_stack && (
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-[var(--night-text-40)]">
                        {r.last_stack}
                      </pre>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Отзывы пользователей.
//
// Отзыв — это событие в events (см. lib/feedback.ts), отдельной таблицы нет.
// Поэтому сбор работает сразу после деплоя, а вот чтение требует RPC
// admin_feedback: если схему ещё не залили, блок честно об этом скажет,
// а не покажет «отзывов нет» — разница принципиальная.
// ---------------------------------------------------------------------------

function FeedbackList() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listFeedback(90, 100)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'не удалось'))
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">Отзывы за 90 дней</h2>
      {err ? (
        <p className="mt-3 text-sm text-[var(--night-text-40)]">{err}</p>
      ) : rows === null ? (
        <RowsSkeleton count={3} height={56} />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--night-text-40)]">
          Пока никто не написал. Кнопка есть в меню под аватаром и в настройках.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-white/[0.08] p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm">
                  {r.rating === 'up' ? '👍 ' : r.rating === 'down' ? '👎 ' : ''}
                  {r.text || '(без текста)'}
                </span>
                <span className="shrink-0 text-xs text-[var(--night-text-40)]">
                  {new Date(r.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--night-text-40)]">
                {r.display_name ?? 'без имени'}
                {r.role === 'teacher' ? ' · преподаватель' : ''}
                {r.where_ ? ` · ${r.where_}` : ''}
                {r.contact ? ` · ${r.contact}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
