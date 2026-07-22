// ============================================================================
// Общий рендер программы обучения: недели с пунктами. Используется и у
// преподавателя (предпросмотр/активная программа в ProgramSection), и у
// ученицы (/program) — чтобы обе стороны видели план ОДИНАКОВО.
// ============================================================================
import {
  IconCards,
  IconDialog,
  IconGap,
  IconGraduation,
  IconMic,
  IconSparkle,
  type IconProps,
} from '../../components/icons'
import type { PlanItemType, PlanWeek } from '../../types'

const ITEM_ICON: Record<PlanItemType, (p: IconProps) => React.JSX.Element> = {
  grammar: IconGraduation,
  words: IconCards,
  reading: IconGap,
  speech: IconMic,
  dialog: IconDialog,
  custom: IconSparkle,
}

const ITEM_LABEL: Record<PlanItemType, string> = {
  grammar: 'Грамматика',
  words: 'Слова',
  reading: 'Чтение',
  speech: 'Речь',
  dialog: 'Диалог',
  custom: 'Задание',
}

/**
 * Недели плана. currentWeek (1-based) подсвечивает текущую; without — все
 * недели равнозначны (предпросмотр у преподавателя до сохранения).
 */
export function PlanView({ weeks, currentWeek }: { weeks: PlanWeek[]; currentWeek?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {weeks.map((w, i) => {
        const n = i + 1
        const isCurrent = currentWeek === n
        const isPast = currentWeek !== undefined && n < currentWeek
        return (
          <div
            key={n}
            className={`rounded-xl border p-3 ${
              isCurrent
                ? 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.08)]'
                : 'border-white/[0.08]'
            } ${isPast ? 'opacity-60' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">{w.title || `Неделя ${n}`}</p>
              {isCurrent && (
                <span className="flex-none rounded-full bg-[var(--night-accent)] px-2 py-0.5 text-[11px] font-medium text-white">
                  текущая
                </span>
              )}
              {isPast && (
                <span className="flex-none text-[11px] text-[var(--night-text-40)]">прошла</span>
              )}
            </div>
            {w.focus && <p className="mt-0.5 text-xs text-[var(--night-text-40)]">{w.focus}</p>}
            <ul className="mt-2 flex flex-col gap-2">
              {w.items.map((it, j) => {
                const Icon = ITEM_ICON[it.type] ?? IconSparkle
                return (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-white/[0.06] text-[var(--night-accent-text)]">
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--night-text)]">
                        <span className="text-xs text-[var(--night-text-40)]">
                          {ITEM_LABEL[it.type] ?? 'Задание'} ·{' '}
                        </span>
                        {it.title}
                      </p>
                      {it.note && (
                        <p className="text-xs leading-relaxed text-[var(--night-text-60)]">
                          {it.note}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
