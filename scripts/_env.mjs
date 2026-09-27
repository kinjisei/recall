/**
 * Какую базу трогают скрипты — ОДНО место (PLAN.md Ф1.2, архитектура §8).
 *
 * ⚠️ По умолчанию — ТЕСТОВАЯ база (recall-test). Живая — только явным флагом
 * --prod в командной строке. Раньше каждый скрипт читал .env.local сам и шёл в
 * VITE_SUPABASE_URL, то есть в прод: check-schema-equal гонял там транзакции.
 *
 * ⚠️ Что в живую базу МОЖНО, а что нет. Схему поменять отсюда нельзя: токен
 * Management API прода — только чтение (Ф0.2), пароля базы прода в .env.local
 * нет (журнал п.47 — миграции на проде запускает владелец, пароль руками).
 * А вот ДАННЫЕ — можно: служебный ключ прода (SUPABASE_SERVICE_KEY) лежит в
 * .env.local, и скрипт с --prod создаёт и удаляет через него аккаунты на
 * живой базе, как все смоуки до Ф1.2. Защита тут одна — явный --prod.
 *
 * Секреты не печатаются: supabaseCli прячет пароль и токены в выводе.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Версия Supabase CLI — закреплена: поведение db push проверено на ней (Ф1.2). */
export const SUPABASE_CLI = 'supabase@2.118.0'

export const ROOT = new URL('../', import.meta.url)

/** .env.local как объект. Нет файла — пустой объект (в CI его нет). */
export function readEnv() {
  const file = new URL('.env.local', ROOT)
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  )
}

const refOf = (url) => new URL(url).hostname.split('.')[0]

/**
 * База, с которой работает скрипт: test по умолчанию, prod — с --prod.
 * Бросает понятную ошибку, если в .env.local чего-то не хватает.
 */
export function dbTarget(argv = process.argv.slice(2)) {
  const env = readEnv()
  const prod = argv.includes('--prod')
  const need = prod
    ? ['VITE_SUPABASE_URL', 'SUPABASE_ACCESS_TOKEN']
    : ['TEST_SUPABASE_URL', 'TEST_SUPABASE_ACCESS_TOKEN']
  const missing = need.filter((k) => !env[k])
  if (missing.length) throw new Error(`Нет в .env.local: ${missing.join(', ')}`)
  const url = prod ? env.VITE_SUPABASE_URL : env.TEST_SUPABASE_URL
  const target = {
    name: prod ? 'prod' : 'test',
    label: prod ? 'ЖИВАЯ база' : 'тестовая база',
    url,
    ref: refOf(url),
    accessToken: prod ? env.SUPABASE_ACCESS_TOKEN : env.TEST_SUPABASE_ACCESS_TOKEN,
    // пароль есть только у тестовой: у прода его здесь нет намеренно (журнал п.47)
    dbPassword: prod ? undefined : env.TEST_SUPABASE_DB_PASSWORD,
  }
  if (!prod && env.VITE_SUPABASE_URL && refOf(env.VITE_SUPABASE_URL) === target.ref) {
    throw new Error('TEST_SUPABASE_URL указывает на прод — тестовая база обязана быть отдельной')
  }
  return target
}

/**
 * Окружение для скриптов: ТЕ ЖЕ имена, что они всегда читали из .env.local
 * (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
 * SUPABASE_ACCESS_TOKEN), но значения — ВЫБРАННОЙ базы: тестовой по
 * умолчанию, живой только с --prod. Так перевод полусотни проверок на
 * тестовую базу — одна строка в каждой, а их тела не меняются.
 *
 * ⚠️ Имя VITE_SUPABASE_URL здесь значит «адрес выбранной базы», а не прода.
 * Тестовая база — на новых ключах (sb_publishable_/sb_secret_, Ф0.1).
 */
export function scriptEnv(argv = process.argv.slice(2)) {
  const env = readEnv()
  const target = dbTarget(argv)
  assertSiteMatchesDb(process.env.AUDIT_BASE_URL)
  console.log(`▸ база: ${target.label}${target.name === 'test' ? '' : ' — --prod'}`)
  if (target.name === 'prod') return env
  const first = (...keys) => keys.map((k) => env[k]).find(Boolean)
  const mapped = {
    VITE_SUPABASE_URL: target.url,
    VITE_SUPABASE_ANON_KEY: first('TEST_SUPABASE_PUBLISHABLE_KEY', 'TEST_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_KEY: first('TEST_SUPABASE_SECRET_KEY', 'TEST_SUPABASE_SERVICE_KEY'),
    SUPABASE_ACCESS_TOKEN: target.accessToken,
  }
  const missing = Object.entries(mapped).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) throw new Error(`Для тестовой базы нет ключей в .env.local: ${missing.join(', ')}`)
  return { ...env, ...mapped }
}

/**
 * Адрес приложения для смоуков. Тестовая база — отдельный dev-сервер на 5174
 * (`npm run dev:test`), чтобы смоук никогда не попал в обычный `npm run dev`
 * на 5173: тот смотрит в ЖИВУЮ базу, и аккаунт, заведённый через интерфейс,
 * остался бы на проде без уборки.
 */
export const APP_URL = process.argv.includes('--prod')
  ? 'http://localhost:5173'
  : 'http://localhost:5174'

export const PROD_SITE = 'https://recall-pgkz.vercel.app'

/**
 * Живой сайт принимает вход только ЖИВОЙ базы. Если сайт живой, а база
 * тестовая (забыли --prod), скрипт завёл бы аккаунт на тестовой и упёрся бы в
 * 401 на проде — ложное красное, по которому потом чинят рабочий код. Лучше
 * отказаться сразу и сказать почему.
 */
export function assertSiteMatchesDb(site, argv = process.argv.slice(2)) {
  if (site?.startsWith(PROD_SITE) && !argv.includes('--prod')) {
    throw new Error(`Сайт ${PROD_SITE} — живой: запускай с --prod (иначе база тестовая)`)
  }
}

/** Первый аргумент командной строки, который не флаг (--prod и т.п.). */
export function firstArg(argv = process.argv.slice(2)) {
  return argv.find((a) => !a.startsWith('--'))
}

/** SQL через Management API. Возвращает строки последнего запроса. */
export async function runSql(target, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${target.ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${target.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) {
    let msg = body
    try {
      msg = JSON.parse(body).message ?? body
    } catch {
      /* не JSON — как есть */
    }
    throw new Error(`${target.label}: ${res.status} ${msg.slice(0, 800)}`)
  }
  return JSON.parse(body)
}

/**
 * Адрес подключения к базе для Supabase CLI (db push, migration repair).
 * Хост пулера берём у Management API: у проектов он разный (тестовая —
 * aws-0-…, живая — aws-1-…), зашитый в код однажды молча промахнулся бы.
 * Порт 5432 — сессионный режим: миграции идут транзакцией на файл.
 */
export async function dbUrl(target, password) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${target.ref}/config/database/pooler`, {
    headers: { Authorization: `Bearer ${target.accessToken}` },
  })
  if (!res.ok) throw new Error(`${target.label}: не узнать адрес пулера (${res.status})`)
  const [pooler] = await res.json()
  if (!pooler?.db_host || !pooler?.db_user) throw new Error(`${target.label}: пулер без адреса`)
  return `postgresql://${pooler.db_user}:${encodeURIComponent(password)}@${pooler.db_host}:5432/${pooler.db_name ?? 'postgres'}`
}

/** npx без оболочки: аргументы (в том числе адрес с паролем) не склеиваются в строку. */
function npxCli() {
  const candidates = [
    join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'),
    join(dirname(process.execPath), '../lib/node_modules/npm/bin/npx-cli.js'),
  ]
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error(`Не нашёл npx рядом с Node: ${candidates.join(', ')}`)
  return found
}

/**
 * Запуск Supabase CLI для базы target. Токен доступа — через окружение, не в
 * аргументах; в выводе пароль и токен заменены на ***.
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function supabaseCli(target, args, { cwd = ROOT, input } = {}) {
  const secrets = [target.accessToken, target.dbPassword]
    .filter(Boolean)
    .flatMap((s) => [s, encodeURIComponent(s)])
  const hide = (s) => secrets.reduce((acc, x) => acc.split(x).join('***'), s ?? '')
  const r = spawnSync(process.execPath, [npxCli(), '-y', SUPABASE_CLI, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: target.accessToken },
  })
  return { status: r.status ?? 1, stdout: hide(r.stdout), stderr: hide(r.stderr) }
}
