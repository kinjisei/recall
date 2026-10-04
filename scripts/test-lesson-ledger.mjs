/**
 * Учёт уроков на экране — правила без базы (PLAN.md Ф2.8;
 * src/domains/schedule/ledger.ts; макеты t7-1 … t7-3):
 *
 *   • подпись остатка: «Оплачено, осталось 3 урока», «закончились · −2»
 *     (минус — только учителю), без оплат — «не отмечены»;
 *   • когда ученик требует внимания: остаток 1 и меньше, только если учёт
 *     ведётся (журнал п.67);
 *   • строки истории: оплата, исправление, проведён (группа — с названием),
 *     автосписание, поздняя отмена, отменён, пробный, не был, не отмечен;
 *   • «Напомнить»: текст макета t7-3, без суммы; «закончились» при нуле.
 * Чистый: без сети и базы. Запуск: node scripts/test-lesson-ledger.mjs
 */
import { almatyInstant } from '../src/domains/schedule/calendar.ts'
import { balanceLabel, balanceLow, balanceShort, historyMonth, historyRow, paymentReminder } from '../src/domains/schedule/ledger.ts'

let ok = 0
let failed = 0
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : ` — получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`}`)
  pass ? ok++ : failed++
}

const B = (paid, charged) => ({ cardId: 'x', paid, charged, balance: paid - charged })
check('подпись остатка', [balanceLabel(B(8, 5)), balanceLabel(B(8, 7)), balanceLabel(B(8, 8)), balanceLabel(B(8, 10)), balanceLabel(B(0, 3)), balanceLabel(null)], [
  'Оплачено, осталось 3 урока', 'Оплачено, осталось 1 урок', 'Оплаченные уроки закончились', 'Оплаченные уроки закончились · −2', 'Оплаты не отмечены', 'Оплаты не отмечены',
])
check('число в строке списка: «3», «−2», без учёта — пусто', [balanceShort(B(8, 5)), balanceShort(B(8, 10)), balanceShort(B(0, 3))], ['3', '−2', null])
check('внимание по оплате: 1 и меньше, только при учёте', [balanceLow(B(8, 6)), balanceLow(B(8, 7)), balanceLow(B(8, 9)), balanceLow(B(0, 3))], [false, true, true, false])

const L = (extra) => ({
  item: 'lesson', id: 'l', at: '', n: null, note: null, paidOn: null, lessonKind: 'individual', lessonStatus: 'done', title: null,
  startsAt: almatyInstant('2026-10-13', '19:00').toISOString(), trial: false, attended: true, charge: 'charged', chargeAuto: false, ...extra,
})
const row = (h) => {
  const r = historyRow(h)
  return [r.title, r.detail, r.delta, r.fix]
}
check('история (макет t7-2)', [
  row({ item: 'payment', id: 'p', at: '', n: 8, note: null, paidOn: '2026-09-29' }),
  row({ item: 'payment', id: 'p', at: '', n: -2, note: 'ошибся', paidOn: '2026-10-01' }),
  row(L({})),
  row(L({ chargeAuto: true })),
  row(L({ lessonKind: 'group', title: 'Разговорный клуб' })),
  row(L({ lessonStatus: 'cancelled', attended: false, charge: 'late_cancel' })),
  row(L({ lessonStatus: 'cancelled', attended: false, charge: 'not_charged' })),
  row(L({ trial: true, charge: 'not_charged' })),
  row(L({ attended: false, charge: 'not_charged' })),
  row(L({ lessonStatus: 'planned', attended: null, charge: null })),
  row(L({ charge: 'not_charged' })),
], [
  ['Оплата', '29 сен · отмечена тобой', 8, 'payment'],
  ['Исправление оплаты', '1 окт · отмечена тобой · ошибся', -2, null],
  ['Проведён', 'вт, 13 окт · 19:00 · списан', -1, 'lesson'],
  ['Проведён', 'вт, 13 окт · 19:00 · списан автоматически', -1, 'lesson'],
  ['Проведён · Разговорный клуб', 'вт, 13 окт · 19:00 · списан', -1, 'lesson'],
  ['Поздняя отмена', 'вт, 13 окт · 19:00 · списан', -1, 'cancelled'],
  ['Отменён', 'вт, 13 окт · 19:00 · не списан', 0, 'cancelled'],
  ['Пробный урок', 'вт, 13 окт · 19:00 · без списания', 0, 'lesson'],
  ['Не был', 'вт, 13 окт · 19:00 · не списан', 0, 'lesson'],
  ['Не отмечен', 'вт, 13 окт · 19:00 · не списан', null, 'lesson'],
  ['Проведён', 'вт, 13 окт · 19:00 · не списан', 0, 'lesson'],
])
check('месяц группы: свой год — без года, другой — с годом', [
  historyMonth({ at: '', paidOn: '2026-09-29', startsAt: null }, '2026-10-15'),
  historyMonth({ at: '', paidOn: null, startsAt: almatyInstant('2025-12-30', '10:00').toISOString() }, '2026-10-15'),
], ['Сентябрь', 'Декабрь 2025'])

const tue = almatyInstant('2026-10-20', '10:00').toISOString()
check('«Напомнить» (макет t7-3)', paymentReminder('Тимур', 1, tue),
  'Тимур, привет! Остался один оплаченный урок — во вторник в 10:00. Продолжаем? Тогда пришли, пожалуйста, оплату за следующие уроки.')
check('без следующего урока и при нуле', [paymentReminder('Айгерим', 1, null), paymentReminder('Айгерим', -2, tue)], [
  'Айгерим, привет! Остался один оплаченный урок. Продолжаем? Тогда пришли, пожалуйста, оплату за следующие уроки.',
  'Айгерим, привет! Оплаченные уроки закончились. Продолжаем? Тогда пришли, пожалуйста, оплату за следующие уроки.',
])
check('в напоминании ни слова о деньгах и минусе', /₸|тенге|сумм|−|-\d/.test(paymentReminder('Тимур', -2, tue) + paymentReminder('Тимур', 1, tue)), false)

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
