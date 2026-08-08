/**
 * Согласие клиента и сервера в сверке печатного ответа.
 *
 * Зачем. Правило нормализации живёт В ДВУХ местах: lib/text.ts на клиенте и
 * norm_typed в docs/schema.sql. Разойтись им нельзя — тогда ученик видит
 * «верно», а серверный пересчёт балла не засчитывает (такое уже случалось).
 * Скрипт берёт ТУ ЖЕ таблицу случаев, что и test-answermatches.mjs, и
 * прогоняет её через настоящий SQL.
 *
 * Схема выполняется в транзакции и откатывается, поэтому проверять можно ДО
 * заливки — то есть ровно тогда, когда это нужно.
 *
 * Запуск: node scripts/test-answermatches-sql.mjs
 * Нужен SUPABASE_ACCESS_TOKEN в .env.local (Management API).
 */
import { readFileSync } from 'node:fs'
import { CASES } from './test-answermatches.mjs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error('Нет SUPABASE_ACCESS_TOKEN в .env.local')
  process.exitCode = 1
  throw new Error('нет токена')
}

const ref = env.VITE_SUPABASE_URL.replace('https://', '').split('.')[0]
const schema = readFileSync(new URL('../docs/schema.sql', import.meta.url), 'utf8')

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
// Варианты через «/» сервер разбирает так же, как клиент: подходит любой.
const rows = CASES.map(
  ([given, answer], i) =>
    `select ${i} as i, coalesce(bool_or(public.norm_typed(v) = public.norm_typed(${q(given)})), false) as ok
       from unnest(string_to_array(${q(answer)}, '/')) as v`,
).join('\nunion all\n')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `begin;\n${schema}\nselect * from (\n${rows}\n) t order by i;\nrollback;`,
  }),
})
const body = await res.json()
if (!res.ok) {
  console.error('SQL не выполнился:', JSON.stringify(body).slice(0, 300))
  process.exitCode = 1
  throw new Error('sql')
}
const got = Array.isArray(body) ? body : (body.result ?? [])

let bad = 0
for (const [i, [given, answer, expected, note]] of CASES.entries()) {
  const server = got.find((r) => Number(r.i) === i)?.ok
  if (server !== expected) {
    bad++
    console.log(`✗ ${JSON.stringify(given)} vs ${JSON.stringify(answer)} — сервер: ${server}, клиент ждёт: ${expected} (${note})`)
  }
}
console.log(`\nСервер согласен с клиентом: ${CASES.length - bad}/${CASES.length}`)
process.exitCode = bad === 0 ? 0 : 1
