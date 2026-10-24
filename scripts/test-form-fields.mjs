/**
 * Поле формы — стилем листа s3 (`fieldClass` из shared/ui/TextField, им же
 * `TextField` и `SearchField`), а не своим (PLAN.md Ф2.17-4д-2).
 *
 * До 4д-2 своих полей было около 30: рамка tint вместо control-line,
 * скругления xl и lg, `text-sm` и размеры в пикселях, поле количества
 * высотой 36 (цель касания — 44), фокус то рамкой, то кольцом; у шести
 * поисков — шесть видов. Сторож по тексту: у <input>/<textarea> вне
 * shared/ui с подложкой поля (`bg-input`) или своей рамкой есть
 * `fieldClass`, кроме мест, где поле особое — и почему.
 * Чистый: без сети и базы. Краснеет на коде до 4д-2:
 *   node scripts/test-form-fields.mjs --ref 6acbbbe
 * Запуск: node scripts/test-form-fields.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const refAt = process.argv.indexOf('--ref')
const REF = refAt !== -1 ? process.argv[refAt + 1] : null

/** Особые поля: файл → сколько и почему. */
const OWN = {
  'src/components/exercises.tsx': [1, 'ответ в упражнении: цвет «верно / неверно» — сам ответ'],
  'src/features/words/DictationMode.tsx': [1, 'ответ в диктанте: то же'],
  'src/features/flashcards/WordCheckRunner.tsx': [1, 'ответ при перепроверке слов: то же'],
  'src/features/writing/WritingPage.tsx': [1, 'редактор письма: лист бумаги'],
  'src/features/writing/QuickWriteCheck.tsx': [1, 'редактор быстрой проверки: то же'],
  'src/features/writing/WritingReviewScreen.tsx': [1, 'правка в разборе письма — в строке текста'],
  'src/features/teacher/ReviewScreen.tsx': [1, 'комментарий к ответу — по макету d7-2'],
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

// экраны входа — своё «стекло» (authUi: inputClass), это не поля приложения
const SKIP = (f) => f.startsWith('src/shared/ui/') || f.startsWith('src/features/auth/')

/** Тег целиком: до `>` вне фигурных скобок и кавычек (в onChange={(e) => …} своя `>`). */
function tagAt(text, start) {
  let depth = 0
  let quote = null
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return text.slice(start, i + 1)
  }
  return text.slice(start)
}
/** Значение className: "…" или {…} с парными скобками. */
function classOf(tag) {
  const at = tag.indexOf('className=')
  if (at < 0) return ''
  const v = tag.slice(at + 10)
  if (v[0] === '"') return v.slice(0, v.indexOf('"', 1) + 1)
  let depth = 0
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '{') depth++
    else if (v[i] === '}' && --depth === 0) return v.slice(0, i + 1)
  }
  return v
}

const own = []
let seen = 0
for (const f of files()) {
  if (SKIP(f)) continue
  const text = source(f)
  let n = 0
  for (const m of text.matchAll(/<(input|textarea)\b/g)) {
    const tag = tagAt(text, m.index)
    const cls = classOf(tag)
    if (/type="(checkbox|radio|file|range|hidden)"/.test(tag)) continue
    // fieldClass прямо в классе или константа экрана, собранная из него
    if (/fieldClass|CODE_FIELD/.test(cls) || /^\{(input|inputCls|inputClass)\}$/.test(cls)) continue
    if (/bg-input|border|ring-1|inset-ring/.test(cls)) n++
  }
  seen += n
  const allowed = OWN[f]?.[0] ?? 0
  if (n > allowed) own.push(`${f}: ${n - allowed}`)
}

check('сторож видит поля со своим стилем (особые — тоже поля)', seen > 0, `найдено: ${seen}`)
check('поля форм — fieldClass, а не свой стиль', own.length === 0, own.join(', '))

console.log(`\n${ok} ✓  ${failed} ✗`)
process.exit(failed ? 1 : 0)
