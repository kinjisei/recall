/**
 * Тестовая база = живая? Сверка каталогов (PLAN.md Ф1.2, архитектура §8).
 *
 * Зачем. Тестовая база нужна, чтобы проверки на ней значили то же, что на
 * проде. Это верно, только пока их схемы совпадают. Разъедутся (миграцию
 * применили только на одной, кто-то поправил прод руками в панели) — и
 * зелёный смоук на тестовой перестанет что-либо обещать.
 *
 * Как. Снимаем слепок каталога обеих баз (scripts/_catalog.mjs — функции с
 * исходниками, права вплоть до колонок, политики, ограничения, триггеры) и
 * печатаем расхождения. Живая база только читается: токен прода не умеет
 * писать (Ф0.2). Рядом — история миграций обеих баз: если на тестовой есть
 * миграция, которой нет на живой, её след в расхождениях ожидаем.
 *
 * Когда: после применения миграции на проде (должно стать 0) и перед ней
 * (расходиться может ровно то, что делает ждущая миграция).
 *
 * Запуск: node scripts/check-db-equal.mjs
 */
import { CATALOG_SNAPSHOT, diffSnapshots } from './_catalog.mjs'
import { dbTarget, runSql } from './_env.mjs'

const test = dbTarget([])
const prod = dbTarget(['--prod'])

/** Применённые миграции; у базы без истории (прод до первой миграции) — пусто. */
async function history(target) {
  // два запроса, а не один с условием: Postgres проверяет имя таблицы ещё при
  // разборе, и на базе без истории упал бы весь запрос
  const [has] = await runSql(
    target,
    "select to_regclass('supabase_migrations.schema_migrations') is not null as yes",
  )
  if (!has?.yes) return '(истории миграций нет)'
  const rows = await runSql(
    target,
    `select string_agg(version || '_' || coalesce(name, ''), ', ' order by version) as list
       from supabase_migrations.schema_migrations`,
  )
  return rows[0]?.list || '(пусто)'
}

const [a, b, ha, hb] = await Promise.all([
  runSql(test, CATALOG_SNAPSHOT),
  runSql(prod, CATALOG_SNAPSHOT),
  history(test),
  history(prod),
])
const onTest = a.map((r) => r.line)
const onProd = b.map((r) => r.line)
console.log(`Миграции — тестовая: ${ha}`)
console.log(`Миграции — живая:    ${hb}`)
console.log(`Объектов: тестовая ${onTest.length}, живая ${onProd.length}`)

const { onlyA, onlyB } = diffSnapshots(onTest, onProd)
if (!onlyA.length && !onlyB.length) {
  console.log('\n✓ Каталоги совпадают: 0 расхождений.')
  process.exit(0)
}
const show = (title, list) => {
  if (!list.length) return
  console.log(`\n${title} (${list.length}):`)
  for (const l of list.slice(0, 40)) console.log('  ' + l)
  if (list.length > 40) console.log(`  … ещё ${list.length - 40}`)
}
show('✗ Только на тестовой', onlyA)
show('✗ Только на живой', onlyB)
console.log('\nЕсли на тестовой есть миграция, которой нет на живой, — это её след.')
console.log('Иначе базы разъехались: смоуки на тестовой больше не обещают прод.')
process.exit(1)
