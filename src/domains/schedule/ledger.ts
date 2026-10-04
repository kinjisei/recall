// ============================================================================
// Учёт уроков на экране (PLAN.md Ф2.8; макеты t7-1 … t7-3; журнал п.29, 67):
// подпись остатка, строки истории «оплаты и уроки», текст «Напомнить».
// Без базы — чистый тест (scripts/test-lesson-ledger.mjs). Решает база:
// остаток — card_lesson_balance, «остался 1» — notify_lessons_low (0010).
// ============================================================================
import { isoWeekday } from '../../shared/lib/days.ts'
import { almatyTime, dateShort, dayShort, lessonDay, lessonsCount } from './calendar.ts'
import type { Charge, LessonBalance, LessonKind, LessonStatus } from './model.ts'

/** Запись истории карточки — строка get_card_history. */
export interface HistoryItem {
  item: 'payment' | 'lesson'
  id: string
  at: string
  /** Оплата: «+8», исправление — с минусом. */
  n: number | null
  note: string | null
  paidOn: string | null
  lessonKind: LessonKind | null
  lessonStatus: LessonStatus | null
  /** Название урока или его серии (группа). */
  title: string | null
  startsAt: string | null
  trial: boolean | null
  attended: boolean | null
  charge: Charge | null
  chargeAuto: boolean | null
}

/** Учёт ведётся, если учитель хоть раз отметил оплату (журнал п.33: «учёт ведётся»). */
export const isTracked = (b: Pick<LessonBalance, 'paid'> | null | undefined): boolean => (b?.paid ?? 0) > 0

/**
 * Остаток для учителя (макет t7-1): «Оплачено, осталось 3 урока»,
 * «Оплаченные уроки закончились · −2» — минус видит только учитель (п.29).
 */
export function balanceLabel(b: LessonBalance | null | undefined): string {
  if (!b || !isTracked(b)) return 'Оплаты не отмечены'
  if (b.balance > 0) return `Оплачено, осталось ${lessonsCount(b.balance)}`
  return b.balance === 0 ? 'Оплаченные уроки закончились' : `Оплаченные уроки закончились · −${-b.balance}`
}

/** Короткое число для строки списка: «6», «−2»; не ведётся — пусто. */
export function balanceShort(b: LessonBalance | null | undefined): string | null {
  if (!b || !isTracked(b)) return null
  return b.balance < 0 ? `−${-b.balance}` : String(b.balance)
}

/** Требует ли ученик внимания по оплате: остаток 1 или меньше (журнал п.67). */
export const balanceLow = (b: LessonBalance | null | undefined): boolean => isTracked(b) && (b?.balance ?? 0) <= 1

export interface HistoryRow {
  title: string
  detail: string
  /** «+8», «−1», «0»; null — не отмечено. */
  delta: number | null
  /** Что можно исправить нажатием: урок — отметку, отменённый — списание, оплату — снять. */
  fix: 'lesson' | 'cancelled' | 'payment' | null
}

const when = (iso: string) => `${dayShort(lessonDay({ startsAt: iso }))} · ${almatyTime(iso)}`

/** Строка истории (макет t7-2). */
export function historyRow(h: HistoryItem): HistoryRow {
  if (h.item === 'payment') {
    const n = h.n ?? 0
    const day = h.paidOn ? dateShort(h.paidOn) : ''
    return {
      title: n > 0 ? 'Оплата' : 'Исправление оплаты',
      detail: [day, 'отмечена тобой', h.note].filter(Boolean).join(' · '),
      delta: n,
      fix: n > 0 ? 'payment' : null,
    }
  }
  const at = h.startsAt ? when(h.startsAt) : ''
  const group = h.lessonKind === 'group' && h.title ? ` · ${h.title}` : ''
  if (h.lessonStatus === 'cancelled') {
    return h.charge === 'late_cancel'
      ? { title: 'Поздняя отмена', detail: `${at} · списан`, delta: -1, fix: 'cancelled' }
      : { title: `Отменён${group}`, detail: `${at} · не списан`, delta: 0, fix: h.trial ? null : 'cancelled' }
  }
  if (h.trial) return { title: 'Пробный урок', detail: `${at} · без списания`, delta: 0, fix: 'lesson' }
  if (h.charge === null) return { title: `Не отмечен${group}`, detail: `${at} · не списан`, delta: null, fix: 'lesson' }
  if (h.charge === 'late_cancel') return { title: 'Поздняя отмена', detail: `${at} · списан`, delta: -1, fix: 'lesson' }
  if (h.attended && h.charge === 'charged')
    return { title: `Проведён${group}`, detail: `${at} · ${h.chargeAuto ? 'списан автоматически' : 'списан'}`, delta: -1, fix: 'lesson' }
  if (h.attended) return { title: `Проведён${group}`, detail: `${at} · не списан`, delta: 0, fix: 'lesson' }
  return { title: 'Не был', detail: `${at} · не списан`, delta: 0, fix: 'lesson' }
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

/** Месяц записи для заголовка группы: «Октябрь», другой год — «Декабрь 2025». */
export function historyMonth(h: Pick<HistoryItem, 'at' | 'paidOn' | 'startsAt'>, today: string): string {
  const day = h.paidOn ?? lessonDay({ startsAt: h.startsAt ?? h.at })
  const name = MONTHS[Number(day.slice(5, 7)) - 1] ?? ''
  return day.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${day.slice(0, 4)}`
}

// «во вторник в 10:00» — день недели полностью: так пишут люди
const ON_DAY = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье']

/**
 * «Напомнить» об оплате (макет t7-3) — учитель отправляет сам, текст можно
 * поправить. Ни слова о сумме: деньги Recall не касаются (п.29).
 * «Тимур, привет! Остался один оплаченный урок — во вторник в 10:00.
 *  Продолжаем? Тогда пришли, пожалуйста, оплату за следующие уроки.»
 */
export function paymentReminder(who: string, left: number, next: string | null): string {
  const tail = 'Продолжаем? Тогда пришли, пожалуйста, оплату за следующие уроки.'
  if (left <= 0) return `${who}, привет! Оплаченные уроки закончились. ${tail}`
  const nextPart = next ? ` — ${ON_DAY[isoWeekday(lessonDay({ startsAt: next })) - 1]} в ${almatyTime(next)}` : ''
  const lead = left === 1 ? `Остался один оплаченный урок${nextPart}.` : `Оплачено ещё ${lessonsCount(left)}.`
  return `${who}, привет! ${lead} ${tail}`
}
