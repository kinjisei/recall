/**
 * Разбор падения бэкапа (.github/scripts/backup-explain.mjs).
 *
 * Зачем тест: сводку прогона видно только после настоящего падения раз в сутки,
 * и «проверить глазами» её нельзя. Здесь она собирается на подставных
 * сообщениях pg_dump — включая то, из-за чего всё затевалось: чтобы в сводку
 * не уехали пароль и строка подключения.
 *
 * Запуск: node scripts/test-backup-explain.mjs
 */
import { buildSummary, explain, head, redact } from '../.github/scripts/backup-explain.mjs'

let ok = 0
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  pass ? ok++ : failed++
}

const URL_SECRET = 'postgresql://postgres.abcdefghijklm:p@ss:w0rd!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
const PASS_SECRET = 'p@ss:w0rd!'

// --- 1. Секреты не просачиваются -------------------------------------------
{
  const stderr = [
    `pg_dump: error: connection to server at "aws-0-eu-central-1.pooler.supabase.com" failed`,
    `pg_dump: detail: connection string was ${URL_SECRET}`,
    `gpg: using passphrase ${PASS_SECRET}`,
  ].join('\n')
  const out = buildSummary({ stderr, code: 1, secrets: [URL_SECRET, PASS_SECRET] })
  check('строка подключения не попала в сводку', !out.includes('pooler.supabase.com:5432/postgres'))
  check('пароль не попал в сводку', !out.includes(PASS_SECRET))
  check('на месте секрета осталась метка', out.includes('***'))
}

// --- 2. Пароль внутри percent-encoded строки --------------------------------
{
  const encoded = encodeURIComponent(PASS_SECRET)
  const stderr = `pg_dump: error: bad url postgresql://postgres.abc:${encoded}@host:5432/postgres`
  const out = redact(stderr, [URL_SECRET, PASS_SECRET])
  check('percent-encoded пароль тоже вырезан', !out.includes(encoded), out.trim())
}

// --- 3. Строка подключения без совпадения с секретом -------------------------
{
  // Секрет мог быть переписан (например, порт другой), но форма узнаётся всё равно.
  const stderr = 'pg_dump: error: could not connect: postgres://user:hunter2@db.example.com:5432/postgres'
  const out = redact(stderr, [])
  check('любая строка подключения вырезается по форме', !out.includes('hunter2'), out.trim())
}

// --- 4. Расшифровка частых причин -------------------------------------------
const CASES = [
  ['транзакционный пул', 'pg_dump: error: unnamed prepared statement does not exist', /6543|Session pooler/],
  ['логин пула', 'FATAL: Tenant or user not found', /postgres\.<код-проекта>/],
  ['пароль', 'pg_dump: error: connection failed: password authentication failed for user "postgres"', /пароль/i],
  ['IPv6 / direct', 'pg_dump: error: could not translate host name "db.abc.supabase.co" to address', /IPv6|Session pooler/],
  ['проект на паузе', 'pg_dump: error: connection to server failed: timeout expired', /паузе/i],
  ['версия сервера', 'pg_dump: error: aborting because of server version mismatch', /тег образа|версия/i],
  ['пул занят', 'FATAL: Max client connections reached', /соединени/i],
  ['права', 'pg_dump: error: permission denied for schema public', /прав/i],
  ['имя базы', 'FATAL: database "recall" does not exist', /имя базы/i],
  ['обрыв', 'pg_dump: error: server closed the connection unexpectedly', /оборвал/i],
  ['TLS', 'FATAL: no pg_hba.conf entry for host, SSL off', /sslmode/i],
]
for (const [name, stderr, re] of CASES) {
  const hint = explain(stderr)
  check(`причина «${name}» распознана`, !!hint && re.test(hint), hint ? '' : 'расшифровки нет')
}

// --- 5. Незнакомая ошибка не выдумывает причину ------------------------------
{
  const stderr = 'pg_dump: error: something entirely new happened'
  check('незнакомая ошибка — без расшифровки', explain(stderr) === null)
  const out = buildSummary({ stderr, code: 2, secrets: [] })
  check('но текст сервера всё равно в сводке', out.includes('something entirely new happened'))
  check('и предложено дописать расшифровку', out.includes('backup-explain.mjs'))
}

// --- 6. Длинный stderr обрезается -------------------------------------------
{
  const stderr = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n')
  const { shown, hidden } = head(stderr)
  check('показано не больше 15 строк', shown.length === 15, `строк: ${shown.length}`)
  check('остальные посчитаны', hidden === 25, `скрыто: ${hidden}`)
  const out = buildSummary({ stderr, code: 1, secrets: [] })
  check('в сводке сказано, сколько строк скрыто', out.includes('ещё 25 строк'))
  check('шестнадцатая строка не показана', !out.includes('line 16'))
}

// --- 7. Пустой stderr -------------------------------------------------------
{
  const out = buildSummary({ stderr: '', code: 137, secrets: [] })
  check('молчаливое падение объяснено отдельно', out.includes('умер молча'))
  check('код возврата назван', out.includes('137'))
}

// --- 8. Этапы конвейера -----------------------------------------------------
{
  const gpg = buildSummary({ stderr: 'gpg: signing failed', code: 2, stage: 'gpg', secrets: [] })
  check('этап шифрования назван', gpg.includes('шифрование'))
  const size = buildSummary({ stderr: 'pg_dump: warning: nothing to dump', code: 512, stage: 'size', secrets: [] })
  check('пустой дамп объяснён как потеря, а не как отказ', size.includes('Бэкап пустой') && size.includes('512 байт'))
  check('у пустого дампа своя подсказка, а не «причина не из знакомых»', size.includes('нехватка прав') && !size.includes('не из знакомых'))
  // Но если сервер сказал что-то знакомое — берём его причину, а не общую.
  const sizeKnown = buildSummary({ stderr: 'FATAL: Tenant or user not found', code: 300, stage: 'size', secrets: [] })
  check('знакомая ошибка перебивает подсказку про права', sizeKnown.includes('postgres.<код-проекта>') && !sizeKnown.includes('нехватка прав'))
}

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exit(failed === 0 ? 0 : 1)
