// ============================================================================
// Календарь месяца (макет t3 «выбор даты»; решение владельца 04.10.2026 —
// свой, как в макете, а не системное окно телефона). Раскрывается прямо под
// полем даты: сегодня обведён, выбранный день залит, дни раньше `soft` —
// бледнее (их выбрать можно: записать прошедший урок), раньше `min` и позже
// `max` — нельзя.
//
// Дни — строки 'YYYY-MM-DD' (shared/lib/days): календарь не знает про часы и
// пояса, «сегодня» ему передают снаружи (у расписания — по Алматы).
// Клавиатура: стрелки двигают выбор по дням и неделям, как в календарях ОС.
// ============================================================================
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { addDays, addMonths, MONTH_GENITIVE, monthGrid, monthStart, monthTitle, WEEKDAY_SHORT } from '../lib/days'
import { IconChevronLeft, IconChevronRight } from './icons'

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

export function DatePicker({
  value,
  onChange,
  today,
  soft,
  min,
  max,
  label = 'Дата',
}: {
  value: string
  onChange: (day: string) => void
  /** Сегодня — обводка. */
  today: string
  /** Дни раньше — бледные, но выбрать можно. */
  soft?: string
  min?: string
  max?: string
  /** Что выбираем — для скринридера. */
  label?: string
}) {
  const [month, setMonth] = useState(() => monthStart(value))
  const grid = useRef<HTMLDivElement>(null)
  // фокус идёт за выбором со стрелок — иначе он остался бы на прежнем дне
  const keyed = useRef(false)
  useEffect(() => {
    if (!keyed.current) return
    keyed.current = false
    grid.current?.querySelector<HTMLElement>(`[data-day="${value}"]`)?.focus()
  }, [value, month])
  const allowed = (d: string) => (!min || d >= min) && (!max || d <= max)

  const pick = (d: string) => {
    if (!allowed(d)) return
    onChange(d)
    if (monthStart(d) !== month) setMonth(monthStart(d))
  }
  const onKey = (e: KeyboardEvent) => {
    const step = STEP[e.key]
    if (!step) return
    e.preventDefault()
    keyed.current = true
    pick(addDays(value, step))
  }

  return (
    <div className="rounded-2xl border border-tint/[0.08] bg-surface p-3 shadow-card">
      <div className="flex items-center justify-between pb-1 pl-2">
        <span className="text-sm font-semibold text-fg" aria-live="polite">
          {monthTitle(month)}
        </span>
        <span className="flex">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            onClick={() => setMonth(addMonths(month, -1))}
            className="flex size-11 items-center justify-center rounded-xl text-fg-secondary hover:bg-tint/[0.06]"
          >
            <IconChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Следующий месяц"
            onClick={() => setMonth(addMonths(month, 1))}
            className="flex size-11 items-center justify-center rounded-xl text-fg-secondary hover:bg-tint/[0.06]"
          >
            <IconChevronRight size={20} />
          </button>
        </span>
      </div>
      <div ref={grid} role="group" aria-label={label} onKeyDown={onKey} className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAY_SHORT.map((w) => (
          <span key={w} aria-hidden className="py-1 text-caption text-fg-muted">
            {w}
          </span>
        ))}
        {monthGrid(month).flat().map((d, i) => {
          if (!d) return <span key={`gap-${i}`} aria-hidden />
          const on = d === value
          const off = !allowed(d)
          const faded = soft !== undefined && d < soft
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={`${Number(d.slice(8))} ${MONTH_GENITIVE[Number(d.slice(5, 7)) - 1]}`}
              aria-current={d === today ? 'date' : undefined}
              data-day={d}
              disabled={off}
              // в Tab — один день: выбранный, а в чужом месяце — первое число
              tabIndex={on || (monthStart(value) !== month && d === month) ? 0 : -1}
              onClick={() => pick(d)}
              className={`mx-auto flex size-11 items-center justify-center rounded-full text-sm font-medium transition-colors disabled:opacity-30 ${
                on
                  ? 'bg-accent text-accent-fg'
                  : d === today
                    ? 'text-accent-strong ring-2 ring-accent-line ring-inset'
                    : faded
                      ? 'text-fg-muted hover:bg-tint/[0.06]'
                      : 'text-fg hover:bg-tint/[0.06]'
              }`}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
