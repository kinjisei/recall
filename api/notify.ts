// ============================================================================
// Сервер доставки уведомлений (PLAN.md Ф1.5; архитектура §17, §15 п.5).
//
// Будит его БАЗА, а не человек: pg_cron → run_notification_rules() →
// dispatch_notifications() → pg_net POST сюда. Это осознанное исключение из
// правила «сервер ходит в базу под токеном пользователя» — поэтому вход здесь
// один: секрет.
//   • NOTIFY_SECRET в переменных Vercel и такой же notify_secret в Vault базы;
//   • секрета нет в окружении — отказ всем (503): неверная настройка не должна
//     превращаться в открытую дверь;
//   • секрет сверяется за постоянное время (timingSafeEqual по хэшам) — по
//     скорости ответа его не подобрать.
//
// Сам сервер в базу не ходит: всё для доставки — в теле запроса. Каналы —
// _channels.ts (push — Ф2.9). В ответе базе — gone (подписки, которых больше
// нет) и retry (что не дошло по временному сбою); их разбирает база при
// следующей отправке (settle_dispatches, миграция 0011).
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, timingSafeEqual } from 'node:crypto'
import { CHANNELS, type Channel, type Delivery, type DeliveryResult, type OutgoingNotification, type PushTarget } from './_channels.js'

export const config = { maxDuration: 60 }

/** Больше за раз база не отдаёт (dispatch_notifications, limit 100). */
const MAX_BATCH = 100
/** Сколько уведомлений канал доставляет одновременно: 100 по очереди не уложились бы в минуту. */
const PARALLEL = 10

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handle(req, res)
}

const digest = (s: string) => createHash('sha256').update(s).digest()

/** Совпадает ли секрет из заголовка с настроенным — за постоянное время. */
export function secretMatches(header: string | undefined, secret: string): boolean {
  const given = /^Bearer (.+)$/.exec(header ?? '')?.[1] ?? ''
  // хэши одинаковой длины: timingSafeEqual не бросает и не выдаёт длину секрета
  return given.length > 0 && timingSafeEqual(digest(given), digest(secret))
}

const isTarget = (t: unknown): t is PushTarget => {
  const x = t as Partial<PushTarget> | null
  return !!x && typeof x.endpoint === 'string' && typeof x.p256dh === 'string' && typeof x.auth === 'string'
}

function isNotification(x: unknown): x is OutgoingNotification {
  const n = x as Partial<OutgoingNotification> | null
  return (
    !!n &&
    typeof n.id === 'string' &&
    typeof n.user_id === 'string' &&
    typeof n.kind === 'string' &&
    typeof n.created_at === 'string' &&
    typeof n.data === 'object' &&
    n.data !== null &&
    !Array.isArray(n.data) &&
    (n.push === undefined || (Array.isArray(n.push) && n.push.every(isTarget)))
  )
}

const asResult = (r: Delivery | DeliveryResult): DeliveryResult => (typeof r === 'string' ? { outcome: r } : r)

/** Каждому элементу — fn, не больше limit одновременно; порядок результатов — как у list. */
async function pool<T, R>(list: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length)
  let next = 0
  const worker = async () => {
    while (next < list.length) {
      const i = next++
      out[i] = await fn(list[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker))
  return out
}

/** Сам обработчик; каналы — параметром, чтобы тест подставил свои. */
export async function handle(req: VercelRequest, res: VercelResponse, channels: Channel[] = CHANNELS) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })

  const secret = process.env.NOTIFY_SECRET
  if (!secret) return res.status(503).json({ error: 'Доставка уведомлений не настроена' })
  const auth = req.headers.authorization
  if (!secretMatches(Array.isArray(auth) ? auth[0] : auth, secret)) {
    return res.status(401).json({ error: 'Нет доступа' })
  }

  const list = (req.body as { notifications?: unknown } | null)?.notifications
  if (!Array.isArray(list) || list.length > MAX_BATCH || !list.every(isNotification)) {
    return res.status(400).json({ error: 'Неверный формат' })
  }

  const results: Record<string, Record<Delivery, number>> = {}
  const gone = new Set<string>()
  const retry = new Set<string>()
  for (const ch of channels) {
    const tally = (results[ch.name] = { sent: 0, skipped: 0, failed: 0 })
    const done = await pool(list, PARALLEL, (n) =>
      // один сбойный канал или человек не мешает остальным (и синхронный
      // throw тоже — поэтому через then)
      Promise.resolve()
        .then(() => ch.deliver(n))
        .then(asResult, (): DeliveryResult => ({ outcome: 'failed' })),
    )
    done.forEach((r, i) => {
      tally[r.outcome]++
      for (const e of r.gone ?? []) gone.add(e)
      if (r.outcome === 'failed' && r.retry !== false) retry.add(list[i].id)
    })
  }
  return res.status(200).json({ ok: true, received: list.length, results, gone: [...gone], retry: [...retry] })
}
