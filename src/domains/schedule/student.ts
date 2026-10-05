// ============================================================================
// Уроки глазами ученика (PLAN.md Ф2.9; макеты u1, u2; журнал п.32, 33, 43):
// карточка «Ближайший урок» на Главной, список «Мои уроки», тихая строка
// остатка. Ученик только смотрит: перенести и отменить не может.
// Без базы — чистый тест (scripts/test-my-lessons.mjs). Время — по Алматы.
// ============================================================================
import { daysBetween } from '../../shared/lib/days.ts'
import { almatyTime, dayShort, lessonDay, lessonsCount, timeRange } from './calendar.ts'
import { almatyDay, type MyLesson, type MyLessonBalance } from './model.ts'

/** Сколько «Мои уроки» показывают: месяц назад и два вперёд (get_my_lessons — до 100 дней). */
export const MY_LESSONS_BACK_DAYS = 30
export const MY_LESSONS_AHEAD_DAYS = 60
/** Главной хватает двух недель вперёд: ей нужен только ближайший урок. */
export const HOME_LESSONS_AHEAD_DAYS = 14
/** За сколько минут до начала карточка урока становится главной (макет u1-2). */
export const SOON_MINUTES = 10

const ms = (iso: string): number => new Date(iso).getTime()

/** Ближайший урок, который ещё будет или идёт сейчас; отменённые не в счёт. */
export function nextLesson<T extends Pick<MyLesson, 'status' | 'startsAt' | 'endsAt'>>(lessons: T[], now: Date): T | null {
  return (
    lessons
      .filter((l) => l.status !== 'cancelled' && ms(l.endsAt) > now.getTime())
      .sort((a, b) => ms(a.startsAt) - ms(b.startsAt))[0] ?? null
  )
}

/** live — идёт; soon — начнётся в ближайшие 10 минут; later — позже. */
export type CardPhase = 'live' | 'soon' | 'later'

export function cardPhase(l: Pick<MyLesson, 'startsAt' | 'endsAt'>, now: Date): CardPhase {
  const t = now.getTime()
  if (t >= ms(l.startsAt)) return 'live'
  return ms(l.startsAt) - t <= SOON_MINUTES * 60_000 ? 'soon' : 'later'
}

/** Заголовок карточки: «Ближайший урок» · «Урок через 10 минут» · «Урок идёт». */
export function cardTitle(l: Pick<MyLesson, 'startsAt' | 'endsAt'>, now: Date): string {
  const phase = cardPhase(l, now)
  if (phase === 'live') return 'Урок идёт'
  if (phase === 'later') return 'Ближайший урок'
  const mins = Math.max(1, Math.ceil((ms(l.startsAt) - now.getTime()) / 60_000))
  return `Урок через ${mins} мин`
}

/** «Сегодня, 19:00–20:00» · «Завтра, 19:00–20:00» · «чт, 15 окт, 19:00–20:00». */
export function whenLabel(l: Pick<MyLesson, 'startsAt' | 'endsAt'>, now: Date): string {
  const day = lessonDay(l)
  const diff = daysBetween(almatyDay(now), day)
  const head = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : dayShort(day)
  return `${head}, ${timeRange(l)}`
}

/**
 * С кем урок: у группы — её название (других участников ученик не видит,
 * п.43), у индивидуального — имя преподавателя. Не «английский с Мадиной»:
 * языка урока в базе нет, а имя по падежам правилом не склонить (журнал п.68).
 */
export const whoLabel = (l: Pick<MyLesson, 'kind' | 'title' | 'teacherName'>): string =>
  l.title ?? l.teacherName

export const isGroup = (l: Pick<MyLesson, 'kind'>): boolean => l.kind === 'group'

/** Ссылку показываем, пока урок не кончился и не отменён. */
export const canJoin = (l: Pick<MyLesson, 'status' | 'endsAt' | 'link'>, now: Date): boolean =>
  !!l.link && l.status !== 'cancelled' && ms(l.endsAt) > now.getTime()

/**
 * У какого урока в списке «Войти в урок» (макет u2-1): у ближайшего, и только
 * в его день — ссылка на урок через неделю только отвлекает.
 */
export function joinLessonId(lessons: Pick<MyLesson, 'id' | 'status' | 'startsAt' | 'endsAt' | 'link'>[], now: Date): string | null {
  const next = nextLesson(lessons, now)
  return next && canJoin(next, now) && lessonDay(next) === almatyDay(now) ? next.id : null
}

/** «Ближайшие» (ещё не кончились, по времени) и «Прошедшие» (свежие сверху). */
export function splitMyLessons<T extends Pick<MyLesson, 'startsAt' | 'endsAt'>>(lessons: T[], now: Date): { upcoming: T[]; past: T[] } {
  const t = now.getTime()
  const upcoming = lessons.filter((l) => ms(l.endsAt) > t).sort((a, b) => ms(a.startsAt) - ms(b.startsAt))
  const past = lessons.filter((l) => ms(l.endsAt) <= t).sort((a, b) => ms(b.startsAt) - ms(a.startsAt))
  return { upcoming, past }
}

/** Плитка даты в строке: «чт» и «15». */
export function dateTile(l: Pick<MyLesson, 'startsAt'>): { weekday: string; day: number } {
  const day = lessonDay(l)
  return { weekday: dayShort(day).split(',')[0] ?? '', day: Number(day.slice(8, 10)) }
}

/** Пометка строки: «Отменён» · «Перенесён с чт, 22 окт, 19:00» — или ничего. */
export function lessonNote(l: Pick<MyLesson, 'status' | 'movedFrom'>): { kind: 'cancelled' | 'moved'; text: string } | null {
  if (l.status === 'cancelled') return { kind: 'cancelled', text: 'Отменён' }
  if (!l.movedFrom) return null
  return { kind: 'moved', text: `Перенесён с ${dayShort(lessonDay({ startsAt: l.movedFrom }))}, ${almatyTime(l.movedFrom)}` }
}

/**
 * Тихая строка остатка (журнал п.33, макет u2): «Оплачено ещё 3 урока»; ноль
 * и минус — «Оплаченные уроки закончились», без чисел меньше нуля. Учёт не
 * ведётся (tracked = false) — строки нет: «закончились» было бы неправдой.
 * Преподавателей несколько — с именем: «Мадина: оплачено ещё 3 урока».
 */
export function balanceLines(balances: MyLessonBalance[]): string[] {
  const tracked = balances.filter((b) => b.tracked)
  return tracked.map((b) => {
    const text = b.lessonsLeft > 0 ? `оплачено ещё ${lessonsCount(b.lessonsLeft)}` : 'оплаченные уроки закончились'
    return tracked.length > 1 ? `${b.teacherName}: ${text}` : text.charAt(0).toUpperCase() + text.slice(1)
  })
}
