#!/usr/bin/env node
// Сторож размера (архитектура §3): файл кода ≤ 400 строк, компонент ≤ 250.
// Большой файл — это экран-комбайн, в котором прячутся ошибки и который
// дорого читать при каждой правке.
//
// Старые большие файлы записаны в scripts/checks/baseline/size.json вместе с
// размером. Решение владельца (27.09.2026): до переезда (PLAN.md Ф3) они НЕ
// РАСТУТ — число в списке и есть планка. Нужно дописать — выносишь новое в
// отдельный файл. Если дописать внутрь действительно надо — планка поднимается
// явно (`--allow <путь>`), и это видно в коммите.
//
// Не проверяются: контент (src/data, src/content) и сгенерированные типы базы.
// Запуск: node scripts/checks/size.mjs [--prune | --allow <путь> | --init]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { countLines, isMain, rootPath, settle } from './_baseline.mjs'

export const FILE_MAX = 400
export const COMPONENT_MAX = 250

const ROOT = rootPath('.').pathname.replace(/^\/([A-Za-z]:)/, '$1')
const rel = (p) => relative(ROOT, p).split(sep).join('/')
const SKIP = [/^src\/data\//, /^src\/content\//, /database\.types\.ts$/]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

const isPascal = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name)

/** Функция внутри инициализатора: () => …, function …, memo(…), forwardRef(…). */
function holdsFunction(node) {
  if (!node) return false
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true
  if (ts.isCallExpression(node)) return node.arguments.some(holdsFunction)
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return holdsFunction(node.expression)
  return false
}

/** Компоненты верхнего уровня .tsx-файла: имя с большой буквы и тело-функция. */
function components(source) {
  const out = []
  const lines = (node) =>
    source.getLineAndCharacterOfPosition(node.end).line - source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
  for (const st of source.statements) {
    if (ts.isFunctionDeclaration(st)) {
      const name = st.name?.text ?? 'default'
      if (name === 'default' || isPascal(name)) out.push([name, lines(st)])
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && isPascal(d.name.text) && holdsFunction(d.initializer)) out.push([d.name.text, lines(d)])
      }
    } else if (ts.isExportAssignment(st) && holdsFunction(st.expression)) {
      out.push(['default', lines(st)])
    }
  }
  return out
}

export function measure() {
  const current = {}
  for (const full of [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'api'))]) {
    const path = rel(full)
    if (SKIP.some((re) => re.test(path))) continue
    const text = readFileSync(full, 'utf8')
    const n = countLines(text)
    if (n > FILE_MAX) current[path] = n
    if (path.endsWith('.tsx')) {
      const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      for (const [name, len] of components(source)) if (len > COMPONENT_MAX) current[`${path}#${name}`] = len
    }
  }
  return current
}

if (isMain(import.meta.url)) {
  const ok = settle({
    name: 'размер',
    file: 'scripts/checks/baseline/size.json',
    about:
      `Сторож размера (scripts/checks/size.mjs): файлы больше ${FILE_MAX} строк и компоненты больше ${COMPONENT_MAX} строк на момент появления сторожа. ` +
      'Число — планка: до переезда раздела (PLAN.md Ф3) файл не растёт (решение владельца 27.09.2026), при переезде режется до лимита.',
    current: measure(),
    total: false,
    describe: (key, now, was) => {
      const limit = key.includes('#') ? COMPONENT_MAX : FILE_MAX
      const what = key.includes('#') ? 'компонент' : 'файл'
      if (!was) return `${key}: ${now} строк — ${what} больше лимита ${limit}; разрежь на части (образец — features/teacher/materials/*)`
      return (
        `${key}: было ${was}, стало ${now} — ${what} уже в списке больших и расти не должен. ` +
        `Вынеси новое в отдельный файл; поднять планку осознанно: npm run check:size -- --allow ${key.split('#')[0]}`
      )
    },
  })
  process.exitCode = ok ? 0 : 1
}
