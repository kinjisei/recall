// ============================================================================
// Неделя полоской над лентой дня (макет t2-1): «пн 12 · вт 13 …», точка — в
// этот день есть уроки, выбранный день — подложкой, сегодня — акцентом.
// ============================================================================
import { addDays } from '../../shared/lib/days'
import { WEEKDAY_NAMES } from '../../domains/schedule'

export function DayStrip({
  monday,
  day,
  today,
  busy,
  onPick,
}: {
  monday: string
  day: string
  today: string
  /** Дни, где есть уроки (не отменённые). */
  busy: Set<string>
  onPick: (day: string) => void
}) {
  return (
    <div role="group" aria-label="Дни недели" className="grid grid-cols-7 gap-1">
      {WEEKDAY_NAMES.map((name, i) => {
        const d = addDays(monday, i)
        const on = d === day
        const isToday = d === today
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={`${name}, ${Number(d.slice(8))}${isToday ? ', сегодня' : ''}${busy.has(d) ? ', есть уроки' : ''}`}
            onClick={() => onPick(d)}
            className={`flex min-h-14 flex-col items-center justify-center rounded-xl transition-colors ${
              on ? 'bg-accent-soft text-accent-soft-fg ring-2 ring-control-line-active' : 'hover:bg-tint/[0.05]'
            }`}
          >
            <span className={`text-caption ${on ? '' : isToday ? 'text-accent-strong' : 'text-fg-muted'}`}>{name}</span>
            <span className={`text-base font-bold tabular-nums ${!on && isToday ? 'text-accent-strong' : ''}`}>{Number(d.slice(8))}</span>
            <span aria-hidden className={`mt-0.5 size-1 rounded-full ${busy.has(d) ? (on ? 'bg-accent-soft-fg' : 'bg-accent') : 'bg-transparent'}`} />
          </button>
        )
      })}
    </div>
  )
}
