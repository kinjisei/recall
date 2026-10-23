/**
 * Ошибка действия — общим `ErrorText` (shared/ui/ErrorText.tsx, PLAN.md
 * Ф2.17-4д-1), а не своим абзацем `<p className="… text-danger …">`.
 *
 * До 4д-1 своих абзацев было 65: три разных красных (обычный `text-danger`
 * мелким текстом в светлой теме — 4,4 : 1, ниже нормы), `role="alert"` через
 * раз, а отказ сервера «на бесплатном тарифе это 5 ⚡ в день» печатался
 * символом вместо значка энергии. Сторож по тексту: в src/ вне shared/ui
 * абзаца с `text-danger` нет, кроме мест, где красный — не ошибка.
 * Чистый: без сети и базы. Краснеет на коде до 4д-1:
 *   node scripts/test-error-text.mjs --ref 52d2f9a
 * Запуск: node scripts/test-error-text.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const refAt = process.argv.indexOf('--ref')
const REF = refAt !== -1 ? process.argv[refAt + 1] : null

/** Красный абзац, который не ошибка: файл → сколько и почему. */
const NOT_ERRORS = {
  'src/features/grammar/IrregularVerbsSection.tsx': [1, '«Правильно: go — went — gone» после неверного ответа в тренажёре'],
  'src/features/writing/WritingGradeView.tsx': [1, 'зачёркнутое «было» в разборе письма'],
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

const own = []
const pale = []
let seen = 0
for (const f of files()) {
  if (f.startsWith('src/shared/ui/')) continue
  const text = source(f)
  const n = (text.match(/<p\b[^>]*text-danger[^>]*>/g) ?? []).length
  seen += n
  const allowed = NOT_ERRORS[f]?.[0] ?? 0
  if (n > allowed) own.push(`${f}: ${n - allowed}`)
  // обычный danger — заливка кнопки и значок; у текста — danger-strong (контраст 4,5 : 1)
  const p = (text.match(/text-danger(?=["' `])/g) ?? []).length
  if (p) pale.push(`${f}: ${p}`)
}

check('сторож видит красные абзацы (иначе он слеп)', seen > 0, `найдено: ${seen}`)
check('ошибки — общим ErrorText, а не своим абзацем', own.length === 0, own.join(', '))
check('красный текст — danger-strong, а не бледный danger (4,4 : 1 в светлой теме)', pale.length === 0, pale.join(', '))
const errorText = readFileSync(join(ROOT, 'src/shared/ui/ErrorText.tsx'), 'utf8')
check('ErrorText: тревога для чтения с экрана, danger-strong, «⚡» значком', /role="alert"/.test(errorText) && /text-danger-strong/.test(errorText) && /BoltText/.test(errorText))

console.log(`\n${ok} ✓  ${failed} ✗`)
process.exit(failed ? 1 : 0)
