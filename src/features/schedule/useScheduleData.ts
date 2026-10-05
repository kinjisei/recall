// ============================================================================
// Данные расписания — два слоя загрузки (PLAN.md Ф2.7):
//   • основа — роль, тариф (можно ли писать), карточки учеников, серии,
//     остатки, ссылка по умолчанию, у кого включены уведомления (Ф2.9):
//     читается при входе и после действий;
//   • уроки — неделя на экране плюс две недели до сегодня (вопрос «остаётся
//     заниматься?» после пробного, журнал п.30): читаются при листании.
// Сбой связи — LoadError с «Повторить», а не пустое расписание (Ф1.13).
// ============================================================================
import { addDays, daysBetween } from '../../shared/lib/days'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import {
  dayBounds,
  loadDefaultLessonLink,
  loadLessonBalances,
  loadMySeries,
  loadSchedule,
  RANGE_MAX_DAYS,
  type Lesson,
  type LessonBalance,
  type Series,
} from '../../domains/schedule'
import { loadStudentCards, type StudentCard } from '../../domains/students'
import { loadStudentsPush } from '../../domains/notifications'
import { loadProfile } from '../../lib/profile'
import { getMyPlan, type MyPlan } from '../../lib/billing'

export interface ScheduleBase {
  teacher: boolean
  plan: MyPlan | null
  cards: StudentCard[]
  series: Series[]
  balances: LessonBalance[]
  defaultLink: string | null
  /** Карточка → включены ли у ученика уведомления (журнал п.68). */
  push: Map<string, boolean>
}

export function useScheduleBase(userId: string | null, version: number) {
  return useAsyncData<ScheduleBase>(
    async () => {
      const profile = userId ? await loadProfile(userId) : null
      if (profile?.role !== 'teacher') {
        return { teacher: false, plan: null, cards: [], series: [], balances: [], defaultLink: null, push: new Map() }
      }
      const [plan, cards, series, balances, defaultLink, push] = await Promise.all([
        getMyPlan(),
        loadStudentCards(),
        loadMySeries(),
        loadLessonBalances(),
        loadDefaultLessonLink(),
        loadStudentsPush(),
      ])
      return { teacher: true, plan, cards, series, balances, defaultLink, push }
    },
    [userId, version],
    'Не удалось открыть расписание',
  )
}

/** Уроки одного дня — для «Пересекается с …» в шторках (t3-4). */
export function useDayLessons(day: string) {
  return useAsyncData(() => loadSchedule(dayBounds(day).from, dayBounds(day).to), [day], 'Не удалось проверить пересечения')
}

/**
 * Уроки впереди (окно серий — 12 недель, в предел чтения помещается) — для
 * предупреждения «этот и все следующие перестроят N перенесённых» (п.65, 3).
 */
export function useLessonsAhead(today: string, enabled: boolean) {
  return useAsyncData(
    () => (enabled ? loadSchedule(dayBounds(today).from, dayBounds(addDays(today, RANGE_MAX_DAYS - 1)).from) : Promise.resolve([])),
    [today, enabled],
    'Не удалось загрузить уроки серии',
  )
}

/** Сколько дней назад смотрим пробные уроки для вопроса «остаётся заниматься?». */
const TRIAL_LOOKBACK_DAYS = 14

/**
 * Уроки недели (с понедельника `monday`) и недавние — одним запросом, если
 * помещаются в предел чтения, иначе двумя. `key` — для какой недели ответ:
 * пока грузится новая, экран не показывает старую под новыми датами.
 */
export function useLessons(monday: string, today: string, version: number, enabled: boolean) {
  return useAsyncData<{ key: string; lessons: Lesson[] }>(
    async () => {
      const key = `${monday}|${version}`
      if (!enabled) return { key, lessons: [] }
      const weekEnd = addDays(monday, 7)
      const recent = addDays(today, -TRIAL_LOOKBACK_DAYS)
      const from = recent < monday ? recent : monday
      const to = weekEnd > addDays(today, 1) ? weekEnd : addDays(today, 1)
      const read = (a: string, b: string) => loadSchedule(dayBounds(a).from, dayBounds(b).from)
      if (daysBetween(from, to) <= RANGE_MAX_DAYS) return { key, lessons: await read(from, to) }
      const [week, past] = await Promise.all([read(monday, weekEnd), read(recent, addDays(today, 1))])
      const seen = new Set(week.map((l) => l.id))
      return { key, lessons: [...week, ...past.filter((l) => !seen.has(l.id))] }
    },
    [monday, today, version, enabled],
    'Не удалось загрузить уроки',
  )
}
