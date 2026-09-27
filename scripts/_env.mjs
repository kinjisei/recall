/**
 * Какую базу трогают скрипты — ОДНО место (PLAN.md Ф1.2, архитектура §8).
 *
 * ⚠️ По умолчанию — ТЕСТОВАЯ база (recall-test). Живая — только явным флагом
 * --prod в командной строке. Раньше каждый скрипт читал .env.local сам и шёл в
 * VITE_SUPABASE_URL, то есть в прод: check-schema-equal гонял там транзакции.
 *
 * ⚠️ Писать в живую базу отсюда нельзя в принципе: токен прода — только
 * чтение (Ф0.2), пароля базы прода в .env.local нет (журнал п.47 — миграции
 * на проде запускает владелец, пароль вводит руками).
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
    label: prod ? 'ЖИВАЯ база (только чтение)' : 'тестовая база',
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
