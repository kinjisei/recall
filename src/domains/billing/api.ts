// ============================================================================
// Оплата — единственное место, где домен ходит в базу (архитектура §2, §4).
// Таблицы оплат, заявок, личных кодов и приглашений закрыты для чтения и
// записи всем; всё — через RPC миграций 0004 (оплата) и 0006 (рефералка).
// Права проверяет база: admin_* и confirm_payment отказывают не-владельцу.
// ============================================================================
import { supabase } from '../../shared/api/supabase'
import { dbError } from '../../shared/api/errors'
import type { PaidPlan, PayMethod, PlanState } from './model'
import type { ReferralStats } from './referral'

/** Заявка «Оплата отправлена», ещё не подтверждённая владельцем. */
export interface PaymentClaim {
  id: string
  plan: string
  months: number
  created_at: string
}

/** Всё для экрана «Как оплатить». */
export interface PayInfo extends PlanState {
  /** Личный код для сообщения к переводу («MADINA7»). */
  code: string
  role: string | null
  claim: PaymentClaim | null
}

export async function loadPayInfo(): Promise<PayInfo> {
  const { data, error } = await supabase.rpc('get_pay_info')
  if (error) throw dbError(error, 'загрузить данные для оплаты')
  const r = data?.[0]
  if (!r) throw new Error('Не удалось загрузить данные для оплаты — обнови страницу.')
  return {
    code: r.code,
    role: r.role ?? null,
    plan: r.plan,
    plan_expires_at: r.plan_expires_at ?? null,
    trial_until: r.trial_until ?? null,
    // заявки нет — колонки заявки пустые (left join)
    claim: r.claim_id
      ? { id: r.claim_id, plan: r.claim_plan, months: r.claim_months, created_at: r.claim_created_at }
      : null,
  }
}

/** «Оплата отправлена»: открытая заявка у человека одна, повтор её обновляет. */
export async function reportPaymentSent(plan: PaidPlan, months = 1): Promise<PaymentClaim> {
  const { data, error } = await supabase.rpc('report_payment_sent', { p_plan: plan, p_months: months })
  if (error) throw dbError(error, 'отправить заявку')
  const r = data?.[0]
  if (!r) throw new Error('Заявка не дошла — попробуй ещё раз.')
  return r
}

// ---- владельцу ------------------------------------------------------------------

/** Заявка в списке «Ждут подтверждения» — с тем, что у человека сейчас. */
export interface ClaimRow extends PlanState {
  id: string
  user_id: string
  claim_plan: string
  months: number
  created_at: string
  email: string
  display_name: string | null
  code: string | null
  role: string | null
  students: number
}

export async function loadPaymentClaims(): Promise<ClaimRow[]> {
  const { data, error } = await supabase.rpc('admin_payment_claims')
  if (error) throw dbError(error, 'загрузить заявки на оплату')
  return (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    claim_plan: r.claim_plan,
    months: r.months,
    created_at: r.created_at,
    email: r.email,
    display_name: r.display_name ?? null,
    code: r.code ?? null,
    role: r.role ?? null,
    plan: r.plan,
    plan_expires_at: r.plan_expires_at ?? null,
    trial_until: r.trial_until ?? null,
    students: r.students ?? 0,
  }))
}

export interface ConfirmInput {
  userId: string
  plan: PaidPlan
  months: number
  /** Сколько пришло на счёт, ₸. */
  amount: number
  method: PayMethod
  note?: string
  /** Какую заявку закрывает (если подтверждаем из списка). */
  claimId?: string
  /**
   * Номер нажатия: повтор с тем же номером (ответ потерялся в сети) не
   * продлевает тариф второй раз — база вернёт первую оплату.
   */
  requestId: string
}

export interface ConfirmResult {
  id: string
  plan: string
  starts_at: string
  ends_at: string
  /** Это повтор уже подтверждённого нажатия. */
  repeated: boolean
}

export async function confirmPayment(input: ConfirmInput): Promise<ConfirmResult> {
  const { data, error } = await supabase.rpc('confirm_payment', {
    p_user: input.userId,
    p_plan: input.plan,
    p_months: input.months,
    p_amount: input.amount,
    p_method: input.method,
    p_note: input.note?.trim() || undefined,
    p_claim: input.claimId,
    p_request: input.requestId,
  })
  if (error) throw dbError(error, 'подтвердить оплату')
  const r = data?.[0]
  if (!r) throw new Error('Ответ пришёл пустым — обнови список оплат.')
  return r
}

/** Деньги не пришли — убрать заявку из списка. */
export async function dismissPaymentClaim(claimId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_dismiss_payment_claim', { p_claim: claimId })
  if (error) throw dbError(error, 'убрать заявку')
}

export interface PaymentRow {
  id: string
  user_id: string | null
  email: string | null
  display_name: string | null
  plan: string
  months: number
  amount: number
  method: string
  note: string | null
  starts_at: string
  ends_at: string
  confirmed_at: string
}

export async function loadRecentPayments(limit = 20): Promise<PaymentRow[]> {
  const { data, error } = await supabase.rpc('admin_recent_payments', { p_limit: limit })
  if (error) throw dbError(error, 'загрузить оплаты')
  return (data ?? []).map((r) => ({
    ...r,
    user_id: r.user_id ?? null,
    email: r.email ?? null,
    display_name: r.display_name ?? null,
    note: r.note ?? null,
  }))
}

// ---- рефералка (PLAN.md Ф2.3, миграция 0006) ----------------------------------------

/** Экрану «Пригласи коллегу»: свой код и честный счётчик. Только репетитору. */
export async function loadMyReferral(): Promise<ReferralStats> {
  const { data, error } = await supabase.rpc('get_my_referral')
  if (error) throw dbError(error, 'загрузить приглашения')
  const r = data?.[0]
  if (!r) throw new Error('Не удалось загрузить приглашения — обнови страницу.')
  return {
    code: r.code,
    invited: r.invited,
    paid: r.paid,
    pending: r.pending,
    reward: { months: r.reward_months, days: r.reward_days },
  }
}

/**
 * Показать ли разовую подсветку подарка (после первой оплаты тарифа). Сбой —
 * просто «нет»: подсветка — приятное, а не нужное, и ломать шапку ей нельзя.
 */
export async function loadReferralHint(): Promise<boolean> {
  const { data, error } = await supabase.rpc('referral_hint')
  return !error && data === true
}

/** Подсветку закрыли или нажали подарок — больше не показывать нигде. */
export async function dismissReferralHint(): Promise<void> {
  const { error } = await supabase.rpc('dismiss_referral_hint')
  if (error) throw dbError(error, 'закрыть подсказку')
}
