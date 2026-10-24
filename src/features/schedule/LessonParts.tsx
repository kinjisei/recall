// ============================================================================
// Мелкие части урока (макеты t2–t5): метка состояния, аватар, строка «кто и
// когда» и «… получит уведомление» в шторках переноса и отмены. Одни и те же
// в дне, неделе, списке и шторке — иначе урок в разных видах выглядел бы
// по-разному. Что написать в метке, решает domains/schedule (lessonBadge).
// ============================================================================
import { dayShort, isTrialLesson, lessonDay, lessonName, notifiedLine, timeRange, type BadgeIcon, type BadgeTone, type Lesson, type LessonBadge } from '../../domains/schedule'
import { firstName } from '../../domains/students'
import { Avatar } from '../students'
import { IconArrowRight, IconBell, IconCheck, IconClockAuto, IconSparkle, IconUsers, IconWarning, IconXCircle, type IconLike } from '../../shared/ui/icons'

const TONE: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success-soft-fg',
  warning: 'bg-warning/15 text-warning-strong',
  accent: 'bg-accent-soft text-accent-soft-fg',
  muted: 'bg-tint/[0.08] text-fg-secondary',
}

const ICON: Record<BadgeIcon, IconLike> = {
  auto: IconClockAuto,
  late: IconWarning,
  moved: IconArrowRight,
  check: IconCheck,
  cancel: IconXCircle,
}

/** Метка: «✓ Списан», «⟳ Автосписание», «⚠ Поздняя отмена»… Цвет — не единственный признак: есть слово и значок. */
export function Badge({ badge, className = '' }: { badge: LessonBadge; className?: string }) {
  const Icon = badge.icon ? ICON[badge.icon] : null
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${TONE[badge.tone]} ${className}`}
    >
      {Icon && <Icon size={12} aria-hidden />}
      {badge.text}
    </span>
  )
}

/**
 * Аватар урока: группа — значок людей, пробный — искра, иначе инициалы
 * ученика (в приложении — заливка, без приложения — пунктир, как в «Учениках»).
 */
export function LessonAvatar({ lesson, inApp, small = false }: { lesson: Lesson; inApp: (cardId: string) => boolean; small?: boolean }) {
  const size = small ? 'size-7' : 'size-10'
  if (lesson.kind === 'group') {
    return (
      <span aria-hidden className={`flex flex-none items-center justify-center rounded-full bg-accent text-accent-fg ${size}`}>
        <IconUsers size={small ? 15 : 20} />
      </span>
    )
  }
  if (isTrialLesson(lesson)) {
    return (
      <span aria-hidden className={`flex flex-none items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg ${size}`}>
        <IconSparkle size={small ? 15 : 20} />
      </span>
    )
  }
  const p = lesson.participants[0]
  return p ? <Avatar name={p.name} inApp={inApp(p.cardId)} small={small} /> : null
}

export type LookKind = 'one' | 'group' | 'trial' | 'cancelled' | 'late'
export type LookPlace = 'day' | 'week' | 'mini'

/** Какой урок по виду: ученик, группа, пробный, отменён, поздняя отмена. */
export function lookKind(lesson: Lesson): LookKind {
  if (lesson.status === 'cancelled') return lesson.participants.some((p) => p.charge === 'late_cancel') ? 'late' : 'cancelled'
  if (lesson.kind === 'group') return 'group'
  return isTrialLesson(lesson) ? 'trial' : 'one'
}

/**
 * Подложка урока по месту и виду. В неделе урок на ступень заметнее, чем в
 * ленте дня: ученик — мягкий акцент, группа — сплошной (d1, t2-2); в ленте
 * дня (t2-1) ученик — белая карточка, группа — мягкий с рамкой. Пробный —
 * рамкой ring (на мини-сетке — пунктиром), отмена — бледно, поздняя отмена —
 * штриховкой: состояние читается и без цвета.
 */
export const LESSON_LOOK: Record<LookPlace, Record<LookKind, string>> = {
  day: {
    one: 'border border-tint/[0.08] bg-surface text-fg shadow-card',
    group: 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-accent',
    trial: 'bg-surface text-fg inset-ring-2 inset-ring-ring',
    cancelled: 'border border-dashed border-tint/[0.18] bg-tint/[0.03] text-fg-muted',
    late: 'bg-hatch-warning text-fg-secondary inset-ring inset-ring-warning/40',
  },
  week: {
    one: 'relative bg-accent-soft text-accent-soft-fg before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-accent',
    group: 'bg-accent text-accent-fg',
    trial: 'bg-surface text-fg inset-ring-2 inset-ring-ring',
    cancelled: 'text-fg-muted inset-ring-2 inset-ring-fg-faint',
    late: 'bg-hatch-warning text-fg inset-ring inset-ring-warning',
  },
  mini: {
    one: 'bg-accent-soft text-accent-soft-fg inset-ring inset-ring-accent',
    group: 'bg-accent text-accent-fg',
    trial: 'border border-dashed border-accent bg-surface text-fg',
    cancelled: 'bg-tint/[0.06] text-fg-muted inset-ring inset-ring-fg-faint',
    late: 'bg-hatch-warning text-fg inset-ring inset-ring-warning',
  },
}

export function lessonLook(lesson: Lesson, place: LookPlace = 'day'): string {
  return LESSON_LOOK[place][lookKind(lesson)]
}

/** Подпись над выбором в шторках переноса и отмены (t5-1, t5-2): 13, средний, на 4 px внутрь от карточек. */
export const CHOICE_LABEL = 'px-1 text-note font-medium text-fg-muted'

/** Кто и когда — под заголовком шторок переноса и отмены (t5-1, t5-2, d2-2): аватар, имя, «чт, 22 окт, 19:00–20:00». */
export function LessonWho({ lesson, inApp }: { lesson: Lesson; inApp: (cardId: string) => boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <LessonAvatar lesson={lesson} inApp={inApp} small />
      <p className="flex min-w-0 flex-col">
        <span className="truncate text-body text-fg">{lessonName(lesson)}</span>
        <span className="text-note text-fg-muted tabular-nums">
          {dayShort(lessonDay(lesson))}, {timeRange(lesson)}
        </span>
      </p>
    </div>
  )
}

/** «Айгерим получит уведомление» — кому Recall напишет сам (reached — до карточки достаёт); никому — ничего. */
export function NotifyLine({ lesson, reached }: { lesson: Lesson; reached: (cardId: string) => boolean }) {
  const line = notifiedLine(lesson.participants.filter((p) => reached(p.cardId)).map((p) => firstName(p.name)))
  return line ? (
    <p className="-mt-1 flex items-center gap-2 px-1 text-sm text-fg-secondary">
      <IconBell size={18} aria-hidden className="flex-none text-fg-muted" />
      {line}
    </p>
  ) : null
}
