/**
 * Что может вызвать НЕВОШЕДШИЙ человек. Спрашиваем живую базу, а не файл.
 *
 * Зачем отдельной проверкой. В schema.sql есть общий
 * `revoke execute on all functions … from public, anon`, но он действует на
 * функции, существующие на тот момент. Любая функция, объявленная НИЖЕ, молча
 * получает права по умолчанию — PUBLIC от Postgres и anon от настроек Supabase.
 * Так дважды прошли мимо: submit_word_check и choose_homework_item.
 *
 * Заметить это по файлу почти невозможно: рядом с такой функцией стоит
 * аккуратный `grant … to authenticated`, и выглядит она правильнее многих. А на
 * повторной заливке след и вовсе пропадает — `create or replace` сохраняет
 * права существующей функции, поэтому однажды закрытая остаётся закрытой, и
 * открытой оказывается только самая свежая.
 *
 * Поэтому спрашиваем каталог: кто на самом деле может вызвать что.
 * В самой схеме класс закрыт финальным блоком-страховкой; эта проверка —
 * независимый свидетель, что страховка выполнена и никто её не обошёл.
 *
 * Запуск: node scripts/check-anon-access.mjs
 * Нужен SUPABASE_ACCESS_TOKEN в .env.local.
 */
import { readFileSync } from 'node:fs'

/**
 * ЕДИНСТВЕННОЕ разрешённое анониму. Добавлять сюда — осознанное решение:
 * функция станет вызываемой из интернета кем угодно и без ограничений.
 * track_event пишет визиты ДО регистрации, без него у воронки нет знаменателя.
 */
const ALLOWED = new Set(['track_event'])

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error('Нет SUPABASE_ACCESS_TOKEN в .env.local — проверить права нечем.')
  process.exit(1)
}
const ref = env.VITE_SUPABASE_URL.replace('https://', '').split('.')[0]

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(body.slice(0, 500))
  return JSON.parse(body)
}

// ⚠️ Читаем pg_proc.proacl, а не information_schema: у функции без явных прав
// acl пустой (null), и это означает «действует умолчание», то есть PUBLIC
// МОЖЕТ её звать. information_schema такую строку просто не покажет, и
// проверка была бы зелёной именно в самом опасном случае.
const rows = await q(`
  select p.proname                                   as name,
         pg_get_function_identity_arguments(p.oid)   as args,
         p.proacl is null                            as acl_default,
         coalesce(array_to_string(p.proacl, ' | '), '') as acl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
   order by p.proname
`)

/**
 * Кто имеет EXECUTE по одной записи acl.
 *
 * ⚠️ Формат aclitem — «получатель=права/выдавший», и PUBLIC записывается ПУСТЫМ
 * получателем: «=X/postgres». Первая версия искала подстроку «=X/» — она есть в
 * любой записи («authenticated=X/postgres»), и проверка объявила дырявыми все 78
 * функций разом. Разбираем запись, а не ищем подстроку в строке целиком.
 */
const grantee = (item) => item.slice(0, item.indexOf('='))
const hasExec = (item) => item.slice(item.indexOf('=') + 1, item.indexOf('/')).includes('X')

const bad = []
for (const r of rows) {
  const items = r.acl ? r.acl.split(' | ') : []
  const publicExec =
    r.acl_default || items.some((i) => grantee(i) === '' && hasExec(i))
  const anonExec = items.some((i) => grantee(i) === 'anon' && hasExec(i))
  if (!publicExec && !anonExec) continue
  if (ALLOWED.has(r.name)) continue
  bad.push({
    ...r,
    why: r.acl_default
      ? 'прав нет вовсе → действует умолчание PUBLIC'
      : [publicExec && 'открыта PUBLIC', anonExec && 'открыта anon'].filter(Boolean).join(' и ') +
        `: ${r.acl}`,
  })
}

console.log(`Функций в схеме public: ${rows.length}`)
console.log(`Разрешено анониму намеренно: ${[...ALLOWED].join(', ')}`)

// Проверка обязана краснеть и в обратную сторону: если разрешённую функцию
// закрыть, визиты до регистрации молча перестанут считаться, и воронка в
// /admin потеряет знаменатель — то есть сломается ровно так, как никто не
// заметит.
const openToAnon = new Set(
  rows
    .filter((r) => {
      const items = r.acl ? r.acl.split(' | ') : []
      return r.acl_default || items.some((i) => ['', 'anon'].includes(grantee(i)) && hasExec(i))
    })
    .map((r) => r.name),
)
const missing = [...ALLOWED].filter((n) => !openToAnon.has(n))

if (missing.length > 0) {
  console.error(`\n✗ Анониму НЕДОСТУПНО то, что должно быть: ${missing.join(', ')}`)
  console.error('  Визиты до регистрации перестанут считаться, и воронка потеряет знаменатель.')
  process.exitCode = 1
} else if (bad.length === 0) {
  console.log('\n✓ Больше анониму не доступно ничего.')
} else {
  console.error(`\n✗ Аноним может вызвать лишнее (${bad.length}):`)
  for (const b of bad) console.error(`  ${b.name}(${b.args})\n      ${b.why}`)
  console.error(
    '\nПочини в docs/schema.sql и перезалей: финальный блок-страховка в конце файла\n' +
      'должен закрывать всё, кроме track_event. Если функция ДОЛЖНА быть публичной —\n' +
      'добавь её в ALLOWED здесь же, осознанно.',
  )
  process.exitCode = 1
}
