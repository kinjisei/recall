/**
 * Карточки учеников — то, что видит учитель (PLAN.md Ф2.5;
 * src/domains/students/model.ts):
 *
 *   • статусы и «занимает ли место» = база: список статусов — ограничение
 *     таблицы, правило — card_takes_seat в последней миграции, где она есть;
 *   • фильтры списка («Все» — без архива), поиск без регистра и «ё»;
 *   • инициалы казахских имён, имя для обращения;
 *   • контакт → WhatsApp и звонок по номеру, Telegram по нику, мусор — ничего;
 *   • «вне мест тарифа» — только ученику в приложении, которому место
 *     полагается; меню карточки по статусу;
 *   • подписи мест и приглашения: «будет 4 из 5», мест нет, пробный не займёт;
 *   • ссылка-приглашение несёт код и разбирается обратно (мусор — нет), текст —
 *     без ссылки (её добавляет «поделиться»).
 * Чистый: без сети и базы.
 * Запуск: node scripts/test-student-cards.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACTION_STATUS,
  CARD_FILTERS,
  CARD_STATUSES,
  cardActions,
  cardInviteLink,
  cardInviteMessage,
  cardInviteText,
  cardTakesSeat,
  contactLinks,
  firstName,
  initials,
  inviteSeatHint,
  matchesFilter,
  matchesQuery,
  outsideSeats,
  parseJoinCode,
  seatsLine,
  spacedCode,
} from '../src/domains/students/model.ts'

let ok = 0
let failed = 0
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : ` — получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`}`)
  pass ? ok++ : failed++
}

// ── статусы = база ──────────────────────────────────────────────────────────────
const dir = join(import.meta.dirname, '../supabase/migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const bodies = files.map((f) => readFileSync(join(dir, f), 'utf8'))
const withRule = bodies.filter((b) => b.includes('function public.card_takes_seat(')).at(-1) ?? ''
const rule = withRule.slice(withRule.indexOf('function public.card_takes_seat('))
const ruleList = rule.match(/select p_status in \(([^)]*)\)/)?.[1] ?? ''
const seatStatuses = [...ruleList.matchAll(/'([a-z]+)'/g)].map((m) => m[1])
check('card_takes_seat найдена в миграциях', seatStatuses.length > 0, true)
check('занимают место: копия = база', CARD_STATUSES.filter(cardTakesSeat), seatStatuses)
const table = bodies.filter((b) => b.includes('create table public.student_cards')).at(-1) ?? ''
const tableList = table.match(/check \(status in \(([^)]*)\)\)/)?.[1] ?? ''
check('статусы карточки: копия = ограничение таблицы', [...CARD_STATUSES], [...tableList.matchAll(/'([a-z]+)'/g)].map((m) => m[1]))

// ── фильтры и поиск ───────────────────────────────────────────────────────────────
const cards = ['trial', 'active', 'paused', 'archived'].map((status) => ({ status }))
check('«Все» — всё, кроме архива', cards.filter((c) => matchesFilter(c, 'all')).map((c) => c.status), ['trial', 'active', 'paused'])
check('«Архив» — только архив', cards.filter((c) => matchesFilter(c, 'archived')).map((c) => c.status), ['archived'])
check('«Занимаются» — только «занимается»', cards.filter((c) => matchesFilter(c, 'active')).map((c) => c.status), ['active'])
check('фильтры по макету t6-1', CARD_FILTERS.map((f) => f.label), ['Все', 'Занимаются', 'Пробные', 'Пауза', 'Архив'])
check('поиск без регистра и «ё»', matchesQuery({ name: 'Пётр Иванов', contact: null }, 'петр'), true)
check('поиск по контакту', matchesQuery({ name: 'Айгерим', contact: '@aigerim_kz' }, 'AIGERIM'), true)
check('пустой поиск пропускает всех', matchesQuery({ name: 'Айгерим', contact: null }, '  '), true)
check('чужое имя не находится', matchesQuery({ name: 'Айгерим', contact: null }, 'Тимур'), false)

// ── имя ─────────────────────────────────────────────────────────────────────────────
check('инициалы казахского имени', initials('Әсел Жұмабаева'), 'ӘЖ')
check('инициалы из трёх слов — первые два', initials('  мейір  сапар  ұлы '), 'МС')
check('инициалы одного слова', initials('Нұрсұлтан'), 'Н')
check('инициалы пустого', initials('   '), '?')
check('имя для обращения', firstName('Тимур Ким'), 'Тимур')

// ── контакт ─────────────────────────────────────────────────────────────────────────
check('номер +7 → WhatsApp и звонок', contactLinks('+7 701 123 45 67'), {
  whatsapp: 'https://wa.me/77011234567',
  telegram: null,
  phone: 'tel:+77011234567',
})
check('номер 8 701… → тот же +7', contactLinks('8 (701) 123-45-67').whatsapp, 'https://wa.me/77011234567')
check('@ник → Telegram', contactLinks('@timur_kim'), { whatsapp: null, telegram: 'https://t.me/timur_kim', phone: null })
check('t.me/ник → Telegram', contactLinks('https://t.me/timur_kim').telegram, 'https://t.me/timur_kim')
check('непонятный контакт — без кнопок', contactLinks('мама Тимура'), { whatsapp: null, telegram: null, phone: null })
check('пустой контакт — без кнопок', contactLinks(null), { whatsapp: null, telegram: null, phone: null })

// ── места ─────────────────────────────────────────────────────────────────────────
const card = (o) => ({ status: 'active', inApp: true, holdsSeat: false, ...o })
check('«вне мест»: в приложении, занимается, места нет', outsideSeats(card({}), true), true)
check('«вне мест» не про пробного', outsideSeats(card({ status: 'trial' }), true), false)
check('«вне мест» не про архив', outsideSeats(card({ status: 'archived' }), true), false)
check('«вне мест» не про карточку без приложения', outsideSeats(card({ inApp: false }), true), false)
check('«вне мест» не про держащего место', outsideSeats(card({ holdsSeat: true }), true), false)
check('без лимита мест «вне мест» не бывает', outsideSeats(card({}), false), false)
check('строка мест', seatsLine({ seats: 5, seats_used: 3 }), 'В приложении 3 из 5 мест тарифа')
check('без лимита строки мест нет', seatsLine({ seats: null, seats_used: 3 }), null)
check('приглашение: займёт место', inviteSeatHint({ status: 'active' }, { seats: 5, seats_used: 3 }), 'Займёт место в тарифе: будет 4 из 5.')
check('приглашение: пробный не займёт', inviteSeatHint({ status: 'trial' }, { seats: 5, seats_used: 5 }), 'Пробный ученик место в тарифе не займёт.')
check('приглашение: мест нет — сказано', /Мест в тарифе нет \(5 из 5\)/.test(inviteSeatHint({ status: 'paused' }, { seats: 5, seats_used: 5 })), true)
check('приглашение без лимита — без подписи', inviteSeatHint({ status: 'active' }, { seats: null, seats_used: 0 }), null)

// ── меню ─────────────────────────────────────────────────────────────────────────────
check('меню «занимается» (макет t6-3)', cardActions('active'), ['edit', 'pause', 'archive'])
check('меню архива (макет t6-3)', cardActions('archived'), ['edit', 'unarchive'])
check('из архива возвращается «занимается»', ACTION_STATUS.unarchive, 'active')
check('каждый пункт меню ведёт в существующий статус', Object.values(ACTION_STATUS).every((s) => CARD_STATUSES.includes(s)), true)

// ── приглашение ─────────────────────────────────────────────────────────────────────
const link = cardInviteLink('https://recall-pgkz.vercel.app/', 'K7M2PX')
check('ссылка несёт код', link, 'https://recall-pgkz.vercel.app/login?join=K7M2PX')
check('текст — по имени и с кодом, без ссылки', [cardInviteText('Тимур Ким', 'K7M2PX').startsWith('Тимур, '), cardInviteText('Тимур Ким', 'K7M2PX').includes('K7M2PX'), cardInviteText('Тимур Ким', 'K7M2PX').includes('http')], [true, true, false])
check('сообщение целиком — текст и ссылка', cardInviteMessage('Тимур Ким', 'K7M2PX', link).endsWith(` ${link}`), true)
check('код для диктовки', spacedCode('K7M2PX'), 'K7M 2PX')
check('код из ссылки: туда и обратно', parseJoinCode(new URL(link).searchParams.get('join')), 'K7M2PX')
check('код из ссылки: регистр и пробелы', parseJoinCode('  k7m2px '), 'K7M2PX')
check('код из ссылки: мусор, 0/1/O/I/L и длина — нет', ['K7M2P', 'K7M2PXX', 'K7M2P0', 'K7M2PO', 'K7M2PI', 'K7M2PL', '<b>', null].map(parseJoinCode), [null, null, null, null, null, null, null, null])

console.log(`\n${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
