/**
 * Рефералка — то, что видит человек (PLAN.md Ф2.3; src/domains/billing/referral.ts):
 *
 *   • код из ссылки: регистр, мусор, кириллица, 0 и 1 — как в базе;
 *   • ссылка ведёт на регистрацию репетитором с кодом;
 *   • «поделиться» верные: WhatsApp — сообщение целиком, Telegram — ссылка
 *     отдельным полем и без повтора в тексте, пробелы — не «+»;
 *   • правило подарка (копия referral_reward из 0006): месяц при тарифе
 *     коллеги не дешевле, иначе дни на ту же сумму — и подарок НИКОГДА не
 *     дороже оплаты коллеги, то есть второй аккаунт выгоды не даёт;
 *   • сноска для своего тарифа, подписи счётчика;
 *   • цены в базе (plan_price в последней миграции) = цены каталога.
 * Чистый: без сети и базы.
 * Запуск: node scripts/test-referral.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLANS } from '../src/domains/billing/model.ts'
import {
  cheaperNote,
  INVITE_TEXT,
  inviteMessage,
  parseRefCode,
  REFERRAL_BONUS_DAYS,
  referralLink,
  referralReward,
  rewardLabel,
  rewardShort,
} from '../src/domains/billing/referral.ts'
import { telegramLink, whatsappLink } from '../src/shared/lib/share.ts'

let ok = 0
let failed = 0
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : ` — получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`}`)
  pass ? ok++ : failed++
}

const price = (id) => PLANS.find((p) => p.id === id).price
const TEACHER = ['teacher_mini', 'teacher_start', 'teacher_pro']
const TITLES = { teacher_mini: 'Mini', teacher_start: 'Start', teacher_pro: 'Pro' }
const PRICES = Object.fromEntries(TEACHER.map((p) => [p, price(p)]))

// ── код из ссылки ─────────────────────────────────────────────────────────────
check('код: строчные → заглавные, пробелы по краям', parseRefCode('  madina7 '), 'MADINA7')
check('код: несколько цифр', parseRefCode('BOTA2345'), 'BOTA2345')
check('код: 0 и 1 в цифрах — не наш код', [parseRefCode('MADINA0'), parseRefCode('MADINA1')], [null, null])
check('код: одна буква, без цифр, длинный — нет', [parseRefCode('M7'), parseRefCode('MADINA'), parseRefCode('ABCDEFGHI7')], [null, null, null])
check('код: кириллица и разметка — нет', [parseRefCode('АЛИЯ7'), parseRefCode('<b>X7'), parseRefCode('MADINA7&x=1')], [null, null, null])
check('код: пусто — нет', [parseRefCode(null), parseRefCode(undefined), parseRefCode('')], [null, null, null])

// ── ссылка ────────────────────────────────────────────────────────────────────
const link = referralLink('https://recall-pgkz.vercel.app/', 'MADINA7')
check('ссылка: регистрация репетитором с кодом, без двойной косой', link, 'https://recall-pgkz.vercel.app/login?role=teacher&ref=MADINA7')
const u = new URL(link)
check('ссылка: адрес /login, role=teacher, ref=код', [u.pathname, u.searchParams.get('role'), parseRefCode(u.searchParams.get('ref'))], ['/login', 'teacher', 'MADINA7'])

// ── сообщение и «поделиться» ──────────────────────────────────────────────────
const message = inviteMessage(link)
check('сообщение: текст, а в конце — ссылка', message.startsWith(INVITE_TEXT) && message.endsWith(` ${link}`), true)
check('сообщение: про бонус коллеге сказано («неделю» = +7 дней)', REFERRAL_BONUS_DAYS === 7 && /на неделю дольше/.test(INVITE_TEXT), true)
// расписания в Recall пока нет (PLAN.md Ф2.7) — не обещать то, чего нет
check('сообщение: не обещает расписание, которого ещё нет', /расписан/i.test(INVITE_TEXT), false)
check('текст без ссылки внутри (Telegram и «Поделиться» приклеивают её сами)', INVITE_TEXT.includes('http'), false)

const wa = new URL(whatsappLink(message))
check('WhatsApp: wa.me без номера — выбор контакта', [wa.origin, wa.pathname], ['https://wa.me', '/'])
check('WhatsApp: в тексте сообщение целиком, со ссылкой', wa.searchParams.get('text'), message)
check('WhatsApp: пробелы закодированы %20, а не «+»', whatsappLink(message).includes('+'), false)

const tg = new URL(telegramLink(INVITE_TEXT, link))
check('Telegram: t.me/share/url', `${tg.origin}${tg.pathname}`, 'https://t.me/share/url')
check('Telegram: ссылка — полем url (её Telegram обязательно требует)', tg.searchParams.get('url'), link)
check('Telegram: текст без ссылки — она не повторится дважды', tg.searchParams.get('text'), INVITE_TEXT)
check('Telegram: кириллица и «&» в ссылке не ломают адрес', telegramLink(INVITE_TEXT, link).split('&').length, 2)

// ── правило подарка ───────────────────────────────────────────────────────────
const reward = (referee, referrer) => referralReward(price(referee), price(referrer))
check('тот же тариф — месяц', reward('teacher_start', 'teacher_start'), { months: 1, days: 0 })
check('у коллеги дороже — тоже месяц, не больше', reward('teacher_pro', 'teacher_mini'), { months: 1, days: 0 })
check('Start за коллегу на Mini — 18 дней', reward('teacher_mini', 'teacher_start'), { months: 0, days: 18 })
check('Pro за коллегу на Mini — 7 дней (8 стоили бы дороже 3 900 ₸)', reward('teacher_mini', 'teacher_pro'), { months: 0, days: 7 })
check('Pro за коллегу на Start — 13 дней', reward('teacher_start', 'teacher_pro'), { months: 0, days: 13 })

// главное свойство: подарок не дороже месяца, который оплатил коллега, —
// значит второй аккаунт «на себя» никогда не окупается (месяц считаем за 30
// дней, как в правиле; календарный месяц при этом даётся целым)
const losers = []
for (const referee of TEACHER) {
  for (const referrer of TEACHER) {
    const r = reward(referee, referrer)
    const value = r.months ? price(referrer) : (r.days * price(referrer)) / 30
    if (value > price(referee)) losers.push(`${referee}→${referrer}: ${value} > ${price(referee)}`)
  }
}
check('все 9 пар: подарок не дороже оплаты коллеги (второй аккаунт невыгоден)', losers, [])

// ── подписи ───────────────────────────────────────────────────────────────────
check('подпись подарка', [rewardLabel({ months: 1, days: 0 }), rewardLabel({ months: 0, days: 18 }), rewardLabel({ months: 2, days: 21 }), rewardLabel({ months: 0, days: 0 })], ['1 месяц', '18 дней', '2 месяца и 21 день', '0'])
check('плитка счётчика', [rewardShort({ months: 1, days: 0 }), rewardShort({ months: 0, days: 7 }), rewardShort({ months: 1, days: 13 }), rewardShort({ months: 0, days: 0 })], ['1 мес', '7 дн', '1 мес 13 дн', '0'])
check('сноска у Mini не нужна — дешевле тарифа репетитора нет', cheaperNote('teacher_mini', PRICES, TITLES), null)
check('сноска у Start', cheaperNote('teacher_start', PRICES, TITLES), 'Если коллега выберет тариф дешевле твоего, получишь дни на ту же сумму: за Mini — 18 дней.')
check('сноска у Pro — обе цифры, от дешёвого', cheaperNote('teacher_pro', PRICES, TITLES), 'Если коллега выберет тариф дешевле твоего, получишь дни на ту же сумму: за Mini — 7 дней, за Start — 13 дней.')
check('без своего тарифа — общее правило', cheaperNote(null, PRICES, TITLES), 'Если коллега выберет тариф дешевле твоего, получишь дни на ту же сумму.')

// ── цены базы = цены каталога ─────────────────────────────────────────────────
// Последнее определение plan_price в миграциях — то, что сейчас в базе.
const dir = 'supabase/migrations'
const defs = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .flatMap((sql) => [...sql.matchAll(/create (?:or replace )?function public\.plan_price\([^)]*\)[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/g)].map((m) => m[1]))
const last = defs.at(-1) ?? ''
const dbPrices = Object.fromEntries([...last.matchAll(/when '([a-z_]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]))
const catalog = Object.fromEntries(['premium', ...TEACHER].map((id) => [id, price(id)]))
check('plan_price в базе = цены каталога (поменял цену — новая миграция)', dbPrices, catalog)

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
