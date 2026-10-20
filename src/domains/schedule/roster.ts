// ============================================================================
// Уроки глазами списка «Учеников» (макеты d3, t6-1; PLAN.md Ф2.17-4б-1):
// ближайший урок карточки — вторая строка ученика («сегодня 17:00 · IELTS
// вечер») и ключ сортировки «Ближайший урок»; группы студии — раздел
// «Группы» под учениками («сегодня 17:00 · 3 ученика»). Чистые правила, без
// базы: проверяет scripts/test-student-roster.mjs.
// ============================================================================
import { addDays, daysBetween, isoWeekday } from '../../shared/lib/days.ts'
import { plural } from '../../shared/lib/plural.ts'
import { almatyTime, dateShort, lessonDay, weekdayName } from './calendar.ts'
import { almatyDay, type Lesson, type Series } from './model.ts'

/**
 * Ближайший урок карточки: запланированный, ещё не закончился (идущий —
 * тоже ближайший), самый ранний. Отменённый — не урок.
 */
export function nextLessonOf(lessons: Lesson[], cardId: string, now: Date): Lesson | null {
  let best: Lesson | null = null
  for (const l of lessons) {
    if (l.status !== 'planned' || new Date(l.endsAt) <= now) continue
    if (!l.participants.some((p) => p.cardId === cardId)) continue
    if (!best || l.startsAt < best.startsAt) best = l
  }
  return best
}

/**
 * Когда урок — коротко, для строки списка: «сегодня 17:00», «завтра 9:30»,
 * в пределах недели — «пн 16:00», дальше — «21 окт 16:00». День — по Алматы.
 */
export function whenShort(l: Pick<Lesson, 'startsAt'>, now: Date): string {
  const day = lessonDay(l)
  const days = daysBetween(almatyDay(now), day)
  const time = almatyTime(l.startsAt)
  if (days === 0) return `сегодня ${time}`
  if (days === 1) return `завтра ${time}`
  if (days > 1 && days < 7) return `${weekdayName(isoWeekday(day))} ${time}`
  return `${dateShort(day)} ${time}`
}

/** Вторая строка ученика: «сегодня 17:00 · IELTS вечер»; уроков нет — так и пишем. */
export function lessonLine(l: Lesson | null, now: Date): string {
  if (!l) return 'уроков нет'
  const when = whenShort(l, now)
  return l.kind === 'group' && l.title ? `${when} · ${l.title}` : when
}

export interface StudioGroup {
  seriesId: string
  title: string
  /** Карточек в группе. */
  count: number
  /** Ближайший урок группы; null — в окне загрузки уроков его нет. */
  next: Lesson | null
}

/**
 * Группы студии — групповые серии, которые ещё идут (без конца или конец не
 * раньше сегодня), с ближайшим уроком. Порядок — по ближайшему уроку, у кого
 * его нет — в конце, по названию.
 */
export function studioGroups(series: Series[], lessons: Lesson[], now: Date): StudioGroup[] {
  const today = almatyDay(now)
  return series
    .filter((s) => s.kind === 'group' && (!s.endsOn || s.endsOn >= today))
    .map((s) => {
      let next: Lesson | null = null
      for (const l of lessons) {
        if (l.seriesId !== s.id || l.status !== 'planned' || new Date(l.endsAt) <= now) continue
        if (!next || l.startsAt < next.startsAt) next = l
      }
      return { seriesId: s.id, title: s.title || 'Группа', count: s.cardIds.length, next }
    })
    .sort((a, b) =>
      a.next && b.next ? a.next.startsAt.localeCompare(b.next.startsAt) : a.next ? -1 : b.next ? 1 : a.title.localeCompare(b.title, 'ru'),
    )
}

/** «сегодня 17:00 · 3 ученика» — строка группы. */
export function groupLine(g: StudioGroup, now: Date): string {
  const who = `${g.count} ${plural(g.count, 'ученик', 'ученика', 'учеников')}`
  return g.next ? `${whenShort(g.next, now)} · ${who}` : who
}

/** Адрес урока группы в расписании: день и открытая шторка урока. */
export function groupLessonPath(g: StudioGroup): string {
  return g.next ? `/schedule?view=day&day=${lessonDay(g.next)}&lesson=${g.next.id}` : '/schedule'
}

/** Окно уроков для списка: две недели назад (пробные для вопроса «остаётся?») и вперёд. */
export function rosterWindow(now: Date): { from: string; to: string } {
  const today = almatyDay(now)
  return { from: addDays(today, -14), to: addDays(today, 15) }
}
