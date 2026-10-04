// ============================================================================
// Урок на сетке часов (макеты t2-1, t2-3, d1). Три размера:
//   day  — лента дня: аватар, «10:00 Тимур Ким», строка под именем, метка;
//   week — неделя колонками на компьютере: имя, время и метка в одну-две строки;
//   mini — неделя колонками на телефоне: только час начала («16»); не кнопка —
//          колонка шириной 42 px открывает день целиком.
// Карточка day и week — одна кнопка: открывает шторку урока. Состояние читается и
// без цвета: метка — словом, отмена — пунктиром, поздняя отмена — штриховкой.
// ============================================================================
import {
  almatyTime,
  lessonBadge,
  lessonName,
  lessonSubtitle,
  relativeLabel,
  timeRange,
  type Lesson,
} from '../../domains/schedule'
import { Badge, LessonAvatar, lessonLook } from './LessonParts'

export type BlockSize = 'day' | 'week' | 'mini'

export function LessonBlock({
  lesson,
  now,
  size,
  next = false,
  tall = true,
  roomy = false,
  inApp,
  onOpen,
}: {
  lesson: Lesson
  now: Date
  size: BlockSize
  /** Ближайший урок — с «через 50 мин». */
  next?: boolean
  /** Хватает высоты на две строки. */
  tall?: boolean
  /** Хватает на три: «через 50 мин» — строкой, а не меткой (t2-1). */
  roomy?: boolean
  inApp: (cardId: string) => boolean
  onOpen: (id: string) => void
}) {
  const state = lessonBadge(lesson, now)
  const soon = next && !state ? relativeLabel(lesson, now) : null
  // «через 50 мин» — третьей строкой, если блок высокий: метка отнимала бы
  // место у названия группы
  const badge = state ?? (soon && !(size === 'day' && roomy) ? { text: soon, tone: 'accent' as const } : null)
  const name = lessonName(lesson)
  const label = `${timeRange(lesson)}, ${name}${badge ? `, ${badge.text}` : soon ? `, ${soon}` : ''}`
  const cancelled = lesson.status === 'cancelled'
  const base = `h-full w-full overflow-hidden rounded-xl text-left transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-focus ${lessonLook(lesson)}`

  // мини-сетка телефона: урок — картинка, нажимается день целиком (WeekGrid)
  if (size === 'mini') {
    return (
      <span title={label} className={`${base} flex items-start justify-center pt-0.5`}>
        <span className={`text-caption font-bold tabular-nums ${cancelled ? 'line-through' : ''}`}>{almatyTime(lesson.startsAt).slice(0, 2)}</span>
      </span>
    )
  }

  if (size === 'week') {
    return (
      <button type="button" aria-label={label} onClick={() => onOpen(lesson.id)} className={`${base} flex flex-col px-2 py-1`}>
        <span className={`truncate text-caption font-semibold ${cancelled ? 'line-through' : ''}`}>{name}</span>
        <span className="flex min-w-0 items-center gap-1 text-caption opacity-80">
          <span className="tabular-nums">{almatyTime(lesson.startsAt)}</span>
          {tall && badge && <span className="truncate">· {badge.text}</span>}
        </span>
      </button>
    )
  }

  return (
    <button type="button" aria-label={label} onClick={() => onOpen(lesson.id)} className={`${base} flex items-center gap-2.5 px-3 py-1.5`}>
      {tall && <LessonAvatar lesson={lesson} inApp={inApp} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-sm font-bold tabular-nums">{almatyTime(lesson.startsAt)}</span>
          <span className={`truncate text-sm font-semibold ${cancelled ? 'line-through decoration-1' : ''}`}>{name}</span>
        </span>
        {tall && <span className="truncate text-note opacity-80">{lessonSubtitle(lesson, now, inApp)}</span>}
        {roomy && soon && <span className="truncate text-note font-semibold">{soon}</span>}
      </span>
      {badge && <Badge badge={badge} />}
    </button>
  )
}
