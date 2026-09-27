/**
 * Применить миграции supabase/migrations к базе (PLAN.md Ф1.2, журнал п.47).
 *
 *   npm run db:migrate        — ТЕСТОВАЯ база: пароль из .env.local, запускает Claude
 *   npm run db:migrate:prod   — ЖИВАЯ база: запускает владелец, пароль вводит руками
 *
 * Порядок деплоя: миграция на тестовой → проверки → на проде → push. Клиент
 * зовёт RPC, которых иначе ещё нет.
 *
 * Что делает, по шагам:
 *   1. сторож миграций (имена, блок-страховка, baseline не правлен);
 *   2. какие миграции ждут на этой базе — по её истории;
 *   3. ПЕРВАЯ миграция базы (истории ещё нет): baseline не выполняется, а
 *      отмечается применённым — только если каталог базы совпадает с ним
 *      (отпечаток ниже). Не совпал — база менялась мимо baseline, стоп:
 *      выполнять миграции поверх неизвестного состояния нельзя;
 *   4. на живой — показывает план и спрашивает «да», затем пароль (ввод не
 *      отображается и нигде не сохраняется);
 *   5. supabase db push — каждый файл атомарен, упавший откатывается целиком;
 *   6. после: кто что может вызвать анонимно; на тестовой — типы; на живой —
 *      сверка с тестовой (должно стать 0 расхождений).
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { CATALOG_SNAPSHOT } from './_catalog.mjs'
import { ROOT, dbTarget, dbUrl, readEnv, runSql, supabaseCli } from './_env.mjs'

/**
 * Отпечаток каталога базы в состоянии 0000_baseline — снят с живой базы
 * 27.09.2026, когда она доказанно равнялась baseline (0 расхождений из 1627).
 * ⚠️ Зависит от слепка scripts/_catalog.mjs: поменяли слепок — пересними
 * отпечаток на базе, равной baseline, иначе первая миграция откажет зря.
 */
const BASELINE_CATALOG_SHA256 = 'd243de734b586d1a73ac1f50716fe7694eff435e53b330aaec963986a09b79f3'

const argv = process.argv.slice(2)
const target = dbTarget(argv)
const isProd = target.name === 'prod'
const node = (script, args = []) =>
  spawnSync(process.execPath, [new URL(`scripts/${script}`, ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1'), ...args], {
    stdio: 'inherit',
  }).status
const fail = (msg) => {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

console.log(`▸ миграции → ${target.label}\n`)

// --- 1. сторож миграций ------------------------------------------------------------
if (node('test-migrations.mjs') !== 0) fail('сторож миграций красный — сначала почини файлы')

// --- 2. что ждёт ---------------------------------------------------------------------
const files = readdirSync(new URL('supabase/migrations/', ROOT)).filter((f) => f.endsWith('.sql')).sort()
const [hasTable] = await runSql(target, "select to_regclass('supabase_migrations.schema_migrations') is not null as yes")
const applied = hasTable?.yes
  ? (await runSql(target, 'select version from supabase_migrations.schema_migrations')).map((r) => r.version)
  : []
const firstTime = applied.length === 0
const pending = files.filter((f) => !applied.includes(f.slice(0, 4)))
console.log(`\nприменены: ${applied.sort().join(', ') || 'нет (первая миграция этой базы)'}`)
console.log(`ждут: ${pending.join(', ') || 'нет'}`)
if (!pending.length) {
  console.log('\n✓ применять нечего')
  process.exit(0)
}

// --- 3. первая миграция: baseline только отмечается --------------------------------
if (firstTime) {
  const lines = (await runSql(target, CATALOG_SNAPSHOT)).map((r) => r.line)
  const sha = createHash('sha256').update(lines.join('\n')).digest('hex')
  if (sha !== BASELINE_CATALOG_SHA256) {
    fail(
      'каталог базы НЕ совпадает с baseline — её меняли мимо миграций. Ничего не\n' +
        '  записано. Посмотри расхождения: node scripts/check-db-equal.mjs',
    )
  }
  console.log('✓ каталог базы = baseline: 0000 будет отмечен применённым, не выполняясь')
}

// --- 4. подтверждение и пароль -------------------------------------------------------
/** Строка из терминала; hidden — не показывать вводимое (пароль). */
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
    if (hidden && process.stdin.isTTY) {
      // печатаем вопрос сами, а эхо набираемого глушим
      process.stdout.write(question)
      rl._writeToOutput = () => {}
      rl.question('', (a) => {
        rl.close()
        process.stdout.write('\n')
        resolve(a)
      })
    } else {
      rl.question(question, (a) => {
        rl.close()
        resolve(a)
      })
    }
  })
}

if (isProd) {
  console.log('\n⚠️  Это ЖИВАЯ база: изменения увидят ученики.')
  // Вопрос легко не заметить под выводом проверок и решить, что команда
  // зависла (так и было 27.09) — поэтому отдельной заметной строкой.
  console.log('\n⌨️  ЖДУ ТВОЕГО ОТВЕТА ↓')
  const yes = (await ask('Применить на живой базе? Напиши «да» и нажми Enter: ')).trim().toLowerCase()
  if (yes !== 'да') fail('отменено — ничего не записано')
  console.log('\n⌨️  ЖДУ ПАРОЛЬ ↓ (набранное не отображается — так задумано; вставка — правой кнопкой мыши)')
}
const password =
  isProd || argv.includes('--ask-password')
    ? await ask(`Пароль базы (${target.label}; ввод не отображается): `, true)
    : readEnv().TEST_SUPABASE_DB_PASSWORD
if (!password) fail('нет пароля базы')
target.dbPassword = password // чтобы supabaseCli спрятал его в выводе
console.log('✓ пароль принят. Дальше до пары минут без новых строк — CLI подключается и применяет, это нормально…')
const url = await dbUrl(target, password)

const run = (args) => {
  const r = supabaseCli(target, args)
  const out = `${r.stdout}\n${r.stderr}`
    .split('\n')
    .filter((l) => /Applying|Repaired|Finished|rror|Connecting/.test(l))
  for (const l of out) console.log('  ' + l.trim())
  return r.status
}

if (firstTime && run(['migration', 'repair', '--status', 'applied', '0000', '--db-url', url]) !== 0) {
  fail('не удалось отметить baseline — проверь пароль. Ничего не выполнено.')
}

// --- 5. применение ---------------------------------------------------------------------
if (run(['db', 'push', '--db-url', url, '--yes']) !== 0) {
  fail('миграция упала и откатилась целиком (каждый файл — одна транзакция). Смотри ошибку выше.')
}
console.log('✓ миграции применены')

// --- 6. проверки после ---------------------------------------------------------------------
console.log('\n— кто что может вызвать без входа')
const anon = node('check-anon-access.mjs', isProd ? ['--prod'] : [])
if (isProd) {
  console.log('\n— живая = тестовая?')
  node('check-db-equal.mjs')
} else {
  console.log('\n— типы под новую схему')
  node('check-types-drift.mjs', ['--write'])
  const typesChanged = spawnSync('git', ['diff', '--quiet', '--', 'src/lib/database.types.ts']).status !== 0
  if (typesChanged) console.log('  ⚠️ database.types.ts изменился — закоммить вместе с миграцией')
}
if (anon !== 0) fail('анониму открыто лишнее — см. выше')
console.log(`\n✓ готово (${target.label})`)
