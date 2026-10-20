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

/** Подложка урока по типу и состоянию: группа — акцент, пробный — пунктир, отмена — бледно, поздняя отмена — штриховка. */
export function lessonLook(lesson: Lesson): string {
  if (lesson.status === 'cancelled') {
    return lesson.participants.some((p) => p.charge === 'late_cancel')
      ? 'border border-warning/40 bg-hatch-warning text-fg-secondary'
      : 'border border-dashed border-tint/[0.18] bg-tint/[0.03] text-fg-muted'
  }
  if (lesson.kind === 'group') return 'border border-accent-line bg-accent-soft text-accent-soft-fg'
  if (isTrialLesson(lesson)) return 'border border-dashed border-accent-line bg-surface text-fg'
  return 'border border-tint/[0.08] bg-surface text-fg shadow-card'
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
