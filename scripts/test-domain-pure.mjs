/**
 * Домены — без действий при загрузке (архитектура §1; PLAN.md Ф2.9).
 *
 * Сборка помечает модули src/domains/ как «без побочных действий»
 * (vite.config.ts → treeshake.moduleSideEffects): так сборщик не тащит в
 * стартовый бандл всё, что перечисляет «дверь» домена (index.ts), — Главная
 * берёт из domains/schedule уроки ученика, и без пометки к каждому ученику
 * уезжало бы всё учительское расписание. Цена пометки: модуль домена, который
 * что-то ДЕЛАЕТ при импорте (регистрирует, пишет в window, импортирует файл
 * ради действия), сборщик вправе выкинуть — и это сломается молча, только в
 * сборке. Этот тест не пускает такие модули:
 *   • верхнеуровневое выражение (`registerX()`, `window.a = 1`) — нельзя;
 *   • импорт без имён (`import './x'`) — нельзя;
 *   • объявления (function, const = …, class, type, export) — можно.
 * Чистый: только чтение исходников.
 * Запуск: node scripts/test-domain-pure.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

const ROOT = join(import.meta.dirname, '..')
const DOMAINS = join(ROOT, 'src', 'domains')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

/** Что модуль делает при загрузке: строки с номером и текстом. */
export function loadTimeEffects(path, text) {
  const src = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const out = []
  for (const st of src.statements) {
    const bad =
      ts.isExpressionStatement(st) ||
      (ts.isImportDeclaration(st) && !st.importClause) ||
      ts.isIfStatement(st) || ts.isForStatement(st) || ts.isForOfStatement(st) || ts.isWhileStatement(st) || ts.isTryStatement(st)
    if (bad) out.push(`${src.getLineAndCharacterOfPosition(st.getStart(src)).line + 1}: ${st.getText(src).split('\n')[0].slice(0, 80)}`)
  }
  return out
}

let fail = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}

const files = walk(DOMAINS)
const found = files.flatMap((f) => loadTimeEffects(f, readFileSync(f, 'utf8')).map((e) => `${relative(ROOT, f).split(sep).join('/')}:${e}`))
check(`домены (${files.length} файлов) ничего не делают при загрузке`, found.length === 0, found.join(' | '))

// сторож умеет краснеть
check('ловит вызов при загрузке', loadTimeEffects('x.ts', "export const a = 1\nregisterThing(a)\n").length === 1)
check('ловит запись в window', loadTimeEffects('x.ts', 'window.recall = {}\n').length === 1)
check('ловит импорт ради действия', loadTimeEffects('x.ts', "import './polyfill'\n").length === 1)
check('пропускает объявления и импорты с именами', loadTimeEffects('x.ts', "import { a } from './a'\nconst f = new Intl.DateTimeFormat('ru')\nexport function g() { return a }\nexport type T = 1\n").length === 0)

// и пометка в сборке на месте: без неё тест охранял бы пустоту
const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
check('vite.config.ts: домены помечены «без побочных действий»', /moduleSideEffects:\s*\[\{\s*test:\s*\/\[\\\\\/\]src\[\\\\\/\]domains\[\\\\\/\]\/,\s*sideEffects:\s*false/.test(vite))

console.log(`\nИтог: ${total - fail}/${total}`)
process.exitCode = fail ? 1 : 0
