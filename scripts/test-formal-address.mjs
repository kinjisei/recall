/**
 * Открытые страницы — на «вы», внутри приложения — «ты» (журнал п.71; PLAN.md
 * Ф2.11б-1). Проверяет текст файлов, из которых собраны открытые страницы:
 *
 *   • нет «ты / тебя / твой…», глаголов на -ешь/-ишь и повелительных на «ты»
 *     («Проверь», «Введи», «Присоединяйся») — во всём, кроме комментариев;
 *   • ошибки пароля — безличные: их показывают и открытые страницы, и
 *     «Настройки» внутри приложения (lib/passwordReset);
 *   • связь: номер WhatsApp живёт только в shared/lib/contacts (текстом на
 *     страницах его не печатаем — боты), ссылки WhatsApp / Telegram / почты
 *     собраны верно;
 *   • «привёл коллегу» на лендинге — те же 21 день, что в базе (Ф2.3).
 *
 * /terms и /privacy — при их правке по Ф2.22. Внутри приложения «ты» не
 * проверяется: там оно и должно быть.
 * Чистый: без сети и базы. Краснеет на коде до Ф2.11б-1:
 *   node scripts/test-formal-address.mjs --ref 3a21421
 * Запуск: node scripts/test-formal-address.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REFERRAL_BONUS_DAYS } from '../src/domains/billing/referral.ts'
import { SUPPORT_EMAIL, supportMailto, supportTelegram, supportWhatsapp } from '../src/shared/lib/contacts.ts'
import { informal, word } from './_formal.mjs'

let ok = 0
let failed = 0
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass || !detail ? '' : ` — ${detail}`}`)
  pass ? ok++ : failed++
}

/** Файлы открытых страниц: лендинг, вход и регистрация, пароль, тарифы, оплата, блок связи, экран сбоя. */
const OPEN_FILES = [
  'src/features/landing/TeachersPage.tsx',
  'src/features/landing/LandingParts.tsx',
  'src/features/landing/landingContent.ts',
  'src/features/auth/LoginPage.tsx',
  'src/features/auth/ForgotPasswordPage.tsx',
  'src/features/auth/ResetPasswordPage.tsx',
  'src/features/auth/authUi.tsx',
  'src/lib/access.ts', // ошибки входа и регистрации
  'src/lib/passwordReset.ts', // ошибки пароля — безличные, см. ниже
  'src/features/billing/PricingPage.tsx',
  'src/features/billing/PayPage.tsx',
  'src/features/billing/KaspiTransfer.tsx',
  'src/domains/billing/model.ts', // подписи и пункты тарифов на /pricing и /pay
  'src/shared/ui/ContactLinks.tsx',
  'src/app/ErrorBoundary.tsx', // ловит сбой и на открытых страницах
]

const ref = process.argv.includes('--ref') ? process.argv[process.argv.indexOf('--ref') + 1] : null
/** Текст файла — из рабочей копии или из коммита (--ref): так видно, что проверка краснеет на старом коде. */
function source(path) {
  if (!ref) return readFileSync(path, 'utf8')
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return '' // файла в том коммите ещё не было
  }
}

/** Код без комментариев: в них «ты» законно (пишем для себя, не для человека). */
const stripComments = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/\//.test(line))
    .map((line) => line.replace(/\s\/\/\s.*$/, ''))
    .join('\n')

// ── сам поиск: ловит то, что стояло на страницах до Ф2.11б-1 ─────────────────
for (const old of [
  'Присоединяйся к Recall',
  'Создавая аккаунт, ты принимаешь',
  'Впиши код в сообщение к переводу',
  'Если учишься сам и каждый день',
  'Цена — меньше часа твоей работы',
  'Проверь почту',
  'Ответ — «да», проверь почту',
  'Это твой прежний пароль. Придумай другой.',
]) {
  check(`поиск видит «ты»: «${old}»`, informal(old).length > 0)
}
for (const fine of [
  'Присоединяйтесь к Recall',
  'Создавая аккаунт, вы принимаете',
  'Подпись и запись урока',
  'Слишком много попыток подряд. Повторить можно через минуту.',
  'Ваш тариф: Репетитор · Mini',
  'в разделе «Пригласи коллегу»',
]) {
  check(`поиск не путает: «${fine}»`, informal(fine).length === 0, informal(fine).join(', '))
}

// ── открытые страницы ─────────────────────────────────────────────────────────
for (const path of OPEN_FILES) {
  const found = informal(stripComments(source(path)))
  check(`на «вы»: ${path}`, found.length === 0, [...new Set(found)].join(', '))
}

// ── ошибки пароля — безличные: ни «ты», ни «вы» ───────────────────────────────
{
  const code = stripComments(source('src/lib/passwordReset.ts'))
  const body = code.slice(code.indexOf('export function describeResetError'), code.indexOf('\n}', code.indexOf('export function describeResetError')))
  const formal = [...body.matchAll(word('вы|вас|вам|ваш|ваша|ваше|ваши|ваш[а-яё]+|[а-яё]+(?:ите|йте)(?:сь)?'))].map((m) => m[0])
  check('ошибки пароля без «вы» (их видят и Настройки)', body.length > 0 && formal.length === 0, formal.join(', '))
}

// ── связь ──────────────────────────────────────────────────────────────────────
if (!ref) {
  const DIGITS = '7762100221'
  // номер в любой записи: «77762100221», «+7 776 210 02 21», «(776) 210-02-21»
  const PHONE = new RegExp(DIGITS.split('').join('[\\s()-]*'))
  // где номер законен: ссылка WhatsApp и реквизиты Kaspi — их видит только
  // вошедший на «Как оплатить», без номера перевод не сделать
  const ALLOWED = ['src/shared/lib/contacts.ts', 'src/domains/billing/model.ts']
  const found = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(tsx?|css|html)$/.test(e.name) && PHONE.test(readFileSync(p, 'utf8'))) found.push(p.replace(/\\/g, '/'))
    }
  }
  walk('src')
  const leaks = found.filter((p) => !ALLOWED.includes(p))
  check('номер — только в ссылке WhatsApp и реквизитах Kaspi', leaks.length === 0 && found.includes(ALLOWED[0]), found.join(', '))
  check('поиск номера видит запись с пробелами', PHONE.test('+7 776 210 02 21') && PHONE.test('(776) 210-02-21'))
  const wa = supportWhatsapp()
  check('WhatsApp: чат с номером и готовым первым сообщением', wa.startsWith(`https://wa.me/${'7' + DIGITS}?text=`) && decodeURIComponent(wa.split('text=')[1]).startsWith('Здравствуйте!'), wa)
  check('WhatsApp: пробелы не «+»', !wa.includes('+'), wa)
  check('Telegram: чат владельца', supportTelegram() === 'https://t.me/Yerb0lat', supportTelegram())
  check('почта: адрес и тема', supportMailto('Тема') === `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Тема')}`, supportMailto('Тема'))
}

// ── «привёл коллегу» на лендинге = правило базы ───────────────────────────────
{
  const text = source('src/features/landing/landingContent.ts')
  check(`лендинг: у коллеги ${14 + REFERRAL_BONUS_DAYS} день пробного`, text.includes(`${14 + REFERRAL_BONUS_DAYS} день`))
  check('лендинг: подарок — месяц тарифа по оплате коллеги, без «напиши нам»', /месяц вашего тарифа/.test(text) && !/напиши нам/i.test(source('src/features/landing/TeachersPage.tsx')))
}

console.log(`\n${ok} ✓  ${failed} ✗`)
process.exit(failed ? 1 : 0)
