// Ответы онбординга под воронкой /admin (PLAN.md Ф2.11б-4, журнал п.73):
// «Сколько у тебя учеников?» репетиторов и «Откуда ты о нас знаешь?» —
// последний ответ каждого человека за те же дни, что и воронка. Раньше ответы
// «Как узнал» лежали в events и не показывались нигде: «Источники» берут
// первый заход человека (метку ссылки), а не его ответ.
import { bandLabel } from '../../domains/billing'
import { listOnboardingAnswers, type OnboardingAnswerRow } from '../../lib/admin'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { RowsSkeleton } from '../../shared/ui/Loading'

export function OnboardingAnswers({ days }: { days: number }) {
  const { data, error } = useAsyncData(() => listOnboardingAnswers(days), [days], 'Не удалось загрузить ответы онбординга')

  if (error) return <p className="mt-5 text-sm text-warning-strong">Ответы онбординга недоступны: {error}</p>
  if (!data) return <RowsSkeleton count={2} height={44} />

  const students = data.filter((r) => r.question === 'students')
  const heard = data.filter((r) => r.question === 'heard')
  return (
    <>
      <h3 className="mt-5 text-sm font-medium">Сколько учеников у репетиторов</h3>
      {students.length === 0 ? (
        <p className="mt-1 text-sm text-fg-muted">Пока нет ответов.</p>
      ) : (
        <Bars rows={students.map((r) => ({ label: bandLabel(r.value), people: r.teachers + r.others }))} />
      )}

      <h3 className="mt-5 text-sm font-medium">Откуда узнали — ответ человека</h3>
      {heard.length === 0 ? (
        <p className="mt-1 text-sm text-fg-muted">Пока нет ответов.</p>
      ) : (
        <AnswerTable rows={heard} />
      )}
    </>
  )
}

function Bars({ rows }: { rows: { label: string; people: number }[] }) {
  const top = Math.max(...rows.map((r) => r.people), 1)
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-44 shrink-0 text-sm text-fg-secondary">{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-tint/[0.06]">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((r.people / top) * 100)}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-sm tabular-nums">{r.people}</span>
        </div>
      ))}
    </div>
  )
}

function AnswerTable({ rows }: { rows: OnboardingAnswerRow[] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-fg-muted">
            <th className="py-1 pr-3 font-medium">Ответ</th>
            <th className="py-1 pr-3 font-medium">Репетиторы</th>
            <th className="py-1 font-medium">Остальные</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.value} className="border-t border-tint/[0.06]">
              <td className="py-1.5 pr-3">{r.value}</td>
              <td className="py-1.5 pr-3 tabular-nums">{r.teachers}</td>
              <td className="py-1.5 tabular-nums">{r.others}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
