// ============================================================================
// День списком (макет t1-1; вид по умолчанию на телефоне — правка владельца
// 05.10.2026, PLAN.md Ф2.10): у каждого урока своя карточка — время начала и
// конца, имя и вид урока («Индивидуальный», «Пробный урок», «Группа · 3
// ученика»), справа метка состояния или «›». Ближайший — в рамке акцентом;
// если до него час или меньше и есть ссылка — «Войти в урок» прямо в карточке.
// Неделя списком — другие строки (t2-2, WeekList: инициалы, без вида урока).
// ============================================================================
import {
  almatyTime,
  isTrialLesson,
  lessonBadge,
  lessonName,
  relativeLabel,
  type Lesson,
} from '../../domains/schedule'
import { plural } from '../../shared/lib/plural'
import { Button } from '../../shared/ui/Button'
import { IconChevronRight, IconVideo } from '../../shared/ui/icons'
import { Badge } from './LessonParts'

/** Ссылку на урок показываем в карточке, когда до начала час или меньше. */
const JOIN_BEFORE_MIN = 60

function kindLine(l: Lesson): string {
  if (l.kind === 'group') {
    const n = l.participants.length
    return `Группа · ${n} ${plural(n, 'ученик', 'ученика', 'учеников')}`
  }
  return isTrialLesson(l) ? 'Пробный урок' : 'Индивидуальный'
}

export function DayCards({
  list,
  now,
  nextId,
  onOpen,
}: {
  list: Lesson[]
  now: Date
  nextId: string | null
  onOpen: (id: string) => void
}) {
  if (!list.length) {
    return <p data-day-cards className="rounded-row border border-dashed border-tint/[0.10] px-4 py-3 text-sm text-fg-muted">Свободный день</p>
  }
  return (
    <ul data-day-cards aria-label="Уроки дня списком" className="flex flex-col gap-2.5">
      {list.map((l) => {
        const next = l.id === nextId
        const badge = lessonBadge(l, now) ?? (next ? { text: relativeLabel(l, now), tone: 'accent' as const } : null)
        const cancelled = l.status === 'cancelled'
        const join = next && !cancelled && l.link && Date.parse(l.startsAt) - now.getTime() <= JOIN_BEFORE_MIN * 60_000 ? l.link : null
        return (
          <li key={l.id} data-day-lesson className={`overflow-hidden rounded-row bg-surface shadow-card ${next ? 'inset-ring-2 inset-ring-accent' : ''}`}>
            <button
              type="button"
              onClick={() => onOpen(l.id)}
              className={`flex min-h-17 w-full items-center gap-4 px-4 py-3 text-left active:bg-row-press ${cancelled ? 'text-fg-muted' : 'text-fg'}`}
            >
              <span className="flex w-12 flex-none flex-col tabular-nums">
                <span className={`text-base font-semibold ${cancelled ? 'line-through' : ''}`}>{almatyTime(l.startsAt)}</span>
                <span className="text-note text-fg-muted">{almatyTime(l.endsAt)}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`truncate text-base font-semibold ${cancelled ? 'line-through' : ''}`}>{lessonName(l)}</span>
                <span className="truncate text-note text-fg-muted">{kindLine(l)}</span>
              </span>
              {badge ? <Badge badge={badge} /> : <IconChevronRight size={18} aria-hidden className="flex-none text-fg-muted" />}
            </button>
            {join && (
              <div className="px-4 pb-4">
                <Button variant="secondary" className="w-full" onClick={() => window.open(join, '_blank', 'noopener,noreferrer')}>
                  <IconVideo size={20} aria-hidden /> Войти в урок
                </Button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
