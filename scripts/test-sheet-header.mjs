/**
 * Заголовок шторки — общий `SheetHeader` (лист s4: заголовок 20 и
 * «закрыть» 44; в панели компьютера — строка под чертой и «Esc», d2-2;
 * PLAN.md Ф2.17-4д-2).
 *
 * До 4д-2 у 20 шторок шапка была своя: заголовок 18 вместо 20, своя кнопка
 * «закрыть» (закрывала без ухода шторки), а у шторок разбора, итогов раунда
 * и отзыва вместо заголовка — надпись 10 px капсом и никакого «закрыть».
 * Сторож по тексту: файл с `<Sheet` вне shared/ui берёт SheetHeader, своих
 * кнопок `aria-label="Закрыть"` вне shared/ui нет.
 * Чистый: без сети и базы. Краснеет на коде до 4д-2:
 *   node scripts/test-sheet-header.mjs --ref 6acbbbe
 * Запуск: node scripts/test-sheet-header.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const refAt = process.argv.indexOf('--ref')
const REF = refAt !== -1 ? process.argv[refAt + 1] : null

/** Шторка без общего заголовка — и почему. */
const OWN_LAYOUT = {
  'src/features/lessons/LessonPushAsk.tsx': 'просьба включить уведомления — по центру, значок над заголовком (макет u3)',
}

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
      .filter((f) => f.endsWith('.tsx'))
  }
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.tsx')) out.push(relative(ROOT, p).replace(/\\/g, '/'))
    }
  }
  walk(join(ROOT, 'src'))
  return out
}
const source = (f) => (REF ? execFileSync('git', ['show', `${REF}:${f}`], { cwd: ROOT, encoding: 'utf8' }) : readFileSync(join(ROOT, f), 'utf8'))

let sheets = 0
const bare = []
const ownClose = []
for (const f of files()) {
  if (f.startsWith('src/shared/ui/')) continue
  const text = source(f)
  if (/<Sheet\b/.test(text)) {
    sheets++
    if (!/\bSheetHeader\b/.test(text) && !OWN_LAYOUT[f]) bare.push(f)
  }
  const n = (text.match(/aria-label="Закрыть"/g) ?? []).length
  if (n) ownClose.push(`${f}: ${n}`)
}

check('сторож видит шторки (иначе он слеп)', sheets > 10, `шторок: ${sheets}`)
check('у каждой шторки — общий SheetHeader', bare.length === 0, bare.join(', '))
check('своих кнопок «Закрыть» нет — она у SheetHeader', ownClose.length === 0, ownClose.join(', '))

console.log(`\n${ok} ✓  ${failed} ✗`)
process.exit(failed ? 1 : 0)
