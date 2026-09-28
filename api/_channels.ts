// ============================================================================
// Каналы доставки уведомлений (архитектура §17): подключаются, как способы
// оплаты. Лента живёт в базе и каналом не считается — её видно всегда.
//
// Сейчас каналов нет: push — PLAN.md Ф2.9 (подписки, VAPID), Telegram — Ф4.3
// (привязка через бота). Новый канал — объект с именем и deliver() в CHANNELS;
// сервер доставки (notify.ts) зовёт каждый для каждого уведомления.
//
// ⚠️ Всё нужное для доставки (кому, что, куда) приходит в теле запроса от
// базы: своего доступа к базе у сервера нет (CLAUDE.md, безопасность, п.3).
// ============================================================================

/** Уведомление, как его отдаёт база (dispatch_notifications). */
export interface OutgoingNotification {
  id: string
  user_id: string
  kind: string
  data: Record<string, unknown>
  created_at: string
}

/** sent — ушло; skipped — канал этому человеку не подключён; failed — сбой. */
export type Delivery = 'sent' | 'skipped' | 'failed'

export interface Channel {
  name: string
  deliver(n: OutgoingNotification): Promise<Delivery>
}

export const CHANNELS: Channel[] = []
