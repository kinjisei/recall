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
 * Нужен SUPABASE_ACCESS_TOKEN в .env.local. Прогон идёт на рабочей базе, но
 * обе транзакции откатываются — как в validate-schema-dryrun.mjs.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error('Нет SUPABASE_ACCESS_TOKEN в .env.local — сравнение невозможно.')
  process.exit(1)
}
const ref = env.VITE_SUPABASE_URL.replace('https://', '').split('.')[0]

/**
 * Слепок каталога одной строкой на объект. Формат «вид | имя | подробности»,
 * отсортирован — так расхождение читается глазами без инструментов сравнения.
 */
const SNAPSHOT = `
select line from (
  -- функции: имя, аргументы, ИСХОДНИК, security definer, search_path
  select format('FUNC | %s(%s) | definer=%s | cfg=%s | %s',
                p.proname,
                pg_get_function_identity_arguments(p.oid),
                p.prosecdef,
                coalesce(array_to_string(p.proconfig, ','), '-'),
                md5(p.prosrc)) as line
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
  union all
  -- политики RLS: кому, на что, с каким условием
  select format('POLICY | %s.%s | %s | %s | using=%s | check=%s',
                schemaname, tablename, policyname, cmd,
                md5(coalesce(qual, '-')), md5(coalesce(with_check, '-')))
    from pg_policies where schemaname = 'public'
  union all
  -- права на функции (именно тут живёт «а grant не потеряли?»)
  select format('GRANT-FN | %s | %s | %s', grantee, routine_name, privilege_type)
    from information_schema.role_routine_grants
   where routine_schema = 'public'
  union all
  -- права на таблицы
  select format('GRANT-TBL | %s | %s | %s', grantee, table_name, privilege_type)
    from information_schema.role_table_grants
   where table_schema = 'public'
  union all
  -- таблицы и колонки с типами и умолчаниями
  select format('COL | %s.%s | %s | null=%s | def=%s',
                table_name, column_name, data_type, is_nullable,
                coalesce(column_default, '-'))
    from information_schema.columns where table_schema = 'public'
  union all
  select format('INDEX | %s | %s', tablename, indexdef)
    from pg_indexes where schemaname = 'public'
  union all
  -- триггеры: на какой таблице и какую функцию зовут
  select format('TRIGGER | %s | %s | %s', c.relname, t.tgname, pr.proname)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc pr on pr.oid = t.tgfoid
   where n.nspname = 'public' and not t.tgisinternal
  union all
  select format('RLS | %s | enabled=%s', c.relname, c.relrowsecurity)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
) s order by line
`

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
