// ============================================================================
// Тарифы и оплата: каталог тарифов и реквизиты для перевода. Без импортов и
// без базы — чистые данные и правила.
// ============================================================================

export type Plan = 'free' | 'premium' | 'teacher_mini' | 'teacher_start' | 'teacher_pro'
export type PaidPlan = Exclude<Plan, 'free'>

export interface PlanCard {
  id: Plan
  title: string
  /** ₸/мес, 0 — бесплатно. */
  price: number
  /** Короткая подпись под ценой. */
  tagline: string
  /** Список того, что входит. */
  features: string[]
  /** Лимит учеников — только для тарифов преподавателя. */
  studentLimit?: number
}

export const PLANS: PlanCard[] = [
  {
    id: 'free',
    title: 'Free',
    price: 0,
    tagline: 'Без срока, карта не нужна',
    features: [
      'Карточки, тексты, грамматика и игры — сколько угодно',
      'В день 100 переводов слова по тапу и 50 попыток произношения',
      '5 ⚡ в день на AI: это 5 реплик в «Диалоге» или 2 проверки письма',
    ],
  },
  {
    id: 'premium',
    title: 'Premium',
    price: 1990,
    tagline: 'Если учишься сам и каждый день',
    features: [
      'Всё из Free',
      '30 ⚡ в день: 30 реплик в «Диалоге» или 15 проверок письма',
      'В день 900 переводов слова и 400 попыток произношения, энергию они не тратят',
    ],
  },
  {
    id: 'teacher_mini',
    title: 'Репетитор · Mini',
    price: 3900,
    tagline: 'Для первых пяти учеников',
    studentLimit: 5,
    features: [
      'Домашка на неделю, материалы под ученика, проверка письменных работ и AI-квесты',
      'Ученики говорят с AI за счёт студии: общий запас 70 ⚡ в день на тебя и учеников',
      '25 генераций в месяц — около 12 материалов: материал стоит 2 генерации, программа и задание по письму — 1. На пробном периоде генераций 2, с первым учеником — 3',
    ],
  },
  {
    id: 'teacher_start',
    title: 'Репетитор · Start',
    price: 6500,
    tagline: 'Когда учеников до десяти',
    studentLimit: 10,
    features: ['Всё из Mini', 'Общий запас студии — 110 ⚡ в день', '45 генераций в месяц — около 22 материалов'],
  },
  {
    id: 'teacher_pro',
    title: 'Репетитор · Pro',
    price: 14990,
    tagline: 'Когда расписание забито',
    studentLimit: 30,
    features: ['Всё из Mini', 'Общий запас студии — 260 ⚡ в день', '90 генераций в месяц — около 45 материалов'],
  },
]

export const KASPI = {
  phone: '+7 776 210 02 21',
  name: 'Ерболат',
}

// ---- оплата -------------------------------------------------------------------

export type PayMethod = 'kaspi_gold' | 'kaspi_pay' | 'card'

/** Способы оплаты — данные, а не код (журнал п.13): новый — строка здесь и в check базы. */
export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: 'kaspi_gold', label: 'Kaspi Gold, перевод' },
  { id: 'kaspi_pay', label: 'Kaspi Pay' },
  { id: 'card', label: 'Карта' },
]

export const PAID_PLANS: PaidPlan[] = ['premium', 'teacher_mini', 'teacher_start', 'teacher_pro']
export const TEACHER_PLANS: PaidPlan[] = ['teacher_mini', 'teacher_start', 'teacher_pro']

export function isPaidPlan(v: unknown): v is PaidPlan {
  return typeof v === 'string' && (PAID_PLANS as string[]).includes(v)
}

export function planCard(id: Plan): PlanCard {
  return PLANS.find((p) => p.id === id) ?? { id, title: id, price: 0, tagline: '', features: [] }
}

/** «Репетитор · Mini» → «Mini»: в списке тарифов репетитора приставка лишняя. */
export function planShortTitle(id: Plan): string {
  return planCard(id).title.split(' · ').pop() ?? id
}

/** «Репетитор · Mini» → «Репетитор Mini»: имя тарифа внутри фразы (макет t9). */
export function planName(id: Plan): string {
  return planCard(id).title.replace(' · ', ' ')
}

/** Сколько перевести за тариф на N месяцев, ₸. */
export function amountFor(plan: PaidPlan, months: number): number {
  return planCard(plan).price * months
}

/**
 * Какие тарифы показать на «Как оплатить»: репетитору — свои три, ученику —
 * Premium. Ссылка с тарифом (`?plan=`) важнее роли: ученик, который только
 * собирается вести учеников, пришёл с карточки «Репетитор · Mini».
 */
export function plansToPay(role: string | null | undefined, requested?: string | null): PaidPlan[] {
  if (requested === 'premium') return ['premium']
  if (requested && TEACHER_PLANS.includes(requested as PaidPlan)) return TEACHER_PLANS
  return role === 'teacher' ? TEACHER_PLANS : ['premium']
}

/** Какой тариф выбран сразу: из ссылки → `current` (тариф заявки или нынешний) → первый. */
export function initialPlanToPay(options: PaidPlan[], current: string | null, requested?: string | null): PaidPlan {
  if (requested && options.includes(requested as PaidPlan)) return requested as PaidPlan
  if (current && options.includes(current as PaidPlan)) return current as PaidPlan
  return options[0] ?? 'premium'
}

/** Что у человека с тарифом — как отдаёт база (profiles через RPC). */
export interface PlanState {
  plan: string
  plan_expires_at: string | null
  trial_until: string | null
}

const time = (iso: string | null): number => (iso ? Date.parse(iso) : NaN)

/**
 * С какого момента начнётся оплаченный срок — ПАРА к confirm_payment
 * (миграция 0004): самая поздняя из дат «сейчас», «конец действующего
 * тарифа», «конец пробного». Действующий продлевается от даты окончания,
 * истёкший — от сегодня, оплата на пробном не съедает его дни.
 */
export function termStart(s: PlanState, now: Date = new Date()): Date {
  const candidates = [now.getTime(), s.plan !== 'free' ? time(s.plan_expires_at) : NaN, time(s.trial_until)]
  return new Date(Math.max(...candidates.filter(Number.isFinite)))
}

/** Казахстан — UTC+5 круглый год (с 01.03.2024, без летнего времени). */
const ALMATY_OFFSET_MS = 5 * 3600_000

/**
 * +N месяцев по календарю Алматы, как `+ make_interval(months => N)` в базе:
 * 16 октября → 16 ноября; 31 января → 28 февраля (дня нет — последний).
 */
export function addMonthsAlmaty(d: Date, months: number): Date {
  const local = new Date(d.getTime() + ALMATY_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const shifted = Date.UTC(
    y,
    m,
    Math.min(local.getUTCDate(), lastDay),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  )
  return new Date(shifted - ALMATY_OFFSET_MS)
}

/** Какой срок купит оплата на N месяцев, если подтвердить её сейчас. */
export function termAfterPayment(s: PlanState, months: number, now: Date = new Date()): { start: Date; end: Date } {
  const start = termStart(s, now)
  return { start, end: addMonthsAlmaty(start, months) }
}

/** Что с тарифом сейчас: оплачен, пробный, закончился или не было. */
export type PlanNow =
  | { kind: 'paid'; plan: PaidPlan; until: Date }
  | { kind: 'trial'; until: Date }
  | { kind: 'ended'; plan: PaidPlan; at: Date }
  | { kind: 'none' }

export function planNow(s: PlanState, now: Date = new Date()): PlanNow {
  const expires = time(s.plan_expires_at)
  const trial = time(s.trial_until)
  if (isPaidPlan(s.plan) && expires > now.getTime()) return { kind: 'paid', plan: s.plan, until: new Date(expires) }
  if (trial > now.getTime()) return { kind: 'trial', until: new Date(trial) }
  if (isPaidPlan(s.plan) && Number.isFinite(expires)) return { kind: 'ended', plan: s.plan, at: new Date(expires) }
  return { kind: 'none' }
}

const yearAlmaty = (d: Date): string =>
  d.toLocaleDateString('en', { timeZone: 'Asia/Almaty', year: 'numeric' })

/**
 * «16 октября», в другом году — «16 октября 2027». День — по Алматы, как
 * дневные границы и месяцы тарифа в базе, а не по часам устройства.
 */
export function dayLabel(d: Date, now: Date = new Date()): string {
  const sameYear = yearAlmaty(d) === yearAlmaty(now)
  return d.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Строка «Сейчас: …» на «Как оплатить» и в админке. */
export function planNowLabel(s: PlanState, now: Date = new Date()): string {
  const p = planNow(s, now)
  switch (p.kind) {
    case 'paid':
      return `${planCard(p.plan).title}, действует до ${dayLabel(p.until, now)}`
    case 'trial':
      return `пробный период до ${dayLabel(p.until, now)}`
    case 'ended':
      return `${planCard(p.plan).title}, закончился ${dayLabel(p.at, now)}`
    default:
      return 'бесплатный тариф'
  }
}

/**
 * Предупреждения владельцу перед «Подтвердить»: тариф понижается при
 * действующем (новый включается сразу) и учеников больше, чем мест.
 */
export function confirmWarnings(s: PlanState, plan: PaidPlan, students: number, now: Date = new Date()): string[] {
  const out: string[] = []
  const p = planNow(s, now)
  if (p.kind === 'paid' && p.plan !== plan && planCard(plan).price < planCard(p.plan).price) {
    out.push(
      `Сейчас ${planCard(p.plan).title} до ${dayLabel(p.until, now)} — после подтверждения сразу станет ${planCard(plan).title}.`,
    )
  }
  const seats = planCard(plan).studentLimit
  if (seats !== undefined && students > seats) {
    // кого покрывать, решает база (covering_teacher): отмеченных учителем, иначе
    // первых по дате привязки — здесь только сколько останется без покрытия
    out.push(`Учеников ${students}, а мест в тарифе ${seats}: ${students - seats} останутся без повышенных лимитов AI.`)
  }
  return out
}

// ---- пробный период репетитора (Ф2.2) --------------------------------------------

/** Пробный репетитора — как отдаёт get_my_plan (миграция 0005). */
export interface TrialState extends PlanState {
  /** Пошёл ли отсчёт от первого ученика в приложении. */
  trial_started?: boolean
  /** Сколько дней пробный длится с первого ученика: 14, по рефералке 21. */
  trial_days?: number
}

/**
 * Что сказать в метке пробного: до первого ученика — «N дней с первого
 * ученика», если столько ещё влезает до потолка (решение владельца
 * 03.10.2026, журнал п.61); иначе — сколько календарных дней по Алматы
 * осталось (0 — сегодня последний). null — пробного нет: кончился или
 * оплачен тариф репетитора. Склоняет экран (`shared/lib/plural`).
 * Сам конец пробного считает база (`teacher_trial_end`), здесь — только показ.
 */
export type TrialStatus = { kind: 'before_first'; days: number } | { kind: 'left'; days: number }

const DAY_MS = 86400_000
const almatyDay = (t: number): number => Math.floor((t + ALMATY_OFFSET_MS) / DAY_MS)

export function teacherTrialStatus(s: TrialState, now: Date = new Date()): TrialStatus | null {
  const end = time(s.trial_until)
  const at = now.getTime()
  if (!(end > at)) return null
  if (s.plan.startsWith('teacher_') && time(s.plan_expires_at) > at) return null
  const days = s.trial_days ?? 14
  if (s.trial_started === false && end - at > days * DAY_MS) return { kind: 'before_first', days }
  return { kind: 'left', days: almatyDay(end) - almatyDay(at) }
}

// ---- конец доступа: напоминание и плашка (Ф2.4) ------------------------------------

/**
 * До какого момента у человека доступ и чем он держится — ПАРА к access_end
 * (миграция 0007), сверяет check-access-ending.mjs. Репетитору — тариф
 * репетитора или пробный, что позже (Premium расписание не открывает);
 * остальным — свой оплаченный тариф, пробный ученика не в счёт. null —
 * доступа нет и не было.
 */
export type AccessEnd = { source: 'plan'; plan: PaidPlan; until: Date } | { source: 'trial'; until: Date }

export function accessEnd(role: string | null | undefined, s: PlanState): AccessEnd | null {
  const teacher = role === 'teacher'
  const paid = (teacher ? s.plan.startsWith('teacher_') : s.plan !== 'free') ? time(s.plan_expires_at) : NaN
  const end = teacher ? Math.max(...[paid, time(s.trial_until)].filter(Number.isFinite)) : paid
  if (!Number.isFinite(end)) return null
  return end === paid ? { source: 'plan', plan: s.plan as PaidPlan, until: new Date(end) } : { source: 'trial', until: new Date(end) }
}

/** Что сказать на плашке «закончился» (макет t9-3). */
export interface AccessEndedNotice {
  source: AccessEnd['source']
  title: string
  body: string
  action: string
}

/**
 * Плашка, когда доступ был и кончился (журнал п.36): «Тариф закончился —
 * продлить», у пробного — «выбрать тариф». Раньше конца — ничего: тариф ещё
 * действует, и «закончился» было бы неправдой. Ученику, которого покрывает
 * тариф репетитора (`in_studio`), — ничего: свой тариф ему не нужен.
 */
export function accessEndedNotice(
  role: string | null | undefined,
  s: PlanState & { in_studio?: boolean },
  now: Date = new Date(),
): AccessEndedNotice | null {
  if (role !== 'teacher' && s.in_studio) return null
  const a = accessEnd(role, s)
  if (!a || a.until.getTime() > now.getTime()) return null
  // в другом году дата кончается на «г.» — вторая точка не нужна
  const day = dayLabel(a.until, now)
  return a.source === 'plan'
    ? {
        source: 'plan',
        title: 'Тариф закончился',
        body: `${planName(a.plan)} · до ${day}${day.endsWith('.') ? '' : '.'} Всё сохранено`,
        action: 'Продлить',
      }
    : { source: 'trial', title: 'Пробный период закончился', body: 'Всё сохранено', action: 'Выбрать тариф' }
}
