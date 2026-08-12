/**
 * Предпроверка бэкапа (.github/scripts/backup-precheck.mjs).
 *
 * Проверяем ровно то, ради чего она есть: три способа испортить строку
 * подключения на одном и том же экране Supabase распознаются по отдельности,
 * правильная строка проходит, а секреты в сводку не попадают.
 *
 * Запуск: node scripts/test-backup-precheck.mjs
 */
import { parseUrl, precheck } from '../.github/scripts/backup-precheck.mjs'

let ok = 0
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  pass ? ok++ : failed++
}

const PASS = 'очень-длинный-пароль'
const SESSION = 'postgresql://postgres.abcdefghijklm:p@ss:w0rd@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
const TRANSACTION = 'postgresql://postgres.abcdefghijklm:p@ss:w0rd@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
const DIRECT = 'postgresql://postgres:p@ss:w0rd@db.abcdefghijklm.supabase.co:5432/postgres'
const POOLER_BAD_USER = 'postgresql://postgres:p@ss:w0rd@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'

// --- разбор строки ----------------------------------------------------------
{
  // Пароль с «@» и «:» внутри — обычное дело, и именно на нём ломается наивный split.
  const p = parseUrl(SESSION)
  check('логин разобран при «@» в пароле', p.user === 'postgres.abcdefghijklm', p.user)
  check('хост разобран', p.host === 'aws-0-eu-central-1.pooler.supabase.com', p.host)
  check('порт разобран', p.port === '5432', p.port)
  const noPort = parseUrl('postgresql://user.ref:pw@aws-0.pooler.supabase.com/postgres')
  check('строка без порта не выдумывает порт', noPort.port === '', noPort.port)
  const withParams = parseUrl(SESSION + '?sslmode=require')
  check('параметры после базы не мешают', withParams.port === '5432', withParams.port)
}

// --- правильная строка проходит ---------------------------------------------
{
  const r = precheck({ url: SESSION, passphrase: PASS })
  check('Session pooler на 5432 проходит', r.ok === true, r.reason)
  check('у прошедшей проверки пустая сводка', r.summary === '')
  check('строка с ?sslmode=require тоже проходит', precheck({ url: SESSION + '?sslmode=require', passphrase: PASS }).ok)
}

// --- три способа ошибиться --------------------------------------------------
{
  const t = precheck({ url: TRANSACTION, passphrase: PASS })
  check('транзакционный пул (6543) отклонён', !t.ok && t.reason === 'транзакционный пул', t.reason)
  check('в сводке назван нужный порт', t.summary.includes('5432') && t.summary.includes('6543'))

  const d = precheck({ url: DIRECT, passphrase: PASS })
  check('Direct connection отклонён', !d.ok && d.reason === 'не пул соединений', d.reason)
  check('в сводке объяснён IPv6', d.summary.includes('IPv6'))

  const u = precheck({ url: POOLER_BAD_USER, passphrase: PASS })
  check('логин без кода проекта отклонён', !u.ok && u.reason === 'логин не для пула', u.reason)
  check('в сводке назван «Tenant or user not found»', u.summary.includes('Tenant or user not found'))
}

// --- пропущенные секреты ----------------------------------------------------
{
  const none = precheck({})
  check('оба пропущенных секрета названы', !none.ok && /SUPABASE_DB_URL/.test(none.summary) && /BACKUP_PASSPHRASE/.test(none.summary))
  const noPass = precheck({ url: SESSION })
  check('пропущен только пароль шифрования', !noPass.ok && noPass.reason === 'нет BACKUP_PASSPHRASE', noPass.reason)
  const junk = precheck({ url: 'мой пароль от базы', passphrase: PASS })
  check('мусор вместо строки подключения отклонён', !junk.ok && junk.reason === 'не строка подключения', junk.reason)
}

// --- секреты не утекают в сводку --------------------------------------------
{
  for (const [name, url] of [
    ['транзакционный пул', TRANSACTION],
    ['direct', DIRECT],
    ['логин не для пула', POOLER_BAD_USER],
  ]) {
    const r = precheck({ url, passphrase: PASS })
    const leaked = r.summary.includes('p@ss') || r.summary.includes(url) || r.summary.includes(PASS)
    check(`сводка «${name}» не содержит секретов`, !leaked)
  }
}

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exit(failed === 0 ? 0 : 1)
