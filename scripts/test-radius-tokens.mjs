/**
 * Радиусы — только токенами (shared/ui/tokens.css, PLAN.md Ф2.17-4д-3):
 * `rounded-mark` · `tag` · `tile` · `control-sm` · `control` · `control-lg` ·
 * `row` · `card` · `sheet` · `device` и `rounded-full`.
 *
 * До 4д-3 в src/ было 287 сырых радиусов: `rounded-lg` (8), `-xl` (12),
 * `-2xl` (16), `-3xl` (24), голый `rounded` (4), `-md`, `-sm`, `-[2.75rem]`.
 * Одинаковые по роли элементы расходились (поле 8 рядом с полем 16, карточка
 * 16 рядом с карточкой 24), а перекрасить роль разом было нельзя. Сторож:
 *  1) сырого радиуса в классах нет (и в комментариях — там он устаревает);
 *  2) имя после `rounded-` есть среди токенов — опечатку Tailwind молча не
 *     рисует, и угол становится прямым;
 *  3) `border-radius` в CSS — переменной `--radius-*` (кроме самих токенов);
 *  4) `borderRadius` в style — только у конфетти (частицы 2 px и круги);
 *  5) шкала растёт: mark < tag < tile < … < device;
 *  6) смоуки и снимки не ищут элементы по классу радиуса: в 4д-3
 *     `smoke-features` и `smoke-motion` искали варианты ответа как
 *     `button.rounded-xl` и покраснели от смены скругления — метка
 *     вариантов `data-key`.
 * Чистый: без сети и базы. Краснеет на коде до 4д-3:
 *   node scripts/test-radius-tokens.mjs --ref 47434ed
 * Запуск: node scripts/test-radius-tokens.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const refAt = process.argv.indexOf('--ref')
const REF = refAt !== -1 ? process.argv[refAt + 1] : null
const TOKENS_CSS = 'src/shared/ui/tokens.css'

/** borderRadius в style: файл → почему можно. */
const INLINE_OK = { 'src/shared/ui/Confetti.tsx': 'частицы конфетти: круг или квадратик 2 px' }

let ok = 0
let failed = 0
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass || !detail ? '' : ` — ${detail}`}`)
  if (pass) ok++
  else failed++
}

function files() {
  if (REF) {
    return execFileSync('git', ['ls-tree', '-r', '--name-only', REF, 'src'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.(tsx|ts|css)$/.test(f))
  }
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx|ts|css)$/.test(name)) out.push(relative(ROOT, p).replace(/\\/g, '/'))
    }
  }
  walk(join(ROOT, 'src'))
  return out
}
const source = (f) => (REF ? execFileSync('git', ['show', `${REF}:${f}`], { cwd: ROOT, encoding: 'utf8' }) : readFileSync(join(ROOT, f), 'utf8'))

// Токены берём из текущего tokens.css: на старом коде сторож сверяет с новой шкалой.
const tokensCss = readFileSync(join(ROOT, TOKENS_CSS), 'utf8')
const scale = [...tokensCss.matchAll(/--radius-([a-z-]+):\s*([\d.]+)rem/g)].map((m) => ({ name: m[1], px: Number(m[2]) * 16 }))
const names = new Set([...scale.map((t) => t.name), 'full', 'none'])

const SIDE = '(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?'
const CLASS = new RegExp(`(?<![\\w-])rounded${SIDE}(?:-([a-z0-9]+(?:-[a-z0-9]+)*|\\[[^\\]\\s]+\\]))?(?![\\w\\[-])`, 'g')
const lineOf = (text, i) => text.slice(0, i).split('\n').length

const raw = []
const unknown = []
const cssRaw = []
const inline = []
let seen = 0
for (const f of files()) {
  const text = source(f)
  if (f.endsWith('.css')) {
    if (f === TOKENS_CSS) continue
    for (const m of text.matchAll(/border(?:-[a-z]+)*-radius:\s*([^;]+);/g)) {
      if (!/^(var\(--radius-[a-z-]+\)|0|50%|inherit)$/.test(m[1].trim())) cssRaw.push(`${f}:${lineOf(text, m.index)} ${m[1].trim()}`)
    }
    continue
  }
  for (const m of text.matchAll(CLASS)) {
    seen++
    const name = m[1]
    if (!name || name.startsWith('[') || /^(xs|sm|md|lg|xl|\dxl)$/.test(name)) raw.push(`${f}:${lineOf(text, m.index)} ${m[0]}`)
    else if (!names.has(name)) unknown.push(`${f}:${lineOf(text, m.index)} ${m[0]}`)
  }
  if (/borderRadius\s*:/.test(text) && !INLINE_OK[f]) inline.push(f)
}

check('сторож видит радиусы (иначе он слеп)', seen > 100, `найдено: ${seen}`)
check('сырых радиусов нет — только токены', raw.length === 0, `${raw.length}: ${raw.slice(0, 12).join(', ')}${raw.length > 12 ? ' …' : ''}`)
check('имя радиуса есть среди токенов (опечатку Tailwind молча не рисует)', unknown.length === 0, unknown.join(', '))
check('border-radius в CSS — переменной --radius-*', cssRaw.length === 0, cssRaw.join(', '))
check('borderRadius в style — только у конфетти', inline.length === 0, inline.join(', '))
const scripts = (REF
  ? execFileSync('git', ['ls-tree', '--name-only', REF, 'scripts/'], { cwd: ROOT, encoding: 'utf8' }).split('\n').map((p) => p.replace(/^scripts\//, ''))
  : readdirSync(join(ROOT, 'scripts'))
).filter((n) => /^(smoke|shots|shot)-.+\.mjs$/.test(n))
const byRadius = scripts.filter((n) => /rounded-/.test(source(`scripts/${n}`)))
check('проверки ищут элементы не по классу радиуса', scripts.length > 10 && byRadius.length === 0, scripts.length > 10 ? byRadius.join(', ') : `скриптов: ${scripts.length}`)
const order = ['mark', 'tag', 'tile', 'control-sm', 'control', 'control-lg', 'row', 'card', 'sheet', 'device']
const px = order.map((n) => scale.find((t) => t.name === n)?.px)
check('шкала токенов полна и растёт', px.every((v, i) => v !== undefined && (i === 0 || v > px[i - 1])), order.map((n, i) => `${n} ${px[i]}`).join(' · '))

console.log(`\n${ok} ✓  ${failed} ✗`)
process.exit(failed ? 1 : 0)
