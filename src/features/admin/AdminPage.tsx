// ============================================================================
// Мини-админка владельца (роут /admin): оплаты — заявки «Оплата отправлена»,
// подтверждение и последние оплаты (payments/, PLAN.md Ф2.1); поиск человека
// по email или коду из перевода (UserSearch.tsx); воронка, расход AI,
// отзывы, ошибки с прода.
// Кому показывать экран, решает таблица маршрутов (app/routes.ts, role:
// 'admin' → app/RoleGate). Сам доступ на сервере проверяют RPC (admin_*).
// ============================================================================
import { useEffect, useState } from 'react'
import { DeviceTheme } from './DeviceTheme'
import { AiUsage } from './AiUsage'
import { supabase } from '../../shared/api/supabase'
import { UserSearch } from './UserSearch'
import { Payments } from './payments/Payments'
import { listRecentErrors, type ClientErrorRow, listFeedback, type FeedbackRow } from '../../lib/admin'
import { Reveal } from '../../shared/ui/Reveal'
import { RowsSkeleton } from '../../shared/ui/Loading'

export function AdminPage() {
  // подтвердили оплату из поиска — блок оплат перечитывает заявки и список
  const [paidVersion, setPaidVersion] = useState(0)
  const bump = () => setPaidVersion((v) => v + 1)
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Админка</h1>
      </header>
      <Payments version={paidVersion} onChanged={bump} />
      <UserSearch onPaid={bump} />
      <DeviceTheme />
      <Funnel />
      <AiUsage />
      <FeedbackList />
      <RecentErrors />
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
    <section className="rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Воронка</h2>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`min-h-11 rounded-lg px-3 text-sm ${
                days === d
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              {d} дн
            </button>
          ))}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-warning-strong">Аналитика недоступна: {err}</p>}
      {!err && !data && <RowsSkeleton count={2} height={44} />}

      {data && (
        <>
          <div className="mt-3 flex flex-col gap-1.5">
            {data.steps.map((s) => (
              <div key={s.ord} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-sm text-fg-secondary">{s.step}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-tint/[0.06]">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: top > 0 ? `${Math.round((s.people / top) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm tabular-nums">{s.people}</span>
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-medium">Источники</h3>
          {data.sources.length === 0 ? (
            <p className="mt-1 text-sm text-fg-muted">Пока нет данных.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-fg-muted">
                    <th className="py-1 pr-3 font-medium">Источник</th>
                    <th className="py-1 pr-3 font-medium">Визиты</th>
                    <th className="py-1 pr-3 font-medium">Регистрации</th>
                    <th className="py-1 font-medium">Оплаты</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((s) => (
                    <tr key={s.source} className="border-t border-tint/[0.06]">
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
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'bg-tint/[0.06] text-fg-muted'
              }`}
            >
              {d} дн.
            </button>
          ))}
        </div>
      </div>

      {err ? (
        <p className="mt-3 text-sm text-fg-muted">{err}</p>
      ) : rows === null ? (
        <RowsSkeleton count={3} height={56} />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
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
                className="rounded-xl border border-tint/[0.08] p-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-sm font-medium">{r.message ?? '(без текста)'}</span>
                  <span className="shrink-0 text-xs text-fg-muted">
                    {r.times}× · {r.people} чел.
                  </span>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  {r.where_} · {new Date(r.last_at).toLocaleString('ru-RU')}
                  {!r.any_online && ' · офлайн'}
                </p>
                <Reveal open={open === key}>
                  <div className="mt-2 border-t border-tint/[0.08] pt-2">
                    <p className="text-xs text-fg-muted">
                      Экран: {r.last_path ?? '—'}
                    </p>
                    {r.last_stack && (
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-fg-muted">
                        {r.last_stack}
                      </pre>
                    )}
                  </div>
                </Reveal>
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
        <p className="mt-3 text-sm text-fg-muted">{err}</p>
      ) : rows === null ? (
        <RowsSkeleton count={3} height={56} />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
          Пока никто не написал. Кнопка есть в меню под аватаром и в настройках.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-tint/[0.08] p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm">
                  {r.rating === 'up' ? '👍 ' : r.rating === 'down' ? '👎 ' : ''}
                  {r.text || '(без текста)'}
                </span>
                <span className="shrink-0 text-xs text-fg-muted">
                  {new Date(r.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <p className="mt-1 text-xs text-fg-muted">
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
