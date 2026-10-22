/**
 * Дата и время на экране — по Алматы, а не по часам устройства (PLAN.md
 * Ф2.17-4, 4г-2). Момент из базы, показанный через toLocaleDateString без
 * пояса, у телефона в чужом поясе съезжает на день: «Заявка отправлена»,
 * «Тариф действует до …», «вчера» в уведомлениях.
 *
 * На компьютере владельца пояс и так UTC+5, а TZ на Windows node не меняет —
 * проверка значений здесь ошибку не поймает. Поэтому сторож по тексту: в
 * src/ каждый toLocaleDateString / toLocaleTimeString и toLocaleString у
 * даты (`new Date(…)`) передаёт timeZone. Свой формат по Алматы — dateAt,
 * almatyTime (domains/schedule), dayLabel (domains/billing).
 *
 * «День ученика» (серия, план дня) считается по устройству намеренно — это
 * другие методы (getDate…), их сторож не трогает.
 * Чистый: без сети и базы. Краснеет на коде до 4г-2:
 *   node scripts/test-almaty-dates.mjs --ref 0d30a61
 * Запуск: node scripts/test-almaty-dates.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const refAt = process.argv.indexOf('--ref')
const REF = refAt !== -1 ? process.argv[refAt + 1] : null

let ok = 0
let failed = 0
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass || !detail ? '' : ` — ${detail}`}`)
  if (pass) ok++
  else failed++
}

/** Все .ts/.tsx в src (на ref — из git, иначе с диска). */
function files() {
  if (REF) {
    return execFileSync('git', ['ls-tree', '-r', '--name-only', REF, 'src'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.tsx?$/.test(f))
  }
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(name)) out.push(relative(ROOT, p).replace(/\\/g, '/'))
    }
  }
  walk(join(ROOT, 'src'))
  return out
}
const source = (f) => (REF ? execFileSync('git', ['show', `${REF}:${f}`], { cwd: ROOT, encoding: 'utf8' }) : readFileSync(join(ROOT, f), 'utf8'))

/** Аргументы вызова от открывающей скобки — до парной закрывающей. */
function callArgs(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')' && --depth === 0) return text.slice(open + 1, i)
  }
  return text.slice(open + 1)
}

// toLocaleDateString / toLocaleTimeString — всегда дата; toLocaleString — дата,
// только если вызвана прямо у new Date(…): у чисел («3 900 ₸») пояс не нужен
const CALL = /\.toLocale(?:Date|Time)String\(|new Date\([^()]*\)\.toLocaleString\(/g
const bad = []
let seen = 0
for (const f of files()) {
  const text = source(f)
  for (const m of text.matchAll(CALL)) {
    seen++
    const args = callArgs(text, m.index + m[0].length - 1)
    if (!/timeZone/.test(args)) bad.push(`${f}:${text.slice(0, m.index).split('\n').length}`)
  }
}

check('сторож видит вызовы дат (иначе он слеп)', seen > 0, `вызовов: ${seen}`)
check('каждая дата на экране — с поясом Алматы', bad.length === 0, bad.join(', '))

console.log(`\n${ok} ✓  ${failed} ✗`)
process.exit(failed ? 1 : 0)
