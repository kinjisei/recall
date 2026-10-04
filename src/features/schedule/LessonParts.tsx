// ============================================================================
// Мелкие части урока (макеты t2–t4): метка состояния и аватар. Одни и те же
// в дне, неделе, списке и шторке — иначе урок в разных видах выглядел бы
// по-разному. Что написать в метке, решает domains/schedule (lessonBadge).
// ============================================================================
import { isTrialLesson, type BadgeIcon, type BadgeTone, type Lesson, type LessonBadge } from '../../domains/schedule'
import { Avatar } from '../students'
import { IconArrowRight, IconCheck, IconClockAuto, IconSparkle, IconUsers, IconWarning, IconXCircle, type IconLike } from '../../shared/ui/icons'

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
