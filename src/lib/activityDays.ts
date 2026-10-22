// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Дни занятий: одно правило на весь продукт.
//
// Зачем отдельным файлом. Числа про активность ученика показываются в ДВУХ
// местах экрана преподавателя — в строке списка («занимался 5 дней из 7») и в
// плашке карточки. Пока каждое место считало само, они могли разойтись, а
// разойдясь — обесценить оба: преподаватель перестаёт верить не тому числу,
// которое ошиблось, а экрану целиком.
//
// Здесь же серия (streakFrom): её считали три копии — две в lib/activity и
// одна в lib/teacher. Копии одинаковых функций не расходятся ровно до первой
// правки.
//
// ⚠️ День — по Алматы (shared/lib/almaty; решение владельца 22.10.2026), как
// энергия и уроки, а не по часам устройства: учитель видит серию ученика в
// тех же сутках, что и сам ученик. activity_log.day пишет клиент
// (log_activity сверяет ±1 сутки от даты сервера) — тоже по Алматы.
// ============================================================================
import { almatyToday } from '../shared/lib/almaty.ts'

/** Серия дней подряд по множеству дней с занятиями: вчерашняя ещё жива. */
export function streakFrom(days: Set<string>): number {
  let offset = days.has(almatyToday(0)) ? 0 : days.has(almatyToday(-1)) ? -1 : null
  if (offset === null) return 0
  let streak = 0
  while (days.has(almatyToday(offset))) {
    streak++
    offset--
  }
  return streak
}

/**
 * Сколько РАЗНЫХ дней с занятиями попало в последние `window` дней (включая
 * сегодня).
 *
 * Регулярность, а не объём: «занимался 5 дней из 7» говорит о привычке, а
 * «120 карточек» — о том, что человек один раз просидел вечер. Для прогресса
 * частота важнее суммы, и преподавателю нужна именно она.
 */
export function activeDaysIn(days: Iterable<string>, window: number): number {
  const from = almatyToday(-(Math.max(1, window) - 1))
  const seen = new Set<string>()
  for (const d of days) if (d >= from) seen.add(d)
  return seen.size
}

/**
 * Сколько дней назад человек занимался в последний раз. null — ни разу.
 * Ищем в окне 60 дней: столько же грузит список учеников.
 */
export function daysSinceActive(days: Set<string>): number | null {
  for (let i = 0; i <= 60; i++) {
    if (days.has(almatyToday(-i))) return i
  }
  return null
}

/** Окно регулярности. Неделя — шаг между уроками, с ним и сравниваем. */
export const REGULARITY_WINDOW = 7

/** «5 из 7» — одна подпись на список и карточку. */
export function regularityLabel(activeDays: number): string {
  return `${activeDays} из ${REGULARITY_WINDOW}`
}
