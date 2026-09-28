// ============================================================================
// Блок «Расход AI» в /admin (PLAN.md Ф1.6). Три вопроса владельца:
//   • какая модель сегодня сколько отвечала и как близко к дневному лимиту —
//     квоты кончатся первыми (журнал п.12);
//   • какие задачи остались без ответа и сколько человек ждал;
//   • как это шло по дням.
// Сутки — по времени Google (полночь в Калифорнии): по ним обнуляются квоты.
// Числа считает база (журнал ai_call_log), лимиты — domains/ai/limits.ts.
// ============================================================================
import { useState } from 'react'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { plural } from '../../shared/lib/plural'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { TabPicker } from '../../shared/ui/TabPicker'
import {
  dayTotals,
  googleDay,
  loadAiUsage,
  MODEL_LIMITS,
  modelsOnDay,
  quotaReset,
  secondsLabel,
  TASK_LABELS,
  untilLabel,
  type ModelDay,
  type ModelToday,
  type TaskDay,
} from '../../domains/ai'

const RANGES = [
  { id: '1', label: 'Сегодня' },
  { id: '7', label: '7 дн' },
  { id: '30', label: '30 дн' },
] as const
type Range = (typeof RANGES)[number]['id']

const num = (n: number) => n.toLocaleString('ru-RU')

export function AiUsage() {
  const [range, setRange] = useState<Range>('1')
  const { data, error } = useAsyncData(() => loadAiUsage(Number(range)), [range])
  const now = new Date()
  const today = googleDay(now)
  const reset = quotaReset(now)

  return (
    <section className="rounded-2xl border border-tint/[0.08] bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Расход AI</h2>
        <TabPicker options={[...RANGES]} value={range} onChange={setRange} ariaLabel="Период" />
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        Сутки — по времени Google: дневные лимиты обнулятся в{' '}
        {reset.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (
        {untilLabel(reset.getTime() - now.getTime())}). Лимиты — на весь проект, не на человека.
      </p>

      {error && <p className="mt-3 text-sm text-warning-strong">Расход недоступен: {error}</p>}
      {!error && !data && <RowsSkeleton count={3} height={44} />}
      {data && (
        <>
          <ModelsToday rows={modelsOnDay(data.models, today, MODEL_LIMITS)} />
          <TasksToday rows={data.tasks.filter((t) => t.day === today)} />
          {range !== '1' && <Days rows={data.models} />}
        </>
      )}
    </section>
  )
}

function ModelsToday({ rows }: { rows: ModelToday[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-fg-muted">Сегодня к AI ещё не обращались.</p>
  }
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {rows.map((r) => {
        const pct = r.share === null ? 0 : Math.min(100, Math.round(r.share * 100))
        const bar = r.share === null ? '' : r.share >= 0.9 ? 'bg-danger' : r.share >= 0.6 ? 'bg-warning' : 'bg-accent'
        return (
          <div key={r.model}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="min-w-0 break-all">{r.model}</span>
              <span className="shrink-0 tabular-nums text-fg-secondary">
                {r.limit?.rpd ? `${num(r.used)} из ${num(r.limit.rpd)}` : `${num(r.used)} · лимит не сверен`}
              </span>
            </div>
            {r.share !== null && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tint/[0.06]">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="mt-1 text-xs text-fg-muted">
              ответила {num(r.ok)}
              {r.refused > 0 && ` · отказ по квоте ${num(r.refused)}`}
              {r.failed > 0 && ` · сбоев ${num(r.failed)}`}
              {r.avg_ms !== null && ` · в среднем ${secondsLabel(r.avg_ms)}`}
              {r.avg_first_ms !== null && ` · первые слова ${secondsLabel(r.avg_first_ms)}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function TasksToday({ rows }: { rows: TaskDay[] }) {
  if (rows.length === 0) return null
  return (
    <>
      <h3 className="mt-5 text-sm font-medium">Вызовы сегодня</h3>
      <div className="mt-2 flex flex-col gap-2">
        {rows.map((t) => (
          <div key={t.task}>
            <p className="text-sm">{TASK_LABELS[t.task] ?? t.task}</p>
            <p className="text-xs text-fg-muted">
              {num(t.calls)} {plural(t.calls, 'вызов', 'вызова', 'вызовов')}
              {t.failed > 0 && ` · без ответа ${num(t.failed)}`}
              {t.cut > 0 && ` · оборвалось ${num(t.cut)}`}
              {t.avg_ms !== null && ` · ${secondsLabel(t.avg_ms)}, у 95% — до ${secondsLabel(t.p95_ms)}`}
            </p>
          </div>
        ))}
      </div>
    </>
  )
}

function Days({ rows }: { rows: ModelDay[] }) {
  const days = dayTotals(rows)
  if (days.length === 0) return null
  return (
    <>
      <h3 className="mt-5 text-sm font-medium">По дням</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-fg-muted">
              <th className="py-1 pr-3 font-medium">Сутки</th>
              <th className="py-1 pr-3 font-medium">Попыток</th>
              <th className="py-1 pr-3 font-medium">Ответили</th>
              <th className="py-1 pr-3 font-medium">Квота</th>
              <th className="py-1 font-medium">Сбои</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-t border-tint/[0.06] tabular-nums">
                <td className="py-1.5 pr-3">{d.day.slice(8, 10)}.{d.day.slice(5, 7)}</td>
                <td className="py-1.5 pr-3">{num(d.requests)}</td>
                <td className="py-1.5 pr-3">{num(d.ok)}</td>
                <td className="py-1.5 pr-3">{num(d.refused)}</td>
                <td className="py-1.5">{num(d.failed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
