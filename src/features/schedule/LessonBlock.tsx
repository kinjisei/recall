// ============================================================================
// Урок на сетке часов (макеты t2-1, t2-3, t2-2, d1). Три размера:
//   day  — лента дня: аватар, «10:00 Тимур Ким», строка под именем, метка;
//   week — неделя колонками на компьютере (d1): имя, под ним время и
//          состояние значком — «10:00 ✓», «→ с пн, 18:00», «× отменён»,
//          «✦ пробный», «⚠ поздняя отмена», у группы «· 👥 3»; ближайший —
//          в кольце фокуса, наведение — кольцо;
//   mini — неделя колонками на телефоне: только час начала («16»); не кнопка —
//          колонка шириной 42 px открывает день целиком.
// Карточка day и week — одна кнопка: открывает шторку урока. Состояние читается и
// без цвета: метка — словом или значком со словом, отмена — зачёркнуто или
// пунктиром, поздняя отмена — штриховкой. Подложка — LESSON_LOOK (LessonParts).
// ============================================================================
import {
  almatyTime,
  lessonBadge,
  lessonName,
  lessonSubtitle,
  movedFromLabel,
  relativeLabel,
  timeRange,
  type Lesson,
} from '../../domains/schedule'
import { IconArrowRight, IconCheck, IconClose, IconLink, IconSparkle, IconUsers, IconWarning } from '../../shared/ui/icons'
import { Badge, LessonAvatar, lessonLook, lookKind } from './LessonParts'

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
  /** Ближайший урок — с «через 50 мин» (день) или в кольце (неделя). */
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
  const base = `h-full w-full overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-focus ${lessonLook(lesson, size)}`

  // мини-сетка телефона: урок — картинка, нажимается день целиком (WeekGrid)
  if (size === 'mini') {
    return (
      <span title={label} className={`${base} flex items-start justify-center rounded-tag pt-0.5`}>
        <span className={`text-caption font-bold tabular-nums ${cancelled ? 'line-through' : ''}`}>{almatyTime(lesson.startsAt).slice(0, 2)}</span>
      </span>
    )
  }

  if (size === 'week') {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => onOpen(lesson.id)}
        className={`${base} flex flex-col rounded-tag px-1.75 py-1 leading-[1.3] transition-shadow duration-(--dur-1) hover:ring-2 hover:ring-focus ${
          next ? 'ring-2 ring-focus ring-offset-2 ring-offset-surface' : ''
        }`}
      >
        <span className={`truncate text-xs font-semibold ${cancelled ? 'line-through' : ''}`}>{name}</span>
        {tall && <WeekState lesson={lesson} now={now} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onOpen(lesson.id)}
      className={`${base} flex items-center gap-2.5 rounded-tile px-3 py-1.5 transition-[filter] hover:brightness-95`}
    >
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

/** Вторая строка урока в неделе (d1): время и состояние значком. */
function WeekState({ lesson, now }: { lesson: Lesson; now: Date }) {
  const row = 'flex min-w-0 items-center gap-1 truncate text-caption'
  const kind = lookKind(lesson)
  if (kind === 'cancelled') {
    return (
      <span className={row}>
        <IconClose size={11} aria-hidden className="flex-none" />
        отменён
      </span>
    )
  }
  if (kind === 'late') {
    return (
      <span className={`${row} font-semibold text-warning-strong`}>
        <IconWarning size={11} aria-hidden className="flex-none" />
        поздняя отмена
      </span>
    )
  }
  const badge = lessonBadge(lesson, now)
  if (badge?.icon === 'moved') {
    return (
      <span className={row}>
        <IconArrowRight size={11} aria-hidden className="flex-none" />
        {movedFromLabel(lesson) ?? 'перенесён'}
      </span>
    )
  }
  if (kind === 'trial') {
    return (
      <span className={`${row} text-fg-secondary`}>
        <IconSparkle size={11} aria-hidden className="flex-none" />
        пробный
      </span>
    )
  }
  const done = badge?.icon === 'check' || badge?.icon === 'auto'
  return (
    <span className={row}>
      <span className="font-semibold tabular-nums">{almatyTime(lesson.startsAt)}</span>
      {done && <IconCheck size={11} aria-hidden className="flex-none" />}
      {badge && !done && <span className="truncate">· {badge.text.toLowerCase()}</span>}
      {!badge && lesson.kind === 'group' && (
        <>
          ·<IconUsers size={11} aria-hidden className="flex-none" />
          {lesson.participants.length}
        </>
      )}
      {!badge && lesson.kind !== 'group' && lesson.link && (
        <>
          ·<IconLink size={11} aria-hidden className="flex-none" />
        </>
      )}
    </span>
  )
}
