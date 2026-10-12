// ============================================================================
// «Сколько у тебя учеников?» — вопрос онбординга репетитора (PLAN.md Ф2.11б-4,
// макет t10, журнал п.73): варианты ответа, какой тариф подойдёт и что
// сказать о пробном. Без базы — чистый тест (test-teacher-onboarding.mjs).
//
// Срок пробного — не число из макета, а правило базы (`teacher_trial_end`,
// миграция 0005): 14 дней с первого ученика, по рефералке 21, и только пока
// отсчёт не пошёл. Репетитор, у которого тариф уже оплачен или пробный
// кончился (онбординг показывается и на новом устройстве), обещания
// «бесплатно» не видит.
// ============================================================================
import { plural } from '../../shared/lib/plural.ts'
import { planCard, PLANS, teacherTrialStatus, type PaidPlan, type TrialState } from './model.ts'

/** Ответ — id: он же значение события teacher_students и строка в /admin. */
export type StudentBand = '1-5' | '6-10' | '11-30' | '30+'

export const STUDENT_BANDS: { id: StudentBand; label: string; max: number | null }[] = [
  { id: '1-5', label: '1–5', max: 5 },
  { id: '6-10', label: '6–10', max: 10 },
  { id: '11-30', label: '11–30', max: 30 },
  { id: '30+', label: 'больше', max: null },
]

/** Подпись ответа: в /admin «больше» без вопроса непонятно — «больше 30». */
export function bandLabel(id: string): string {
  if (id === '30+') return 'больше 30'
  return STUDENT_BANDS.find((b) => b.id === id)?.label ?? id
}

const BY_SIZE = PLANS.filter((p) => p.studentLimit !== undefined).sort(
  (a, b) => (a.studentLimit ?? 0) - (b.studentLimit ?? 0),
)

/**
 * Какой тариф подойдёт: самый маленький тариф репетитора, куда влезают все
 * ученики ответа. Учеников больше, чем мест в самом большом, — он же и
 * `overflow`: экран добавляет «напиши нам» (журнал п.73).
 */
export function planForBand(band: StudentBand): { plan: PaidPlan; overflow: boolean } {
  const max = STUDENT_BANDS.find((b) => b.id === band)?.max ?? null
  const fit = max === null ? undefined : BY_SIZE.find((p) => (p.studentLimit ?? 0) >= max)
  return { plan: ((fit ?? BY_SIZE[BY_SIZE.length - 1])?.id ?? 'teacher_pro') as PaidPlan, overflow: !fit }
}

/** Что обещать о пробном: до первого ученика, сколько осталось, или ничего. */
export type TrialOffer = { kind: 'before_first' | 'left'; days: number } | { kind: 'none' }

const TRIAL_DAYS = 14

/**
 * Пробный для онбординга. Режим ещё не включён («Я преподаватель» на первом
 * шаге — включит «В студию») или тариф не прочитался (сбой связи): обещаем
 * обычные 14 дней — онбординг идёт сразу после включения режима, отсчёт ещё
 * не пошёл. Иначе — как метка в меню профиля (`teacherTrialStatus`).
 */
export function teacherTrialOffer(isTeacher: boolean, plan: TrialState | null, now = new Date()): TrialOffer {
  if (!isTeacher || !plan) return { kind: 'before_first', days: TRIAL_DAYS }
  return teacherTrialStatus(plan, now) ?? { kind: 'none' }
}

const daysWord = (n: number) => plural(n, 'день', 'дня', 'дней')

/** Строка о пробном: заметка на телефоне и первый пункт справа на компьютере; null — молчим. */
export function trialLine(o: TrialOffer): string | null {
  if (o.kind === 'before_first') return `${o.days} ${daysWord(o.days)} бесплатно — отсчёт пойдёт с первого ученика в приложении`
  if (o.kind === 'left') return o.days === 0 ? 'Пробный период — последний день' : `Пробный период — осталось ${o.days} ${daysWord(o.days)}`
  return null
}

const money = (n: number) => `${n.toLocaleString('ru-RU')} ₸`

function priceTail(o: TrialOffer): string {
  if (o.kind === 'before_first') return ` — после ${o.days} ${plural(o.days, 'бесплатного дня', 'бесплатных дней', 'бесплатных дней')}`
  if (o.kind === 'left') return ' — после пробного периода'
  return ''
}

/** Карточка «Подойдёт тариф» (макет t10-4). */
export interface PlanOffer {
  title: string
  students: string
  price: string
  /** Учеников больше, чем мест в самом большом тарифе: «напиши нам». */
  overflow: boolean
}

/**
 * Карточка тарифа по ответу. Ответа ещё нет (шаг 1 или шаг 2 до выбора) —
 * общая: «Mini · Start · Pro», «5, 10 или 30 учеников», «от 3 900 ₸»
 * (журнал п.73: справа всегда тариф).
 */
export function planOffer(band: StudentBand | null, o: TrialOffer): PlanOffer {
  const seats = (n: number) => `${n} ${plural(n, 'ученик', 'ученика', 'учеников')} в приложении`
  if (!band) {
    const limits = BY_SIZE.map((p) => p.studentLimit ?? 0)
    return {
      title: BY_SIZE.map((p) => p.title.split(' · ').pop()).join(' · '),
      students: `${limits.slice(0, -1).join(', ')} или ${seats(limits[limits.length - 1] ?? 0)}`,
      price: `от ${money(BY_SIZE[0]?.price ?? 0)} в месяц${priceTail(o)}`,
      overflow: false,
    }
  }
  const { plan, overflow } = planForBand(band)
  const card = planCard(plan)
  return {
    title: card.title.split(' · ').pop() ?? card.title,
    students: seats(card.studentLimit ?? 0),
    price: `${money(card.price)} в месяц${priceTail(o)}`,
    overflow,
  }
}
