// ============================================================================
// Рефералка «репетитор приводит репетитора» (PLAN.md Ф2.3; журнал п.16, 62):
// ссылка, текст приглашения, правило подарка для показа, подписи счётчика.
// Чистый: импорт только общего склонения (с расширением .ts — так его
// читает Node), проверяет scripts/test-referral.mjs.
//
// Начисляет база (миграция 0006: become_teacher с кодом, крючок
// confirm_payment). Здесь только то, что видит человек; копию правила
// подарка с базой сверяет check-referral.mjs.
// ============================================================================
import { plural } from '../../shared/lib/plural.ts'
import type { PaidPlan } from './model'

/** Сколько дней пробного добавляется приглашённому (0006, attach_referral). */
export const REFERRAL_BONUS_DAYS = 7

/** Формат личного кода (0004, personal_codes): буквы имени и цифры 2–9. */
const CODE_RE = /^[A-Z]{2,8}[2-9]{1,4}$/

/** Код из ссылки → как он лежит в базе; мусор — null. */
export function parseRefCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase()
  return CODE_RE.test(code) ? code : null
}

/** Ссылка-приглашение: регистрация сразу репетитором (механизм pendingRole). */
export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/login?role=teacher&ref=${encodeURIComponent(code)}`
}

/**
 * Текст приглашения без ссылки. Ссылка идёт отдельно: Telegram и системное
 * «Поделиться» приклеивают её сами, и в тексте она бы повторилась.
 * ⚠️ Только то, что в Recall уже есть: появится расписание (PLAN.md Ф2.7) —
 * его можно назвать здесь.
 */
export const INVITE_TEXT =
  'Привет! Я веду учеников в Recall: задаю там домашку, а упражнения он проверяет сам. ' +
  'По моей ссылке пробный период у тебя будет на неделю дольше:'

/** Сообщение целиком — так его увидит коллега (и так оно уходит в WhatsApp). */
export function inviteMessage(link: string): string {
  return `${INVITE_TEXT} ${link}`
}

// ---- подарок пригласившему ----------------------------------------------------------

/** Тарифы репетитора — из каталога (`TEACHER_PLANS`). */
export type TeacherPlanId = Exclude<PaidPlan, 'premium'>

export interface Reward {
  months: number
  days: number
}

/**
 * Подарок за одного коллегу (копия referral_reward из 0006): месяц твоего
 * тарифа, если коллега оплатил тариф не дешевле; иначе дни на сумму его
 * месяца, вниз до целого — не дороже его оплаты. Цены — параметром из каталога:
 * так правило не тянет за собой весь model.ts.
 */
export function referralReward(refereePrice: number, referrerPrice: number): Reward {
  if (refereePrice >= referrerPrice) return { months: 1, days: 0 }
  return { months: 0, days: Math.floor((30 * refereePrice) / referrerPrice) }
}

/** «1 месяц», «18 дней», «2 месяца и 18 дней», «0» — для счётчика и уведомлений. */
export function rewardLabel(r: Reward): string {
  const parts: string[] = []
  if (r.months > 0) parts.push(`${r.months} ${plural(r.months, 'месяц', 'месяца', 'месяцев')}`)
  if (r.days > 0) parts.push(`${r.days} ${plural(r.days, 'день', 'дня', 'дней')}`)
  return parts.length ? parts.join(' и ') : '0'
}

/** Короткая запись для плитки счётчика: «1 мес», «18 дн», «1 мес 18 дн», «0». */
export function rewardShort(r: Reward): string {
  const parts: string[] = []
  if (r.months > 0) parts.push(`${r.months} мес`)
  if (r.days > 0) parts.push(`${r.days} дн`)
  return parts.length ? parts.join(' ') : '0'
}

/**
 * Сноска к «Тебе — +1 месяц» для твоего тарифа: за каких коллег подарок —
 * дни, а не месяц. Mini — самый дешёвый тариф репетитора: у него всегда
 * месяц, сноски нет. prices — цены тарифов репетитора из каталога.
 */
export function cheaperNote(mine: TeacherPlanId | null, prices: Record<TeacherPlanId, number>, titles: Record<TeacherPlanId, string>): string | null {
  if (!mine) return 'Если коллега выберет тариф дешевле твоего, получишь дни на ту же сумму.'
  const cheaper = (Object.keys(prices) as TeacherPlanId[])
    .filter((p) => prices[p] < prices[mine])
    .sort((a, b) => prices[a] - prices[b])
  if (cheaper.length === 0) return null
  const list = cheaper
    .map((p) => `за ${titles[p]} — ${rewardLabel(referralReward(prices[p], prices[mine]))}`)
    .join(', ')
  return `Если коллега выберет тариф дешевле твоего, получишь дни на ту же сумму: ${list}.`
}

// ---- счётчик -------------------------------------------------------------------------

/** Что отдаёт база экрану «Пригласи коллегу» (get_my_referral). */
export interface ReferralStats {
  code: string
  /** Пришли по ссылке. */
  invited: number
  /** Оплатили первый месяц (подарок начислен или ждёт). */
  paid: number
  /** Оплатили, а подарок ждёт твоей первой оплаты тарифа. */
  pending: number
  /** Получено подарком: месяцы и дни отдельно (месяц — календарный). */
  reward: Reward
}
