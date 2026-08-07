/**
 * Сухой прогон docs/schema.sql: выполняет файл ЦЕЛИКОМ в транзакции и
 * откатывает её. Ничего в базе не остаётся — но ловятся ошибки, которые видны
 * только при выполнении: порядок операторов (функция ссылается на колонку,
 * которую добавляют ниже), опечатки в SQL, несуществующие поля.
 *
 * Зачем: check-schema.mjs проверяет файл текстом и такие вещи пропускает.
 * Дважды подряд владелец получал «ERROR: column ... does not exist» уже в
 * SQL Editor — этот скрипт закрывает такой класс ошибок до заливки.
 *
 * Запуск: node scripts/validate-schema-dryrun.mjs
 * Нужен SUPABASE_ACCESS_TOKEN в .env.local (токен Supabase Management API).
 *
 * ⚠️ Прогон идёт на РАБОЧЕЙ базе: транзакция откатывается, но на время
 * выполнения берутся блокировки таблиц. На нашем объёме это доли секунды,
 * при больших данных так делать не стоит.
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error('Нет SUPABASE_ACCESS_TOKEN в .env.local — сухой прогон невозможен.')
  process.exit(1)
}

const ref = env.VITE_SUPABASE_URL.replace('https://', '').split('.')[0]
const sql = readFileSync(new URL('../docs/schema.sql', import.meta.url), 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: `begin;\n${sql}\nrollback;` }),
})

const body = await res.text()
// exitCode вместо process.exit(): на Windows немедленный выход при живых
// сокетах fetch роняет node с ассертом libuv
if (res.ok) {
  console.log(`✓ schema.sql выполняется без ошибок (${Math.round(sql.length / 1024)} КБ, откачено)`)
  console.log('  Можно заливать в Supabase → SQL Editor.')
  process.exitCode = 0
} else {
  console.error('✗ schema.sql НЕ выполняется:')
  try {
    const j = JSON.parse(body)
    console.error('  ' + (j.message ?? body))
  } catch {
    console.error('  ' + body.slice(0, 800))
  }
  process.exitCode = 1
}
