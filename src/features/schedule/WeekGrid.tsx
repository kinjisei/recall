// ============================================================================
// Неделя колонками по часам (макеты d1 и t2-2 «колонки»). На компьютере — вид
// по умолчанию (журнал п.46): у дня шапка «пн, 12 · 2 урока», уроки с именем и
// временем. На телефоне — мини-сетка: у урока только час начала, под сеткой —
// что значит какой вид. Шапка дня открывает этот день; урок — его шторку.
// ============================================================================
import { addDays, formatTime } from '../../shared/lib/days'
import {
  almatyMinutes,
  hourWindow,
  lessonsCount,
  placeLessons,
  WEEKDAY_NAMES,
  type Lesson,
} from '../../domains/schedule'
import { LessonBlock } from './LessonBlock'

const LEGEND = [
  { label: 'Ученик', look: 'border border-tint/[0.16] bg-surface' },
  { label: 'Группа', look: 'border border-accent-line bg-accent-soft' },
  { label: 'Пробный', look: 'border border-dashed border-accent-line' },
  { label: 'Отменён', look: 'border border-dashed border-tint/[0.18]' },
  { label: 'Поздняя отмена', look: 'border border-warning/40 bg-hatch-warning' },
]

export function WeekGrid({
  monday,
  today,
  days: byDay,
  now,
  compact,
  inApp,
  onOpen,
  onDay,
}: {
  monday: string
  today: string
  /** Уроки по дням (по Алматы). */
  days: Map<string, Lesson[]>
  now: Date
  /** Телефон: мини-сетка. */
  compact: boolean
  inApp: (cardId: string) => boolean
  onOpen: (id: string) => void
  onDay: (day: string) => void
}) {
  const week = WEEKDAY_NAMES.map((name, i) => ({ name, day: addDays(monday, i) }))
  const placed = week.map(({ day }) => placeLessons(byDay.get(day) ?? [], day))
  const { from, to } = hourWindow(placed.flat())
  // компьютер: 45-минутный урок — 45 px, короче — тянется до 44 px (цель для мыши
  // и тачпада, ux-audit); телефон: мини-сетка, нажимается день целиком
  const hourPx = compact ? 36 : 60
  const y = (minutes: number) => ((minutes - from * 60) * hourPx) / 60
  const height = y(to * 60)
  const hours = Array.from({ length: to - from }, (_, i) => from + i)
  const nowMin = almatyMinutes(now)
  const columns = { gridTemplateColumns: `${compact ? '1.75rem' : '3rem'} repeat(7, minmax(0, 1fr))` }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-tint/[0.08] bg-surface shadow-card">
        <div className="grid border-b border-tint/[0.08]" style={columns}>
          <span />
          {week.map(({ name, day }, i) => {
            const n = (byDay.get(day) ?? []).filter((l) => l.status !== 'cancelled').length
            const isToday = day === today
            return (
              <button
                key={day}
                type="button"
                onClick={() => onDay(day)}
                aria-label={`${name}, ${Number(day.slice(8))}: ${n ? lessonsCount(n) : 'нет уроков'}. Открыть день`}
                className={`flex min-h-11 flex-col items-center justify-center px-1 py-1.5 hover:bg-tint/[0.04] ${
                  isToday ? 'bg-accent-soft text-accent-soft-fg' : ''
                } ${i > 0 ? 'border-l border-tint/[0.06]' : ''}`}
              >
                <span className={`text-caption ${isToday ? 'font-semibold' : 'text-fg-muted'}`}>
                  {compact ? name : `${name}, ${Number(day.slice(8))}`}
                </span>
                {compact && <span className="text-sm font-bold tabular-nums">{Number(day.slice(8))}</span>}
                <span className={`text-caption ${isToday ? '' : 'text-fg-muted'}`}>
                  {compact ? n || '–' : n ? lessonsCount(n) : 'нет уроков'}
                </span>
              </button>
            )
          })}
        </div>

        {/* отступ сверху — подписи часов стоят по центру линии, первая не срезается */}
        <div className="relative grid pt-2" style={{ ...columns, height: height + 8 }}>
          <div aria-hidden className="relative">
            {hours.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-caption tabular-nums text-fg-muted" style={{ top: y(h * 60) }}>
                {compact ? String(h % 24).padStart(2, '0') : formatTime(h)}
              </span>
            ))}
          </div>
          {week.map(({ day }, i) => (
            <ol
              key={day}
              aria-label={`Уроки, ${WEEKDAY_NAMES[i]}`}
              // телефон: уроки в колонке шириной 42 px пальцем не попасть —
              // колонка целиком открывает день (подпись под сеткой, макет t2-2)
              onClick={compact ? () => onDay(day) : undefined}
              className={`relative border-l border-tint/[0.06] ${day === today ? 'bg-tint/[0.03]' : ''} ${compact ? 'cursor-pointer' : ''}`}
            >
              {hours.map((h) => (
                <li key={h} aria-hidden className="absolute inset-x-0 h-px bg-tint/[0.05]" style={{ top: y(h * 60) }} />
              ))}
              {(placed[i] ?? []).map(({ item, top, height: len, lane, lanes }) => {
                const h = Math.max(compact ? 18 : 44, y(top + len) - y(top) - 2)
                return (
                  <li
                    key={item.id}
                    className="absolute px-0.5"
                    style={{ top: y(top) + 1, height: h, left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}
                  >
                    <LessonBlock lesson={item} now={now} size={compact ? 'mini' : 'week'} tall={h >= 40} inApp={inApp} onOpen={onOpen} />
                  </li>
                )
              })}
              {day === today && nowMin >= from * 60 && nowMin <= to * 60 && (
                <li aria-hidden className="pointer-events-none absolute inset-x-0 h-0.5 bg-accent" style={{ top: y(nowMin) }} />
              )}
            </ol>
          ))}
        </div>
      </div>

      {compact && (
        <>
          <ul aria-label="Обозначения" className="flex flex-wrap gap-x-3 gap-y-1.5 text-caption text-fg-secondary">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-3 w-4 rounded ${l.look}`} />
                {l.label}
              </li>
            ))}
          </ul>
          <p className="text-note text-fg-muted">Нажми на день — откроется этот день.</p>
        </>
      )}
    </div>
  )
}
