// ============================================================================
// Бесплатный «Пересоставить план» материала (PLAN.md Ф2.17-4в-2б, миграция
// 0014, журнал п.76 (7)). Файл с «_» — Vercel НЕ делает из него функцию.
//
//   grantReplans    после ОПЛАЧЕННОГО плана (задача material_plan) — право на
//                   3 бесплатных повтора; по номеру списания, который сервер
//                   сам выдал и клиенту не отдаёт, поэтому без оплаты право не
//                   завести (grant_material_replans);
//   authorizeReplan повтор (задача material_replan): тратит одно право вместо
//                   генерации (spend_replan). Номер списания — свой, на сервере:
//                   сбой AI возвращает повтор тем же refund_ai_call.
// ============================================================================
import { randomUUID } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { DENIED, UNAVAILABLE, refusalFor, userRpc, type AuthDenied } from './_auth.js'
import { TIMEOUTS } from './_timeouts.js'

/** Сколько бесплатных повторов даёт один оплаченный план — то же число в spend_replan (0014). */
export const REPLANS_PER_PLAN = 3

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Права нет или повторы кончились: клиент предложит план за генерацию (код — ему). */
const NO_REPLANS: AuthDenied = {
  ok: false,
  status: 409,
  code: 'RECALL_REPLAN_LIMIT',
  error: 'Бесплатные пересоставления этого плана закончились — следующее спишет 1 генерацию.',
}

export type ReplanAuth = { ok: true; refundToken: string; left: number } | AuthDenied

export async function authorizeReplan(req: VercelRequest, replanId: unknown, supabaseMs = TIMEOUTS.supabaseMs): Promise<ReplanAuth> {
  if (typeof replanId !== 'string' || !UUID.test(replanId)) return NO_REPLANS
  const nonce = randomUUID()
  const call = userRpc(req, 'spend_replan', { p_replan: replanId, p_nonce: nonce }, supabaseMs)
  if (!call) return DENIED
  let r
  try {
    r = await call
  } catch {
    // как в authorize: строка могла записаться, а ответ не дойти — возврат по номеру
    await userRpc(req, 'refund_ai_call', { p_nonce: nonce }, supabaseMs)?.catch(() => {})
    return UNAVAILABLE
  }
  if (r.ok) {
    const left = Number(r.text)
    return { ok: true, refundToken: nonce, left: Number.isFinite(left) ? left : 0 }
  }
  if (r.status === 401 || r.status === 403 || r.text.includes('RECALL_NO_AUTH')) return DENIED
  if (r.text.includes('RECALL_REPLAN_LIMIT') || r.text.includes('RECALL_REPLAN_NONE')) return NO_REPLANS
  const refusal = refusalFor(r.text)
  if (refusal) return refusal
  // функции нет (миграция 0014 не залита) или она упала — AI закрыт, как в authorize
  console.error(`spend_replan ответила ${r.status} — повтор закрыт:`, r.text.slice(0, 300))
  return UNAVAILABLE
}

/** Право на повторы за оплаченный план; null — не вышло (тогда повторы платные, а ответ всё равно отдаём). */
export async function grantReplans(req: VercelRequest, nonce: string, supabaseMs = TIMEOUTS.supabaseMs): Promise<string | null> {
  try {
    const r = await userRpc(req, 'grant_material_replans', { p_nonce: nonce }, supabaseMs)
    if (!r?.ok) return null
    const id: unknown = JSON.parse(r.text)
    return typeof id === 'string' && UUID.test(id) ? id : null
  } catch {
    return null
  }
}
