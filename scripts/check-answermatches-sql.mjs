/**
 * Согласие клиента и сервера в сверке печатного ответа.
 *
 * Зачем. Правило нормализации живёт В ДВУХ местах: lib/text.ts на клиенте и
 * norm_typed в базе (supabase/migrations). Разойтись им нельзя — тогда ученик
 * видит «верно», а серверный пересчёт балла не засчитывает (такое уже
 * случалось). Скрипт берёт ТУ ЖЕ таблицу случаев, что и test-answermatches.mjs,
 * и прогоняет её через настоящую norm_typed в базе.
 *
 * Когда: после миграции, меняющей norm_typed, на ТЕСТОВОЙ базе — то есть до
 * выкатки на прод (порядок деплоя: тестовая → проверки → прод).
 *
 * Запуск: node scripts/check-answermatches-sql.mjs   (только тестовая база:
 *   на живой norm_typed закрыта даже для роли «только чтение» — так задумано,
 *   а после миграции на тестовой стоит ровно та же функция)
 * Имя check-*, а не test-*: ходит в базу, поэтому в CI не входит
 * (там запускаются все test-*.mjs по шаблону — только чистые тесты).
 */
import { CASES } from './test-answermatches.mjs'
import { scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('На живой базе norm_typed закрыта даже для чтения (так задумано) —')
  console.error('проверка идёт на тестовой, где после миграции та же функция.')
  process.exit(2)
}

const env = scriptEnv()
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error('Нет SUPABASE_ACCESS_TOKEN в .env.local')
  process.exitCode = 1
  throw new Error('нет токена')
}

const ref = env.VITE_SUPABASE_URL.replace('https://', '').split('.')[0]

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
    query: `select * from (\n${rows}\n) t order by i;`,
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
