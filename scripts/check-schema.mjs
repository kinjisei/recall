/**
 * Проверка docs/schema.sql ПЕРЕД заливкой в Supabase.
 * Ловит то, что ломает весь файл целиком:
 *   • случайные русские буквы в SQL-коде (файл часто открыт в редакторе —
 *     достаточно задеть клавиатуру: «not nulзаl» уронил заливку 24.07);
 *   • незакрытые долларовые кавычки функций ($$ / $fn$);
 *   • пустой или подозрительно короткий файл.
 * Запуск: node scripts/check-schema.mjs
 */
import { readFileSync } from 'node:fs'

const path = new URL('../docs/schema.sql', import.meta.url)
const src = readFileSync(path, 'utf8')
const lines = src.split('\n')
const problems = []

// --- 1. кириллица в коде (комментарии и строковые литералы не считаются) ---
const CYR = /[а-яА-ЯёЁ]/
lines.forEach((line, i) => {
  const code = line.split('--')[0].replace(/'[^']*'/g, "''")
  if (CYR.test(code)) problems.push(`строка ${i + 1}: русские буквы в SQL — ${line.trim().slice(0, 80)}`)
})

// --- 2. баланс долларовых кавычек ---
const tags = src.match(/\$[a-z_]*\$/gi) ?? []
const counts = new Map()
for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1)
for (const [tag, n] of counts) {
  if (n % 2 !== 0) problems.push(`непарный разделитель тела функции ${tag} (встречается ${n} раз)`)
}

// --- 3. размер ---
if (src.length < 10_000) problems.push(`файл подозрительно маленький (${src.length} символов) — не обрезан ли?`)

if (problems.length === 0) {
  console.log(`✓ schema.sql в порядке: ${lines.length} строк, ${counts.size} видов разделителей функций`)
  console.log('  Можно копировать целиком в Supabase → SQL Editor → Run.')
  process.exit(0)
}
console.log(`✗ Найдено проблем: ${problems.length}`)
for (const p of problems) console.log('  • ' + p)
process.exit(1)
