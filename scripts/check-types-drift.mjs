/**
 * Дрейф типов: совпадает ли src/lib/database.types.ts со схемой базы
 * (PLAN.md Ф1.2, архитектура §8).
 *
 * Зачем. Клиент типизирован этим файлом: .rpc() и .from() знают форму
 * данных, и расхождение «код ↔ база» ловит сборка, а не пользователь. Но
 * только пока файл свежий. К 27.09.2026 он отстал на 5 таблиц и 25 функций,
 * и код обходил это приведениями `supabase.rpc as unknown as …` — то есть
 * ошибку в имени функции или параметре не поймал бы уже никто. Когда файл
 * наконец обновили, сборка сразу нашла 5 мест, где код передавал null туда,
 * где по схеме параметр необязательный.
 *
 * Когда запускать: после каждой миграции на тестовой (с --write — и
 * закоммитить файл вместе с миграцией) и перед новой миграцией (без флага —
 * убедиться, что база не менялась мимо миграций).
 *
 * Запуск:
 *   node scripts/check-types-drift.mjs            # сверка с тестовой базой
 *   node scripts/check-types-drift.mjs --write    # перегенерировать файл
 *   node scripts/check-types-drift.mjs --prod     # сверка с живой (только чтение)
 * Генерация — Supabase CLI через Management API, Docker не нужен.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { ROOT, dbTarget, supabaseCli } from './_env.mjs'

const FILE = new URL('src/lib/database.types.ts', ROOT)
const lf = (s) => s.replace(/\r\n/g, '\n')

const target = dbTarget()
const r = supabaseCli(target, ['gen', 'types', 'typescript', '--project-id', target.ref, '--schema', 'public'])
if (r.status !== 0 || !r.stdout.includes('export type Database')) {
  console.error(`✗ не удалось сгенерировать типы (${target.label}):\n${r.stderr.slice(0, 800)}`)
  process.exit(1)
}
const fresh = lf(r.stdout)

if (process.argv.includes('--write')) {
  writeFileSync(FILE, fresh)
  console.log(`✓ src/lib/database.types.ts перегенерирован (${target.label})`)
  process.exit(0)
}

const current = lf(readFileSync(FILE, 'utf8'))
if (current === fresh) {
  console.log(`✓ типы совпадают со схемой (${target.label})`)
  process.exit(0)
}

/** Имена таблиц, представлений и функций — чтобы расхождение читалось словами. */
function names(src) {
  const section = (from, to) => {
    const a = src.indexOf(`    ${from}: {\n`)
    const b = src.indexOf(`\n    ${to}: {`, a)
    return a < 0 ? [] : [...src.slice(a, b).matchAll(/^ {6}([a-z_0-9]+): \{/gm)].map((m) => m[1])
  }
  return { таблицы: section('Tables', 'Views'), представления: section('Views', 'Functions'), функции: section('Functions', 'Enums') }
}
const was = names(current)
const now = names(fresh)
console.log(`✗ типы разошлись со схемой (${target.label})`)
let named = false
for (const kind of Object.keys(now)) {
  const missing = now[kind].filter((n) => !was[kind].includes(n))
  const extra = was[kind].filter((n) => !now[kind].includes(n))
  if (missing.length) console.log(`  в файле нет (${kind}): ${missing.join(', ')}`)
  if (extra.length) console.log(`  в базе нет (${kind}): ${extra.join(', ')}`)
  named ||= missing.length > 0 || extra.length > 0
}
if (!named) console.log('  имена совпадают — разошлись колонки, параметры или типы')
console.log('\nПерегенерировать: node scripts/check-types-drift.mjs --write')
process.exit(1)
