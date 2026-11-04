// ============================================================================
// Замена упражнения через AI: «↻ Заменить» и «+ Упражнение → Составит AI»
// (PLAN.md Ф2.25-4, миграция 0019, журнал п.76 (8), (22), (24)). Файл с «_» —
// Vercel НЕ делает из него отдельную функцию.
//
// Генерацию материала замена не тратит, но лимит у неё есть — 25 в сутки на
// учителя, из них на сильной ступени до 5; сутки — календарный день по
// Алматы. Считает база (spend_exercise_swap): строка в ai_calls без энергии
// и генерации, возврат при сбое модели — тем же refund_ai_call.
//
// Две ступени, потому что у Pro бесплатной квоты нет (журнал п.76 (24)):
// лёгкая — для видов, где лёгкая модель в замере не хуже; сильная — Flash,
// для видов, где лёгкая ошибалась (scripts/ai-quality/criteria.md, «Замена
// упражнения»). После платного Gemini сильная ступень — Pro одной строкой
// в SWAP_CHAINS. Groq у замены нет: его на упражнениях не мерили.
// ============================================================================
import { randomUUID } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { DENIED, UNAVAILABLE, refusalFor, userRpc, type AuthDenied } from './_auth.js'
import { TIMEOUTS } from './_timeouts.js'

/** Замен в сутки на учителя и из них на сильной ступени — те же числа в spend_exercise_swap (0019). */
export const SWAPS_PER_DAY = 25
export const STRONG_PER_DAY = 5

/**
 * Виды каталога (`src/lib/exerciseFormats` FORMATS) — копией: каталог тянет
 * клиентские импорты без `.js`, на Vercel он не соберётся (api/CLAUDE.md).
 * Совпадение держит test-exercise-swap.
 */
export const SWAP_FORMATS = ['mcq', 'tfng', 'match_translation', 'match_definition', 'word_by_definition', 'fill_word', 'fill_form', 'order', 'form'] as const
export type SwapFormat = (typeof SWAP_FORMATS)[number]

/** Модели ступеней — ЕДИНСТВЕННОЕ место. Лёгкая: 500 запросов в сутки на проект; сильная: Flash, первой — запасная модель Диалога, чтобы его первая осталась ученикам. */
export const SWAP_CHAINS: Record<'light' | 'strong', readonly string[]> = {
  light: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  strong: ['gemini-3.5-flash', 'gemini-3.6-flash'],
}

/** На сильной ступени — виды, где лёгкая модель в замере ошибалась: каверзные True / False и «Собери предложение». */
export function isStrongSwap(format: SwapFormat, tricky: boolean): boolean {
  return (format === 'tfng' && tricky) || format === 'order'
}

export interface SwapRequest {
  format: SwapFormat
  tricky: boolean
}

/** Что прислал клиент в `swap`: вид из каталога и «каверзные»; иначе null — 400 до списания. */
export function swapRequest(raw: unknown): SwapRequest | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { format, tricky } = raw as { format?: unknown; tricky?: unknown }
  if (typeof format !== 'string' || !(SWAP_FORMATS as readonly string[]).includes(format)) return null
  if (tricky !== undefined && typeof tricky !== 'boolean') return null
  return { format: format as SwapFormat, tricky: tricky === true }
}

/** Сколько замен осталось сегодня — в ответе сервера и в счётчике экрана (d17-1, d17-3в). */
export interface SwapCounters {
  left: number
  strongLeft: number
}

const SWAP_REFUSALS: [code: string, status: number, error: string][] = [
  ['RECALL_SWAP_STRONG_LIMIT', 409, 'Сложные замены (каверзные True / False и «Собери предложение») на сегодня закончились — снова завтра с 00:00. Остальные виды ещё можно заменить.'],
  ['RECALL_SWAP_LIMIT', 409, 'Замены через AI на сегодня закончились — снова завтра с 00:00. Поправить упражнение руками можно и сейчас.'],
  ['RECALL_PLAN_REQUIRED', 403, 'Тариф закончился — замена через AI вернётся с тарифом. Поправить упражнение руками можно и сейчас.'],
  ['RECALL_NOT_TEACHER', 403, 'Эта функция доступна только преподавателю.'],
]

export type SwapAuth = ({ ok: true; refundToken: string } & SwapCounters) | AuthDenied

/** Списать одну замену (spend_exercise_swap). Номер списания — свой, на сервере: сбой модели возвращает замену тем же refund_ai_call. */
export async function authorizeSwap(req: VercelRequest, strong: boolean, supabaseMs = TIMEOUTS.supabaseMs): Promise<SwapAuth> {
  const nonce = randomUUID()
  const call = userRpc(req, 'spend_exercise_swap', { p_nonce: nonce, p_strong: strong }, supabaseMs)
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
    const counters = readCounters(r.text)
    return { ok: true, refundToken: nonce, ...counters }
  }
  if (r.status === 401 || r.text.includes('RECALL_NO_AUTH')) return DENIED
  const own = SWAP_REFUSALS.find(([code]) => r.text.includes(code))
  if (own) return { ok: false, status: own[1], error: own[2], code: own[0] }
  const refusal = refusalFor(r.text)
  if (refusal) return refusal
  // функции нет (миграция 0019 не залита) или она упала — AI закрыт, как в authorize
  console.error(`spend_exercise_swap ответила ${r.status} — замена закрыта:`, r.text.slice(0, 300))
  return UNAVAILABLE
}

/** Ответ функции-таблицы: [{ swaps_left, strong_left }]; непонятное — нули (экран скажет «кончились», а не соврёт про запас). */
function readCounters(text: string): SwapCounters {
  try {
    const rows: unknown = JSON.parse(text)
    const row = (Array.isArray(rows) ? rows[0] : rows) as { swaps_left?: unknown; strong_left?: unknown } | undefined
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0)
    return { left: n(row?.swaps_left), strongLeft: n(row?.strong_left) }
  } catch {
    return { left: 0, strongLeft: 0 }
  }
}
