/**
 * Модель уведомлений src/domains/notifications/model.ts (PLAN.md Ф1.5).
 *
 *   • текст по виду: «сообщение от Recall», неизвестный вид — заголовок из
 *     данных или нейтральный, пустые строки не показываются;
 *   • ссылка из данных — ТОЛЬКО внутренняя: «//evil», «https://…»,
 *     «javascript:…» и обратная косая не проходят (иначе лента — готовый
 *     фишинг: данные могут прийти от человека);
 *   • «тариф / пробный закончится завтра» (Ф2.4): имя тарифа, дата по
 *     Алматы, кнопка-действие только со своей ссылкой; копия имён тарифов
 *     совпадает с каталогом domains/billing;
 *   • счёт непрочитанных и «когда» — от заданного «сейчас».
 * Чистый: без сети и базы.
 * Запуск: node scripts/test-notifications.mjs
 */
import './_api-loader.mjs'
import { PAID_PLANS, planName } from '../src/domains/billing/model.ts'

// модель импортирует соседей с .js (её читает и сервер доставки, Vercel) —
// динамически, после загрузчика (_api-loader.mjs)
const { PLAN_NAMES, renderNotification, safeHref, unreadCount, whenLabel } = await import('../src/domains/notifications/model.ts')

let fail = 0
let total = 0
const check = (name, got, want) => {
  total++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ждали ${JSON.stringify(want)}, получили ${JSON.stringify(got)}`}`)
}

// ── текст по виду ────────────────────────────────────────────────────────────
check('manual: заголовок, текст, ссылка', renderNotification({ kind: 'manual', data: { title: ' Новости ', body: 'Текст', href: '/progress' } }), {
  title: 'Новости',
  body: 'Текст',
  href: '/progress',
})
check('manual без заголовка — «Сообщение от Recall»', renderNotification({ kind: 'manual', data: {} }).title, 'Сообщение от Recall')
check('пробелы вместо заголовка — как без него', renderNotification({ kind: 'manual', data: { title: '   ' } }).title, 'Сообщение от Recall')
check('неизвестный вид — заголовок из данных', renderNotification({ kind: 'future_kind', data: { title: 'Что-то новое' } }).title, 'Что-то новое')
check('неизвестный вид без данных — нейтрально', renderNotification({ kind: 'future_kind', data: {} }), {
  title: 'Новое уведомление',
  body: undefined,
  href: undefined,
})
check('не строка в заголовке не ломает', renderNotification({ kind: 'manual', data: { title: 42 } }).title, 'Сообщение от Recall')

// оплата тарифа (Ф2.1): данные пишет confirm_payment / report_payment_sent
check('payment_reported: владельцу — кто и куда идти', renderNotification({ kind: 'payment_reported', data: { name: 'Мадина', href: '/admin' } }), {
  title: 'Оплата отправлена',
  body: 'Мадина — проверь перевод в Kaspi и подтверди в админке',
  href: '/admin',
})
check('payment_reported без имени — «Без имени», а не «undefined»', renderNotification({ kind: 'payment_reported', data: {} }).body, 'Без имени — проверь перевод в Kaspi и подтверди в админке')
check(
  'plan_paid: срок — день по Алматы (ночь 16-го по Алматы — ещё 15-е по UTC)',
  renderNotification({ kind: 'plan_paid', data: { until: '2026-11-15T20:30:00Z', href: '/pricing' } }),
  { title: 'Оплата получена', body: 'Тариф действует до 16 ноября', href: '/pricing' },
)
check('plan_paid с кривой датой — без даты, а не «Invalid Date»', renderNotification({ kind: 'plan_paid', data: { until: 'завтра' } }).body, 'Тариф включён')

// рефералка (Ф2.3): данные пишет apply_referral_rewards / after_payment_confirmed
check(
  'referral_rewarded: месяц и дата по Алматы',
  renderNotification({ kind: 'referral_rewarded', data: { months: 1, days: 0, until: '2026-11-15T20:30:00Z', href: '/invite' } }),
  { title: 'Подарок за коллегу', body: '+1 месяц к тарифу, теперь он действует до 16 ноября', href: '/invite' },
)
check(
  'referral_rewarded: дни, если коллега выбрал тариф дешевле (18 дней, 7 дней)',
  [
    renderNotification({ kind: 'referral_rewarded', data: { months: 0, days: 18, until: '2026-11-15T20:30:00Z' } }).body,
    renderNotification({ kind: 'referral_rewarded', data: { months: 0, days: 7 } }).body,
  ],
  ['+18 дней к тарифу, теперь он действует до 16 ноября', '+7 дней к тарифу'],
)
check('referral_rewarded с мусором — без «+undefined»', renderNotification({ kind: 'referral_rewarded', data: { months: 'x' } }).body, 'Тариф продлён')
check('referral_paid: подарок ждёт своей оплаты, ссылка — «Как оплатить»', renderNotification({ kind: 'referral_paid', data: { href: '/pay' } }), {
  title: 'По твоей ссылке оплатили тариф',
  body: 'Подарок добавим, когда оплатишь свой тариф',
  href: '/pay',
})

// ── ссылки ───────────────────────────────────────────────────────────────────
check('внутренний адрес проходит', safeHref('/study?view=reader'), '/study?view=reader')
check('«//evil.site» — нет', safeHref('//evil.site/x'), undefined)
check('«https://…» — нет', safeHref('https://evil.site'), undefined)
check('«javascript:…» — нет', safeHref('javascript:alert(1)'), undefined)
check('обратная косая — нет', safeHref('/\\evil.site'), undefined)
check('не строка — нет', safeHref({ href: '/x' }), undefined)
check('чужая ссылка в manual не попадает в ленту', renderNotification({ kind: 'manual', data: { title: 't', href: 'https://evil' } }).href, undefined)

// ── конец тарифа и пробного (Ф2.4, макет t9-2) ──────────────────────────────────
const until = '2026-10-16T05:00:00Z' // 16 октября, 10:00 по Алматы
check(
  'тариф кончается завтра: имя тарифа, дата, «Как оплатить»',
  renderNotification({ kind: 'plan_ending', data: { plan: 'teacher_mini', until, href: '/pay' } }),
  { title: 'Тариф закончится завтра', body: 'Репетитор Mini действует до 16 октября', href: '/pay', action: 'Как оплатить' },
)
check(
  'пробный кончается завтра: «Выбрать тариф»',
  renderNotification({ kind: 'trial_ending', data: { until, href: '/pay' } }),
  { title: 'Пробный период закончится завтра', body: 'Действует до 16 октября', href: '/pay', action: 'Выбрать тариф' },
)
check('самоучке — про Premium', renderNotification({ kind: 'plan_ending', data: { plan: 'premium', until, href: '/pay' } }).body, 'Premium действует до 16 октября')
check(
  'дата — по Алматы: 15-е 20:00 UTC — это уже 16-е',
  renderNotification({ kind: 'trial_ending', data: { until: '2026-10-15T20:00:00Z' } }).body,
  'Действует до 16 октября',
)
check('незнакомый тариф — «Тариф», а не undefined', renderNotification({ kind: 'plan_ending', data: { plan: 'gold', until } }).body, 'Тариф действует до 16 октября')
check('«__proto__» вместо тарифа — не ломает текст', renderNotification({ kind: 'plan_ending', data: { plan: '__proto__', until } }).body, 'Тариф действует до 16 октября')
check('кривая дата — без текста, заголовок на месте', renderNotification({ kind: 'plan_ending', data: { until: 'вчера' } }), { title: 'Тариф закончится завтра' })
check('без ссылки — без кнопки-действия', renderNotification({ kind: 'trial_ending', data: { until } }).action, undefined)
check('чужая ссылка — ни ссылки, ни кнопки', renderNotification({ kind: 'plan_ending', data: { until, href: '//evil.site' } }), {
  title: 'Тариф закончится завтра',
  body: 'Тариф действует до 16 октября',
})
// копия имён тарифов = каталог domains/billing (planName): переименовали тариф
// там — красное здесь, а не старое имя в уведомлениях
for (const plan of PAID_PLANS) check(`имя тарифа ${plan} — как в каталоге`, PLAN_NAMES[plan], planName(plan))
check('лишних имён в копии нет', Object.keys(PLAN_NAMES).sort(), [...PAID_PLANS].sort())

// ── учёт уроков (Ф2.8) ─────────────────────────────────────────────────────────
const cardId = '0f2a8c3e-1b2d-4e5f-8a9b-0c1d2e3f4a5b'
check('«остался 1»: имя без падежей, следующий урок по Алматы, «Напомнить»', renderNotification({
  kind: 'lessons_low',
  data: { card: cardId, name: 'Тимур Ким', left: 1, next: '2026-10-20T05:00:00+00:00' },
}), {
  title: 'Тимур Ким: остался 1 оплаченный урок',
  body: 'Следующий — вт, 20 окт, 10:00',
  href: `/teacher?student=${cardId}&remind=1`,
  action: 'Напомнить',
})
check('остаток 0 и меньше — «закончились», без следующего — без строки', renderNotification({ kind: 'lessons_low', data: { card: cardId, name: 'Алина Ли', left: -2, next: null } }), {
  title: 'Алина Ли: оплаченные уроки закончились',
  body: undefined,
  href: `/teacher?student=${cardId}&remind=1`,
  action: 'Напомнить',
})
check('кривой id карточки — ни ссылки, ни кнопки', renderNotification({ kind: 'lessons_low', data: { card: '../admin', name: 'X', left: 1 } }).href, undefined)
check('сообщение учителя ученику', renderNotification({ kind: 'teacher_message', data: { teacher_name: 'Мадина', text: 'Остался один урок' } }), {
  title: 'Мадина пишет',
  body: 'Остался один урок',
})

// ── счёт и время ─────────────────────────────────────────────────────────────
check('непрочитанные', unreadCount([{ read_at: null }, { read_at: '2026-09-28T10:00:00Z' }, { read_at: null }]), 2)
const now = new Date(2026, 8, 28, 15, 0, 0) // 28 сентября 2026, 15:00 по местному
const ago = (ms) => new Date(now.getTime() - ms).toISOString()
check('полминуты — «только что»', whenLabel(ago(30_000), now), 'только что')
check('5 минут', whenLabel(ago(5 * 60_000), now), '5 мин назад')
check('3 часа, тот же день', whenLabel(ago(3 * 3600_000), now), '3 ч назад')
check('вчера', whenLabel(new Date(2026, 8, 27, 22, 0).toISOString(), now), 'вчера')
check('раньше — дата', /сентября/.test(whenLabel(new Date(2026, 8, 20, 9, 0).toISOString(), now)), true)
check('кривая дата — пусто, а не «NaN»', whenLabel('не дата', now), '')

console.log(`\nИтог: ${total - fail}/${total}`)
process.exitCode = fail ? 1 : 0
