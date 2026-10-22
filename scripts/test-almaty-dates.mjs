/**
 * Время продукта — по Алматы, а не по часам устройства (PLAN.md Ф2.17-4,
 * 4г-2; решение владельца 22.10.2026, src/shared/lib/almaty.ts). Две стороны:
 *
 *   • показ: момент из базы через toLocaleDateString без пояса у телефона в
 *     чужом поясе съезжает на день («Заявка отправлена», «Тариф действует
 *     до …», «вчера» в уведомлениях);
 *   • счёт дня: серия, неделя точек, план дня, срок домашки и «к повторению
 *     завтра» брали «сегодня» и полночь методами местного времени (getDate,
 *     setHours…) или вовсе по Гринвичу (toISOString().slice(0, 10)).
 *
 * На компьютере владельца пояс и так UTC+5, а TZ на Windows node не меняет —
 * проверка значений здесь ошибку не поймает. Поэтому сторож по тексту: в
 * src/ каждый toLocaleDateString / toLocaleTimeString и toLocaleString у
 * даты (`new Date(…)`) передаёт timeZone, а методов местного времени и дня
 * через toISOString нет совсем — день и полночь берутся из shared/lib/almaty
 * (almatyToday, almatyInstant), подписи — dateAt, almatyTime, dayLabel.
 * Исключение — shared/lib/days: там toISOString — арифметика номеров дней,
 * без часов и поясов.
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
// местное время устройства и «день по Гринвичу»; 'T00:00:00' без Z и пояса —
// полночь по часам устройства
const LOCAL = /\.(?:get|set)(?:Hours|Minutes|Date|Day|Month|FullYear)\(|\.getTimezoneOffset\(|toISOString\(\)\.(?:slice\(0, ?10\)|split\('T'\))|new Date\(\s*[\w.]+\s*,|T\d\d:\d\d(?::\d\d)?['"`]/g
const CALENDAR_MATH = 'src/shared/lib/days.ts'
const lineOf = (text, at) => text.slice(0, at).split('\n').length
/** Комментарии — пробелами той же длины: строки и позиции не сдвигаются. */
const code = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, (c) => ' '.repeat(c.length))

const bad = []
const local = []
let seen = 0
for (const f of files()) {
  const text = source(f)
  for (const m of text.matchAll(CALL)) {
    seen++
    const args = callArgs(text, m.index + m[0].length - 1)
    if (!/timeZone/.test(args)) bad.push(`${f}:${lineOf(text, m.index)}`)
  }
  if (f === CALENDAR_MATH) continue
  for (const m of code(text).matchAll(LOCAL)) local.push(`${f}:${lineOf(text, m.index)} ${m[0]}`)
}

check('сторож видит вызовы дат (иначе он слеп)', seen > 0, `вызовов: ${seen}`)
check('каждая дата на экране — с поясом Алматы', bad.length === 0, bad.join(', '))
check('день и полночь — из shared/lib/almaty, без местного времени и toISOString', local.length === 0, local.join(', '))

console.log(`\n${ok} ✓  ${failed} ✗`)
process.exit(failed ? 1 : 0)
