/**
 * Доказательство, что две версии docs/schema.sql дают ОДНУ И ТУ ЖЕ базу.
 *
 * Зачем. Файл дорос до 4700 строк, треть которых — перекрытые версии функций.
 * Их хочется убрать, но переписывать схему «на глаз» нельзя: одна потерянная
 * строка `grant` — и функция перестаёт работать у всех, одна потерянная
 * `policy` — и это дыра в доступе, которую заметят не сразу. Проверить такое
 * чтением файла на 200 КБ невозможно.
 *
 * Как. Postgres сам знает, что у него внутри. Каждую версию файла выполняем в
 * транзакции, снимаем слепок каталога (функции с исходниками, политики, гранты,
 * таблицы, колонки, индексы, триггеры) и откатываем. Совпали слепки — правка
 * доказана безопасной. Разошлись — печатаем ровно, что потеряно или добавлено.
 *
 * ⚠️ Сравниваем ИСХОДНИКИ функций (prosrc), а не факт их существования: иначе
 * «функция на месте» проходило бы и для пустой заглушки.
 *
 * Запуск:
 *   node scripts/check-schema-equal.mjs                    # HEAD против рабочей копии
 *   node scripts/check-schema-equal.mjs старый.sql новый.sql
 *
 * Прогон — на ТЕСТОВОЙ базе (scripts/_env.mjs), обе транзакции откатываются.
 * На живой не работает намеренно: токен прода — только чтение (Ф0.2).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { CATALOG_SNAPSHOT } from './_catalog.mjs'
import { scriptEnv } from './_env.mjs'

const env = scriptEnv()
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error('Нет SUPABASE_ACCESS_TOKEN в .env.local — сравнение невозможно.')
  process.exit(1)
}
const ref = env.VITE_SUPABASE_URL.replace('https://', '').split('.')[0]

// Слепок каталога — общий (scripts/_catalog.mjs): с колоночными грантами и
// ограничениями, на pg_catalog. Прежний собственный их не снимал.
const SNAPSHOT = CATALOG_SNAPSHOT

async function snapshot(sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: `begin;\n${sql}\n${SNAPSHOT};\nrollback;` }),
  })
  const body = await res.text()
  if (!res.ok) {
    console.error(`✗ ${label}: schema.sql не выполняется`)
    try {
      console.error('  ' + (JSON.parse(body).message ?? body).slice(0, 600))
    } catch {
      console.error('  ' + body.slice(0, 600))
    }
    process.exit(1)
  }
  const rows = JSON.parse(body)
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error(`✗ ${label}: слепок пустой — сравнивать нечего`)
    process.exit(1)
  }
  return rows.map((r) => r.line)
}

// --- какие версии сравниваем ------------------------------------------------
const [a, b] = process.argv.slice(2)
let oldSql
let newSql
let oldLabel
if (a && b) {
  oldSql = readFileSync(a, 'utf8')
  newSql = readFileSync(b, 'utf8')
  oldLabel = a
} else {
  // По умолчанию: то, что в последнем коммите, против рабочей копии.
  oldSql = execFileSync('git', ['show', 'HEAD:docs/schema.sql'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  newSql = readFileSync(new URL('../docs/schema.sql', import.meta.url), 'utf8')
  oldLabel = 'HEAD'
}

console.log(`Сравниваю: ${oldLabel} → рабочая копия`)
const before = await snapshot(oldSql, 'старая версия')
const after = await snapshot(newSql, 'новая версия')

const setBefore = new Set(before)
const setAfter = new Set(after)
const lost = before.filter((l) => !setAfter.has(l))
const added = after.filter((l) => !setBefore.has(l))

console.log(`  объектов было: ${before.length}, стало: ${after.length}`)

if (lost.length === 0 && added.length === 0) {
  console.log('\n✓ Базы идентичны: ни одного расхождения. Правка безопасна.')
  process.exit(0)
}

if (lost.length) {
  console.log(`\n✗ ПОТЕРЯНО (${lost.length}):`)
  for (const l of lost.slice(0, 40)) console.log('  − ' + l)
  if (lost.length > 40) console.log(`  … ещё ${lost.length - 40}`)
}
if (added.length) {
  console.log(`\n✗ ПОЯВИЛОСЬ (${added.length}):`)
  for (const l of added.slice(0, 40)) console.log('  + ' + l)
  if (added.length > 40) console.log(`  … ещё ${added.length - 40}`)
}
console.log('\nПравка меняет базу — так сжимать нельзя.')
process.exit(1)
