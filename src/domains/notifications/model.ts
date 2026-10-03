// ============================================================================
// Уведомления: форма и текст (архитектура §17). Без базы, из импортов —
// только общее склонение (с расширением .ts, чтобы его читал Node): файл
// проверяется чистым тестом (scripts/test-notifications.mjs), а позже
// его прочитает и сервер доставки (push — Ф2.9, Telegram — Ф4.3): текст у
// ленты и у каналов должен быть один.
//
// Правила пишут в базу не текст, а ДАННЫЕ (вид + data). Текст собирается
// здесь, по виду: поменять формулировку — выкатка клиента, а не миграция, и
// старые уведомления в ленте заговорят новыми словами.
// ============================================================================
import { plural } from '../../shared/lib/plural.ts'

/** Уведомление, как его отдаёт база (таблица notifications, только свои). */
export interface AppNotification {
  id: string
  kind: string
  data: Record<string, unknown>
  created_at: string
  read_at: string | null
}

/** Что показать человеку. href — только адрес внутри приложения. */
export interface NotificationView {
  title: string
  body?: string
  href?: string
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/**
 * Ссылка из данных — только внутренняя: «/progress», а не «//evil.site» и не
 * «javascript:…». Уведомление пишет сервер, но данные в нём могут прийти от
 * человека (имя ученика, текст учителя) — ссылка наружу из ленты была бы
 * готовым фишингом.
 */
export function safeHref(v: unknown): string | undefined {
  const s = text(v)
  return s && s.startsWith('/') && !s.startsWith('//') && !s.includes('\\') ? s : undefined
}

/** Дата из данных → «16 ноября» по Алматы (как месяцы тарифа в базе); мусор — undefined. */
function dayFromData(v: unknown): string | undefined {
  const s = text(v)
  const t = s ? Date.parse(s) : NaN
  return Number.isNaN(t)
    ? undefined
    : new Date(t).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'long' })
}

/** Подарок рефералки из данных: «1 месяц», «18 дней»; мусор — undefined. */
function giftLabel(months: unknown, days: unknown): string | undefined {
  const m = typeof months === 'number' && months > 0 ? months : 0
  const dd = typeof days === 'number' && days > 0 ? days : 0
  const parts = [
    m ? `${m} ${plural(m, 'месяц', 'месяца', 'месяцев')}` : '',
    dd ? `${dd} ${plural(dd, 'день', 'дня', 'дней')}` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' и ') : undefined
}

/**
 * Текст уведомления по виду. Виды появляются вместе с правилами (Ф2):
 *   manual — сообщение от Recall (владелец пишет вручную): title, body, href;
 *   payment_reported — владельцу: человек нажал «Оплата отправлена» (name);
 *   plan_paid — человеку: владелец подтвердил оплату, тариф до until (с
 *     подарками за коллег, если они ждали этой оплаты);
 *   referral_rewarded — пригласившему: подарок за коллегу (months, days,
 *     until) — PLAN.md Ф2.3;
 *   referral_paid — пригласившему: коллега оплатил, а своего тарифа нет —
 *     подарок ждёт его первой оплаты.
 * Неизвестный вид (правило новее клиента) — не пустая строка, а заголовок из
 * данных или нейтральное «Новое уведомление».
 */
export function renderNotification(n: Pick<AppNotification, 'kind' | 'data'>): NotificationView {
  const d = n.data ?? {}
  switch (n.kind) {
    case 'manual':
      return { title: text(d.title) ?? 'Сообщение от Recall', body: text(d.body), href: safeHref(d.href) }
    case 'payment_reported':
      return {
        title: 'Оплата отправлена',
        body: `${text(d.name) ?? 'Без имени'} — проверь перевод в Kaspi и подтверди в админке`,
        href: safeHref(d.href),
      }
    case 'plan_paid': {
      const until = dayFromData(d.until)
      return {
        title: 'Оплата получена',
        body: until ? `Тариф действует до ${until}` : 'Тариф включён',
        href: safeHref(d.href),
      }
    }
    case 'referral_rewarded': {
      const gift = giftLabel(d.months, d.days)
      const until = dayFromData(d.until)
      return {
        title: 'Подарок за коллегу',
        body: [gift ? `+${gift} к тарифу` : 'Тариф продлён', until && `теперь он действует до ${until}`].filter(Boolean).join(', '),
        href: safeHref(d.href),
      }
    }
    case 'referral_paid':
      return {
        title: 'По твоей ссылке оплатили тариф',
        body: 'Подарок добавим, когда оплатишь свой тариф',
        href: safeHref(d.href),
      }
    default:
      return { title: text(d.title) ?? 'Новое уведомление', body: text(d.body), href: safeHref(d.href) }
  }
}

/** Сколько непрочитанных в списке. */
export function unreadCount(list: Pick<AppNotification, 'read_at'>[]): number {
  return list.filter((n) => !n.read_at).length
}

/**
 * «Когда» для ленты: «только что», «5 мин назад», «3 ч назад», «вчера»,
 * дальше — дата. now — параметром, чтобы тест не зависел от часов.
 */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const t = new Date(iso)
  const diffMin = Math.floor((now.getTime() - t.getTime()) / 60000)
  if (Number.isNaN(diffMin)) return ''
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(t)) / 86400000)
  if (days === 0) return `${Math.floor(diffMin / 60)} ч назад`
  if (days === 1) return 'вчера'
  return t.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
