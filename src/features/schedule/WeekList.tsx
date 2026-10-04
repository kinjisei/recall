// ============================================================================
// Неделя списком по дням (макет t2-2 «список» — на телефоне по умолчанию):
// «вт, 13 окт · 5 уроков ›» открывает день; строки — время, аватар, имя,
// метка; пустой день — «Свободный день». Строка — общий RowCard (flat).
// ============================================================================
import { addDays } from '../../shared/lib/days'
import {
  almatyTime,
  dayShort,
  lessonBadge,
  lessonName,
  lessonsCount,
  relativeLabel,
  type Lesson,
} from '../../domains/schedule'
import { IconChevronRight } from '../../shared/ui/icons'
import { RowCard } from '../../shared/ui/RowCard'
import { Badge, LessonAvatar } from './LessonParts'

export function WeekList({
  monday,
  today,
  days,
  now,
  nextId,
  inApp,
  onOpen,
  onDay,
}: {
  monday: string
  today: string
  days: Map<string, Lesson[]>
  now: Date
  nextId: string | null
  inApp: (cardId: string) => boolean
  onOpen: (id: string) => void
  onDay: (day: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((day) => {
        const list = days.get(day) ?? []
        const isToday = day === today
        return (
          <section key={day} aria-label={dayShort(day)} className="flex flex-col gap-1.5">
            <button type="button" onClick={() => onDay(day)} className="flex min-h-11 items-center justify-between gap-2 px-1">
              <span className={`text-sm font-semibold ${isToday ? 'text-accent-strong' : 'text-fg-secondary'}`}>
                {dayShort(day)}
                {isToday && ' · сегодня'}
              </span>
              <span className="flex items-center gap-1 text-note text-fg-muted">
                {list.length ? lessonsCount(list.length) : 'нет уроков'}
                <IconChevronRight size={14} aria-hidden />
              </span>
            </button>
            {list.length ? (
              <div
                className={`divide-y divide-tint/[0.06] overflow-hidden rounded-2xl border bg-surface shadow-card ${
                  isToday ? 'border-accent-line' : 'border-tint/[0.08]'
                }`}
              >
                {list.map((l) => {
                  const badge = lessonBadge(l, now) ?? (l.id === nextId ? { text: relativeLabel(l, now), tone: 'accent' as const } : null)
                  return (
                    <RowCard
                      key={l.id}
                      flat
                      muted={l.status === 'cancelled'}
                      onClick={() => onOpen(l.id)}
                      lead={
                        <span className="flex flex-none items-center gap-3">
                          <span className="flex w-11 flex-col tabular-nums">
                            <span className="text-sm font-semibold">{almatyTime(l.startsAt)}</span>
                            <span className="text-caption text-fg-muted">–{almatyTime(l.endsAt)}</span>
                          </span>
                          <LessonAvatar lesson={l} inApp={inApp} small />
                        </span>
                      }
                      title={lessonName(l)}
                      trailing={badge ? <Badge badge={badge} /> : <span aria-hidden />}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-tint/[0.10] px-4 py-3 text-sm text-fg-muted">Свободный день</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
