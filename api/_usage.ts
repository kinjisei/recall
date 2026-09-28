// ============================================================================
// Журнал вызовов AI (таблица ai_call_log, PLAN.md Ф1.6): какая модель
// ответила, сколько ждали, кто отказал по дороге. Файл с «_» — Vercel НЕ
// делает из него функцию.
//
// Попытки копит сам вызов моделей (_core, _groq, _stt пишут в trace), итог
// ставит обработчик (gemini.ts, transcribe.ts) через finish().
//
// ⚠️ Итог пишется ДО ответа человеку, а не после. После ответа Vercel вправе
// заморозить функцию, и строки журнала терялись бы молча — счёт по моделям
// врал бы в меньшую сторону ровно тогда, когда нагрузка растёт. Удачный
// вызов ждёт записи не дольше logMs (api/_timeouts.ts).
// ⚠️ Ответа нет — итог и возврат энергии идут ОДНИМ запросом (log_ai_call с
// p_refund): после работы у функции остаётся время ровно на один запрос в
// базу (workDeadline). Журнал не принял запись — возврат отдельно: энергия
// человека важнее строки журнала.
// ============================================================================
import type { VercelRequest } from '@vercel/node'
import { TimeoutError, windowUntil } from './_timeouts.js'
import { refundAiCall, userRpc } from './_auth.js'

/** Одна попытка одной модели. */
export interface Attempt {
  model: string
  /** 'ok' | код отказа ('429', '503'…) | 'timeout' | 'network' | 'empty' | 'cut' */
  status: string
  /** Сколько длилась попытка, мс. */
  ms: number
  /** Поток: через сколько пришли первые слова, мс. */
  first?: number
}

/** Итог вызова: ответ доставлен / ответа нет / поток оборвался на середине. */
export type CallOutcome = 'ok' | 'failed' | 'cut'

/** Засечь попытку: в начале — track(trace, модель), в конце — вызвать с итогом. */
export function track(trace: Attempt[] | undefined, model: string) {
  const t0 = Date.now()
  return (status: string, first?: number) => {
    trace?.push({ model, status, ms: Date.now() - t0, ...(first === undefined ? {} : { first }) })
  }
}

/** Итог попытки, которая не дождалась ответа: срок вышел или связь оборвалась. */
export const failStatus = (e: unknown) => (e instanceof TimeoutError ? 'timeout' : 'network')

export interface CallLog {
  /** Попытки по порядку — их пишут callGemini, streamGemini, groqChat, Whisper. */
  trace: Attempt[]
  /** Итог — в журнал; без ответа — вместе с возвратом энергии. Повторный вызов ничего не делает. */
  finish(outcome: CallOutcome): Promise<void>
}

export interface CallInfo {
  /** Номер списания из authorize(). */
  token: string
  task: string
  tier: string | null
  /** Окно записи итога удачного вызова, мс. */
  logMs: number
  /** Окно запроса в Supabase, мс (итог вместе с возвратом). */
  supabaseMs: number
  /** Отметка Date.now(), до которой возврат ещё успевает до обрыва функции. */
  refundBy: number
}

export function startCall(req: VercelRequest, call: CallInfo): CallLog {
  const startedAt = Date.now()
  const trace: Attempt[] = []
  let done = false

  const refundAlone = async () => {
    const left = windowUntil(call.refundBy, call.supabaseMs)
    if (left > 0) await refundAiCall(req, call.token, left)
  }

  return {
    trace,
    async finish(outcome) {
      if (done) return
      done = true
      const refund = outcome !== 'ok'
      // ответила та модель, чьи слова дошли до человека (целиком или обрывком)
      const spoke = [...trace].reverse().find((a) => a.status === 'ok' || a.status === 'cut')
      const args = {
        p_nonce: call.token,
        p_task: call.task,
        p_tier: call.tier,
        p_model: outcome === 'failed' ? null : (spoke?.model ?? null),
        p_status: outcome,
        p_latency_ms: Date.now() - startedAt,
        p_attempts: trace,
        p_refund: refund,
      }
      const ms = refund ? windowUntil(call.refundBy, call.supabaseMs) : call.logMs
      try {
        const reply = await userRpc(req, 'log_ai_call', args, ms)
        if (!reply?.ok) console.error('журнал AI не принял запись:', reply?.status, reply?.text.slice(0, 200))
        if (!reply?.ok && refund) await refundAlone()
      } catch {
        // Не ответил вовремя. Возврат мог и пройти — повтор тогда ничего не
        // найдёт; а мог не дойти до базы — тогда повтор его и сделает.
        console.warn('журнал AI не ответил вовремя')
        if (refund) await refundAlone()
      }
    },
  }
}
