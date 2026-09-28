/**
 * Модель уведомлений src/domains/notifications/model.ts (PLAN.md Ф1.5).
 *
 *   • текст по виду: «сообщение от Recall», неизвестный вид — заголовок из
 *     данных или нейтральный, пустые строки не показываются;
 *   • ссылка из данных — ТОЛЬКО внутренняя: «//evil», «https://…»,
 *     «javascript:…» и обратная косая не проходят (иначе лента — готовый
 *     фишинг: данные могут прийти от человека);
 *   • счёт непрочитанных и «когда» — от заданного «сейчас».
 * Чистый: без сети и базы.
 * Запуск: node scripts/test-notifications.mjs
 */
import { renderNotification, safeHref, unreadCount, whenLabel } from '../src/domains/notifications/model.ts'

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
check('неизвестный вид — заголовок из данных', renderNotification({ kind: 'lesson_soon', data: { title: 'Урок через час' } }).title, 'Урок через час')
check('неизвестный вид без данных — нейтрально', renderNotification({ kind: 'lesson_soon', data: {} }), {
  title: 'Новое уведомление',
  body: undefined,
  href: undefined,
})
check('не строка в заголовке не ломает', renderNotification({ kind: 'manual', data: { title: 42 } }).title, 'Сообщение от Recall')

// ── ссылки ───────────────────────────────────────────────────────────────────
check('внутренний адрес проходит', safeHref('/study?view=reader'), '/study?view=reader')
check('«//evil.site» — нет', safeHref('//evil.site/x'), undefined)
check('«https://…» — нет', safeHref('https://evil.site'), undefined)
check('«javascript:…» — нет', safeHref('javascript:alert(1)'), undefined)
check('обратная косая — нет', safeHref('/\\evil.site'), undefined)
check('не строка — нет', safeHref({ href: '/x' }), undefined)
check('чужая ссылка в manual не попадает в ленту', renderNotification({ kind: 'manual', data: { title: 't', href: 'https://evil' } }).href, undefined)

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
