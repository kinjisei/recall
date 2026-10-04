// ============================================================================
// Лента дня (макеты t2-1, t2-3): часы слева, уроки на своём времени,
// пересекающиеся — рядом в дорожках, линия «сейчас» с временем — только у
// сегодняшнего дня. Часы — обычно 8–22, шире, если уроки раньше или позже
// (domains/schedule: placeLessons, hourWindow).
// ============================================================================
import { almatyMinutes, almatyTime, hourWindow, placeLessons, type Lesson } from '../../domains/schedule'
import { formatTime } from '../../shared/lib/days'
import { LessonBlock } from './LessonBlock'

/** Высота часа на ленте, px: урок в 45 минут ещё вмещает две строки. */
const HOUR_PX = 64

export function DayTimeline({
  day,
  today,
  lessons,
  now,
  nextId,
  inApp,
  onOpen,
}: {
  day: string
  today: string
  lessons: Lesson[]
  now: Date
  nextId: string | null
  inApp: (cardId: string) => boolean
  onOpen: (id: string) => void
}) {
  const placed = placeLessons(lessons, day)
  const { from, to } = hourWindow(placed)
  const y = (minutes: number) => ((minutes - from * 60) * HOUR_PX) / 60
  const nowMin = day === today ? almatyMinutes(now) : null
  const showNow = nowMin !== null && nowMin >= from * 60 && nowMin <= to * 60
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)

  return (
    <div className="relative" style={{ height: y(to * 60) + 12 }}>
      {hours.map((h) => (
        <div key={h} aria-hidden className="absolute inset-x-0 flex items-center gap-2" style={{ top: y(h * 60) }}>
          <span className="w-11 -translate-y-px text-right text-caption tabular-nums text-fg-muted">{formatTime(h)}</span>
          <span className="h-px flex-1 bg-tint/[0.07]" />
        </div>
      ))}

      <ol aria-label="Уроки дня" className="absolute inset-y-0 left-14 right-0">
        {placed.map(({ item, top, height, lane, lanes }) => {
          const h = Math.max(44, y(top + height) - y(top) - 2)
          return (
            <li
              key={item.id}
              className="absolute pr-1"
              style={{ top: y(top) + 1, height: h, left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}
            >
              <LessonBlock lesson={item} now={now} size="day" tall={h >= 52} roomy={h >= 80} next={item.id === nextId} inApp={inApp} onOpen={onOpen} />
            </li>
          )
        })}
      </ol>

      {showNow && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: y(nowMin) - 10 }}>
          <span className="w-12 rounded-full bg-accent py-0.5 text-center text-caption font-bold tabular-nums text-accent-fg">
            {almatyTime(now)}
          </span>
          <span className="h-0.5 flex-1 bg-accent" />
        </div>
      )}
    </div>
  )
}
