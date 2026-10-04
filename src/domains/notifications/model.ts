// ============================================================================
// Уведомления: форма и текст (архитектура §17). Без базы: файл читает и
// клиент, и сервер доставки (api/_push.ts — push, позже Telegram, Ф4.3) —
// текст у ленты и у каналов один. Импорты — с расширением .js: так их
// собирает Vercel (Node ESM); чистый тест подключает _api-loader.mjs.
//
// Правила пишут в базу не текст, а ДАННЫЕ (вид + data). Текст собирается
// здесь, по виду: поменять формулировку — выкатка клиента, а не миграция, и
// старые уведомления в ленте заговорят новыми словами.
// ============================================================================
import { plural } from '../../shared/lib/plural.js'
import { lessonWhen, renderLessonNotice } from './lessonText.js'

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
  /** Подпись кнопки-действия («Как оплатить», макет t9-2) — только вместе с href. */
  action?: string
}

/**
 * Имена тарифов внутри фразы — копия `planName` из domains/billing: этот файл
 * читают чистый тест и сервер доставки, а дверь billing тянет клиент базы.
 * Расхождение с каталогом ловит test-notifications.
 */
export const PLAN_NAMES: Record<string, string> = {
  premium: 'Premium',
  teacher_mini: 'Репетитор Mini',
  teacher_start: 'Репетитор Start',
  teacher_pro: 'Репетитор Pro',
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

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
 *     подарок ждёт его первой оплаты;
 *   plan_ending / trial_ending — тариф (plan, until) или пробный (until)
 *     кончается завтра — одно на дату окончания, PLAN.md Ф2.4;
 *   lessons_low — учителю: у ученика (card, name) остаток стал 1 или меньше
 *     (left), следующий урок next — одно на цикл оплаты, PLAN.md Ф2.8;
 *   teacher_message — ученику: сообщение учителя (teacher_name, text) по его
 *     нажатию «Напомнить → В приложении»;
 *   lesson_soon, lesson_moved, lesson_cancelled, lesson_restored,
 *     lessons_rescheduled, lessons_cancelled — ученику об уроке и его
 *     изменении, PLAN.md Ф2.9 (тексты — lessonText.ts; «через сколько» у
 *     lesson_soon считается от created_at).
 * Неизвестный вид (правило новее клиента) — не пустая строка, а заголовок из
 * данных или нейтральное «Новое уведомление».
 */
export function renderNotification(
  n: Pick<AppNotification, 'kind' | 'data'> & { created_at?: string },
): NotificationView {
  const d = n.data ?? {}
  const lesson = renderLessonNotice(n.kind, d, n.created_at, safeHref(d.href))
  if (lesson) return lesson
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
    case 'plan_ending':
    case 'trial_ending': {
      const until = dayFromData(d.until)
      const plan = typeof d.plan === 'string' && Object.prototype.hasOwnProperty.call(PLAN_NAMES, d.plan) ? PLAN_NAMES[d.plan] : undefined
      const href = safeHref(d.href)
      const trial = n.kind === 'trial_ending'
      return {
        title: trial ? 'Пробный период закончится завтра' : 'Тариф закончится завтра',
        body: until && `${trial ? 'Действует' : `${plan ?? 'Тариф'} действует`} до ${until}`,
        href,
        action: href && (trial ? 'Выбрать тариф' : 'Как оплатить'),
      }
    }
    case 'lessons_low': {
      // учителю: остаток стал 1 или меньше — одно на цикл оплаты (Ф2.8, п.67).
      // Имя — без падежей: «Тимур Ким: остался 1 оплаченный урок»
      const left = typeof d.left === 'number' ? d.left : 1
      const next = lessonWhen(d.next)
      const card = text(d.card)
      const href = card && UUID.test(card) ? `/teacher?student=${card}&remind=1` : undefined
      return {
        title: `${text(d.name) ?? 'Ученик'}: ${left <= 0 ? 'оплаченные уроки закончились' : 'остался 1 оплаченный урок'}`,
        body: next ? `Следующий — ${next}` : undefined,
        href,
        action: href && 'Напомнить',
      }
    }
    case 'teacher_message':
      // ученику: учитель сам нажал «Напомнить → В приложении» (t7-3). Об
      // оплате Recall ученику сам не пишет никогда (п.29) — это его учитель
      return { title: `${text(d.teacher_name) ?? 'Преподаватель'} пишет`, body: text(d.text) }
    default:
      return { title: text(d.title) ?? 'Новое уведомление', body: text(d.body), href: safeHref(d.href) }
  }
}

// ---- push (PLAN.md Ф2.9) ------------------------------------------------------------

/**
 * Какие виды уходят в push. Копия push_kinds() из миграции 0011 — пару
 * сверяет test-notifications.mjs. Ученику — только об уроках: экран
 * разрешения обещает «Больше ничего присылать не будем» (макет u3-3).
 */
export const PUSH_KINDS = [
  'lesson_soon',
  'lesson_moved',
  'lesson_cancelled',
  'lesson_restored',
  'lessons_rescheduled',
  'lessons_cancelled',
] as const

/** Что показать на экране телефона и как долго службе push держать сообщение. */
export interface PushView {
  title: string
  body: string
  href: string
  /** Одно уведомление на урок или серию: новое о том же заменяет прежнее на экране. */
  tag: string
  /** Секунд, пока служба push пытается доставить (телефон выключен — потом уже не нужно). */
  ttl: number
  urgency: 'high' | 'normal'
}

const DAY_S = 24 * 60 * 60

/**
 * Push по уведомлению — или null: вид не для push, или уже поздно («урок
 * через час», когда урок начался). now — параметром, для теста.
 */
export function pushView(
  n: Pick<AppNotification, 'id' | 'kind' | 'data' | 'created_at'>,
  now: Date = new Date(),
): PushView | null {
  if (!(PUSH_KINDS as readonly string[]).includes(n.kind)) return null
  const d = n.data ?? {}
  let ttl = DAY_S
  if (n.kind === 'lesson_soon') {
    const start = Date.parse(text(d.at) ?? '')
    if (Number.isNaN(start) || start <= now.getTime()) return null
    ttl = Math.max(60, Math.round((start - now.getTime()) / 1000))
  }
  const view = renderNotification(n)
  const lesson = text(d.lesson)
  const series = text(d.series)
  return {
    title: view.title,
    body: view.body ?? '',
    href: view.href ?? '/lessons',
    tag: lesson && UUID.test(lesson) ? `lesson-${lesson}` : series && UUID.test(series) ? `series-${series}` : `n-${n.id}`,
    ttl,
    urgency: 'high',
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
