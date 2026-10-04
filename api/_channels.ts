// ============================================================================
// Каналы доставки уведомлений (архитектура §17): подключаются, как способы
// оплаты. Лента живёт в базе и каналом не считается — её видно всегда.
//
// Каналы: push (PLAN.md Ф2.9, _push.ts); Telegram — Ф4.3 (привязка через
// бота). Новый канал — объект с именем и deliver() в CHANNELS; сервер
// доставки (notify.ts) зовёт каждый для каждого уведомления.
//
// ⚠️ Всё нужное для доставки (кому, что, куда) приходит в теле запроса от
// базы: своего доступа к базе у сервера нет (CLAUDE.md, безопасность, п.3).
// ============================================================================
import { pushChannel, pushConfig } from './_push.js'

/** Устройство, где человек включил уведомления (push_subscriptions, 0011). */
export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

/** Уведомление, как его отдаёт база (dispatch_payload). */
export interface OutgoingNotification {
  id: string
  user_id: string
  kind: string
  data: Record<string, unknown>
  created_at: string
  /** Подписки человека — только у видов для push (push_kinds); иначе пусто. */
  push?: PushTarget[]
}

/** sent — ушло; skipped — канал этому человеку не подключён; failed — сбой. */
export type Delivery = 'sent' | 'skipped' | 'failed'

/**
 * Итог канала по одному уведомлению. gone — подписки, которых больше нет
 * (база их удалит); retry — вернуть ли уведомление в очередь при failed
 * (по умолчанию да: сбой временный; false — повтор не поможет).
 */
export interface DeliveryResult {
  outcome: Delivery
  gone?: string[]
  retry?: boolean
}

export interface Channel {
  name: string
  deliver(n: OutgoingNotification): Promise<Delivery | DeliveryResult>
}

export const CHANNELS: Channel[] = [pushChannel(() => pushConfig())]
