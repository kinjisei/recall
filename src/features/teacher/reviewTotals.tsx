// ============================================================================
// Итог проверки работы по материалу в баллах (макет d18, Ф2.25-1б; заменил
// «1 из 2» d7-2). Компьютер — справа, держится при прокрутке: «Итог · 5
// упражнений», «6 из 8 баллов», «Авто: 6 из 8 баллов · вручную 0», баллы
// каждого упражнения, пояснение, если баллов больше, чем упражнений,
// главное действие и «Дальше откроется». Телефон (d18-2) — полоса внизу над
// навигацией: «7 из 8 · авто 6 · вручную +1» и «Завершить проверку».
// ============================================================================
import type { ReactNode } from 'react'
import { useShellInsets } from '../../shared/lib/shellInsets'
import { plural } from '../../shared/lib/plural'
import { points, type Points } from '../../lib/assignmentScore'

/** Сколько баллов — «вручную»: разница проверки и авто-проверки, со знаком. */
const manualLabel = (got: number, auto: number) => (got === auto ? '0' : got > auto ? `+${got - auto}` : `−${auto - got}`)

export interface ReviewRow {
  label: string
  score: Points
}

export function ReviewSummary({
  total,
  auto,
  rows,
  action,
  next,
}: {
  total: Points
  /** Баллы по авто-проверке. */
  auto: number
  /** Баллы каждого упражнения по порядку. */
  rows: ReviewRow[]
  action: ReactNode
  /** «Айгерим Нурланова · IELTS Task 2» — что откроется после «Завершить». */
  next?: string | null
}) {
  // «4 пары = 4 балла» — по первому упражнению с парами, когда баллов больше, чем упражнений
  const pairs = rows.find((r) => r.score.of > 1)?.score.of
  return (
    <section aria-label="Итог проверки" className="flex flex-col gap-3 rounded-card bg-surface p-4.5 shadow-card">
      <span className="text-note text-fg-muted">
        Итог · {rows.length} {plural(rows.length, 'упражнение', 'упражнения', 'упражнений')}
      </span>
      <span className="text-3xl leading-tight font-bold tabular-nums text-fg">
        {total.got} <small className="text-body font-medium text-fg-secondary">из {points(total.of)}</small>
      </span>
      <span className="-mt-1.5 text-note text-fg-muted">
        Авто: {auto} из {points(total.of)} · вручную {manualLabel(total.got, auto)}
      </span>
      <ol className="flex flex-col gap-1.5 border-y border-line py-2.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-fg-secondary">
            <span className="flex size-5 flex-none items-center justify-center rounded-mark bg-input text-caption font-semibold">{i + 1}</span>
            <span className="min-w-0 truncate">{r.label}</span>
            <b className="ml-auto font-semibold tabular-nums text-fg">
              {r.score.got}/{r.score.of}
            </b>
          </li>
        ))}
      </ol>
      {pairs && total.of > rows.length && (
        <p className="text-xs leading-snug text-fg-muted">
          Баллов больше, чем упражнений: в «Соедини пары» балл за каждую пару — {pairs} {plural(pairs, 'пара', 'пары', 'пар')} = {points(pairs)}
        </p>
      )}
      {action}
      {next && (
        <p className="flex flex-col gap-0.5 border-t border-line pt-2.5 text-sm text-fg-muted">
          <span>Дальше откроется</span>
          <b className="text-body font-medium text-fg">{next}</b>
        </p>
      )}
    </section>
  )
}

/** Полоса итога внизу экрана на телефоне (d18-2): счёт слева, действие справа. */
export function ReviewBar({ total, auto, action }: { total: Points; auto: number; action: ReactNode }) {
  const { bottom } = useShellInsets()
  return (
    <div
      style={{ bottom }}
      className="sticky z-10 -mx-4 flex items-center gap-3 border-t border-line bg-surface px-4 pt-3 pb-3 shadow-raised"
    >
      <span className="flex flex-col leading-tight">
        <b className="text-xl font-bold tabular-nums text-fg">
          {total.got} из {total.of}
        </b>
        <small className="text-xs text-fg-secondary">
          авто {auto} · вручную {manualLabel(total.got, auto)}
        </small>
      </span>
      <span className="flex-1 *:w-full">{action}</span>
    </div>
  )
}
