// ============================================================================
// Состояние урока одной меткой и строкой под именем (макеты t2-1, t2-3,
// неделя t2-2, d1): одно правило для дня, недели и списка — иначе один и тот
// же урок в разных видах назывался бы по-разному. Без базы и разметки.
// ============================================================================
import { almatyTime, durationLabel, lessonDay, lessonMinutes, relativeLabel, weekdayName } from './calendar.ts'
import { isoWeekday } from '../../shared/lib/days.ts'
import { plural } from '../../shared/lib/plural.ts'
import { lessonPhase, type Lesson } from './model.ts'

export type BadgeTone = 'success' | 'warning' | 'accent' | 'muted'
export type BadgeIcon = 'auto' | 'late' | 'moved' | 'check' | 'cancel'

export interface LessonBadge {
  text: string
  tone: BadgeTone
  icon?: BadgeIcon
}

/** Пробный ли урок для экрана: тип «пробный» или ученик пробный. */
export const isTrialLesson = (l: Pick<Lesson, 'kind' | 'participants'>): boolean =>
  l.kind === 'trial' || (l.kind !== 'group' && l.participants[0]?.trial === true)

/**
 * Метка урока. Порядок важен: отмена и итог урока важнее «пробный» и
 * «перенесён» — в прошлом уроке учителю нужно, чем он кончился.
 */
export function lessonBadge(l: Lesson, now: Date): LessonBadge | null {
  const phase = lessonPhase(l, now)
  if (phase === 'cancelled') {
    return l.participants.some((p) => p.charge === 'late_cancel')
      ? { text: 'Поздняя отмена', tone: 'warning', icon: 'late' }
      : { text: 'Отменён', tone: 'muted', icon: 'cancel' }
  }
  if (phase === 'done') {
    if (l.kind === 'group') return { text: 'Проведён', tone: 'success', icon: 'check' }
    const p = l.participants[0]
    if (!p) return { text: 'Проведён', tone: 'success', icon: 'check' }
    if (p.charge === 'late_cancel') return { text: 'Поздняя отмена', tone: 'warning', icon: 'late' }
    if (p.attended === false) return { text: 'Не был', tone: 'muted' }
    if (p.trial) return { text: 'Пробный', tone: 'accent' }
    if (p.charge === 'charged') {
      return p.chargeAuto
        ? { text: 'Автосписание', tone: 'success', icon: 'auto' }
        : { text: 'Списан', tone: 'success', icon: 'check' }
    }
    return { text: 'Не списан', tone: 'muted', icon: 'check' }
  }
  if (phase === 'unmarked') return { text: 'Не отмечен', tone: 'warning' }
  if (isTrialLesson(l)) return { text: 'Пробный', tone: 'accent' }
  if (l.movedFrom) return { text: 'Перенесён', tone: 'accent', icon: 'moved' }
  if (phase === 'live') return { text: 'Идёт', tone: 'accent' }
  return null
}

/** «с пн, 18:00» — откуда перенесли урок. */
export function movedFromLabel(l: Pick<Lesson, 'movedFrom'>): string | null {
  if (!l.movedFrom) return null
  return `с ${weekdayName(isoWeekday(lessonDay({ startsAt: l.movedFrom })))}, ${almatyTime(l.movedFrom)}`
}

/**
 * Строка под именем: «1 ч · без приложения», «1,5 ч · группа · 3 ученика»,
 * «1 ч · прошёл». Перенесённый — «Перенесён с пн, 18:00».
 */
export function lessonSubtitle(l: Lesson, now: Date, inApp: (cardId: string) => boolean): string {
  const parts = [durationLabel(lessonMinutes(l))]
  if (l.kind === 'group') {
    const n = l.participants.length
    parts.push('группа', `${n} ${plural(n, 'ученик', 'ученика', 'учеников')}`)
  } else if (l.status !== 'cancelled' && l.movedFrom && lessonPhase(l, now) === 'upcoming') {
    return `Перенесён ${movedFromLabel(l)}`
  } else {
    const p = l.participants[0]
    if (p && !inApp(p.cardId)) parts.push('без приложения')
    else if (isTrialLesson(l) && lessonPhase(l, now) !== 'upcoming') parts.push(relativeLabel(l, now))
    else parts.push('индивидуальный')
  }
  return parts.join(' · ')
}

/** Ближайший урок, который ещё не начался, — на нём метка «через 50 мин» (t2-1). */
export function nextLessonId(lessons: Lesson[], now: Date): string | null {
  const t = now.getTime()
  let best: Lesson | null = null
  for (const l of lessons) {
    if (l.status === 'cancelled' || new Date(l.startsAt).getTime() <= t) continue
    if (!best || l.startsAt < best.startsAt) best = l
  }
  return best?.id ?? null
}
