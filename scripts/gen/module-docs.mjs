#!/usr/bin/env node
// ============================================================================
// Блоки generated в описаниях модулей (PLAN.md Ф1.7, архитектура §3, журнал п.8).
//
// Всё, что можно вычислить из кода, вычисляется, а не пишется руками: руками
// написанный список файлов устаревает к следующей неделе. Скрипт пишет в
// каждый CLAUDE.md модуля (src/, api/) блок между
//     <!-- generated:start -->  и  <!-- generated:end -->
// файлы модуля, адреса экранов, таблицы и RPC базы, AI-задачи, ключи
// localStorage и кто модулем пользуется.
//
// Чей файл — решает то же правило, что у сторожа описаний
// (scripts/checks/docs.mjs, docFor): указатель «Описание: …» в начале файла,
// иначе ближайший CLAUDE.md вверх по папкам. Факты о коде — тот же сканер, что
// у карты кода (scripts/arch-map.mjs, scanCode).
//
// Запуск:
//   npm run gen:docs                               переписать блоки
//   node scripts/gen/module-docs.mjs --check       только сверить (npm run check, CI):
//       красный, если блок устарел, если у описания с кодом нет блока или
//       указатель «Описание:» ведёт в никуда
// ============================================================================
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { groupOf, ROOT, scanCode } from '../arch-map.mjs'
import { isMain, plural } from '../checks/_baseline.mjs'
import { docFor, isCode, pointerIn } from '../checks/docs.mjs'

const START = '<!-- generated:start -->'
const END = '<!-- generated:end -->'
const BLOCK = /<!-- generated:start -->[\s\S]*?<!-- generated:end -->/
const SCAN = ['src', 'api']
const SKIP = new Set(['node_modules', 'data', 'content'])

const rel = (p) => relative(ROOT, p).split(sep).join('/')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')
const uniq = (a) => [...new Set(a)].sort()
// Порядок — явный, без учёта регистра: readdirSync отдаёт файлы в порядке
// файловой системы, и на Linux (CI) он другой, чем на Windows, — блок
// краснел бы только в CI.
const byName = (a, b) => {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()]
  return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0
}
const code = (s) => `\`${s}\``

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!SKIP.has(name)) walk(full, out)
    } else out.push(rel(full))
  }
  return out
}

/** Файл экрана по спецификатору импорта из src/app/. */
function screenFile(spec) {
  const base = posix.join('src/app', spec)
  return ['.tsx', '.ts', '/index.tsx', '/index.ts'].map((x) => base + x).find((p) => existsSync(join(ROOT, p))) ?? null
}

/** Адрес → файл экрана: реестр ленивых экранов + прямые экраны таблицы маршрутов. */
export function routeFiles() {
  const chunks = read('src/app/routeChunks.ts')
  const routes = read('src/app/routes.ts')
  const lazy = new Map()
  for (const m of chunks.matchAll(/'(\/[^']*)':\s*makeRoute\(\s*\(\)\s*=>\s*import\('([^']+)'\)/g)) lazy.set(m[1], screenFile(m[2]))
  const dev = chunks.match(/devShowcase[\s\S]*?makeRoute\(\s*\(\)\s*=>\s*import\('([^']+)'\)/)
  const direct = new Map()
  for (const m of routes.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*'([^']+)'/g)) direct.set(m[1], screenFile(m[2]))
  if (dev) direct.set('devShowcase', screenFile(dev[1]))

  const out = new Map()
  for (const m of routes.matchAll(/\{\s*path:\s*'([^']+)'[^{}]*?screen:\s*(routeScreens\['([^']+)'\]|\w+)/g)) {
    const file = m[3] ? lazy.get(m[3]) : direct.get(m[2])
    if (file) out.set(m[1], file)
  }
  return out
}

/** Всё, что нужно и для записи, и для сверки. */
export function collect() {
  const files = SCAN.flatMap((d) => walk(join(ROOT, d))).sort(byName)
  const docs = new Set(['CLAUDE.md', ...files.filter((f) => f.endsWith('/CLAUDE.md'))])
  const listed = files.filter((f) => isCode(f) || f.endsWith('database.types.ts'))
  const pointers = new Map()
  for (const f of listed) {
    const p = pointerIn(read(f))
    if (p) pointers.set(f, p)
  }
  const owner = (f) => docFor(f, docs, pointers.get(f))
  return { docs, listed, pointers, owner, facts: scanCode(), routes: routeFiles() }
}

/** Имя модуля в блоке: папка его описания от src/ (или группа карты кода, если описания нет). */
function moduleName(doc, file) {
  if (!doc || doc === 'CLAUDE.md') return groupOf(file)
  return posix.dirname(doc).replace(/^src\//, '')
}

/** Текст блока generated для одного описания. */
export function renderBlock(doc, { listed, pointers, owner, facts, routes }) {
  const dir = posix.dirname(doc)
  const under = (f) => f.startsWith(dir + '/')
  const mine = listed.filter((f) => owner(f) === doc)
  const inside = mine.filter(under).map((f) => f.slice(dir.length + 1))
  const outside = mine.filter((f) => !under(f))
  // файлы этой папки, чьё описание по указателю живёт в другом модуле
  const away = listed
    .filter((f) => under(f) && owner(f) !== doc && pointers.get(f) === owner(f))
    .map((f) => `${f.slice(dir.length + 1)} → ${posix.dirname(owner(f)).replace(/^src\//, '')}`)
  const fact = (k) => uniq(mine.flatMap((f) => facts[f]?.[k] ?? []))
  const myRoutes = [...routes].filter(([, f]) => owner(f) === doc).map(([p]) => p)
  const endpoints = mine.filter((f) => /^api\/[^_/][^/]*\.ts$/.test(f)).map((f) => `/api/${posix.basename(f, '.ts')}`)
  const users = uniq(
    Object.entries(facts)
      .filter(([f, info]) => owner(f) !== doc && info.imports.some((i) => owner(i) === doc))
      .map(([f]) => moduleName(owner(f), f)),
  )

  const lines = [
    START,
    '<!-- Пишет `npm run gen:docs` (scripts/gen/module-docs.mjs) по коду — руками не править. -->',
    '## Из кода (сгенерировано)',
    '',
    `- **Файлы:** ${inside.length ? inside.map(code).join(', ') : '—'}`,
  ]
  const add = (name, items) => items.length && lines.push(`- **${name}:** ${items.map(code).join(', ')}`)
  add('Вне папки (указатель «Описание:» в начале файла)', outside)
  add('Описаны в другом модуле (указатель «Описание:»)', away)
  add('Адреса', myRoutes)
  add('Адреса сервера', endpoints)
  add('Таблицы', fact('tables'))
  add('RPC', fact('rpcs'))
  add('AI-задачи', fact('aiTasks'))
  add('localStorage', fact('storageKeys'))
  // по импортам: функцию api/ браузер зовёт по HTTP, и импорта у неё нет
  lines.push(`- **Кто использует (импортом):** ${users.length ? users.map(code).join(', ') : 'никто'}`, END)
  return lines.join('\n')
}

/** Описание с новым блоком: на месте старого или в конце. Переводы строк — как в файле. */
export function withBlock(text, block) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lf = text.replace(/\r\n/g, '\n')
  const next = BLOCK.test(lf) ? lf.replace(BLOCK, () => block) : `${lf.trimEnd()}\n\n${block}\n`
  return next.replace(/\n/g, eol)
}

/** Что не так: устаревшие блоки, описания без блока, указатели в никуда, сломанные метки. */
export function problems(ctx, readDoc = read) {
  const out = []
  for (const [f, p] of ctx.pointers) if (!ctx.docs.has(p)) out.push(`${f}: указатель «Описание: ${p}» — такого описания нет`)
  for (const doc of [...ctx.docs].filter((d) => d !== 'CLAUDE.md').sort()) {
    const text = readDoc(doc).replace(/\r\n/g, '\n')
    const starts = text.split(START).length - 1
    const ends = text.split(END).length - 1
    const owns = ctx.listed.some((f) => ctx.owner(f) === doc)
    if (starts !== ends || starts > 1 || (starts && text.indexOf(END) < text.indexOf(START))) {
      out.push(`${doc}: метки generated сломаны (start ${starts}, end ${ends})`)
    } else if (!starts) {
      if (owns) out.push(`${doc}: нет блока generated, а код у модуля есть`)
    } else if (text.match(BLOCK)[0] !== renderBlock(doc, ctx)) {
      out.push(`${doc}: блок generated устарел`)
    }
  }
  return out
}

if (isMain(import.meta.url)) {
  const ctx = collect()
  const modules = [...ctx.docs].filter((d) => d !== 'CLAUDE.md').sort()
  if (process.argv.includes('--check')) {
    const found = problems(ctx)
    if (found.length) {
      console.log(`✖ блоки описаний: ${plural(found.length, 'проблема', 'проблемы', 'проблем')}`)
      for (const p of found) console.log(`  ${p}`)
      console.log('  Пересобрать блоки: npm run gen:docs (указатель и метки чинятся руками)')
      process.exitCode = 1
    } else console.log(`✔ блоки описаний: ${plural(modules.length, 'описание', 'описания', 'описаний')} — блоки актуальны`)
  } else {
    let changed = 0
    for (const doc of modules) {
      const owns = ctx.listed.some((f) => ctx.owner(f) === doc)
      const text = read(doc)
      if (!owns && !BLOCK.test(text)) continue // описание без кода (src/data) — блок не нужен
      const next = withBlock(text, renderBlock(doc, ctx))
      if (next !== text) {
        writeFileSync(join(ROOT, doc), next)
        changed++
        console.log(`  обновлён ${doc}`)
      }
    }
    const bad = problems(ctx).filter((p) => !p.includes('устарел'))
    for (const p of bad) console.log(`✖ ${p}`)
    console.log(`✔ блоки описаний: обновлено ${changed} из ${modules.length}`)
    if (bad.length) process.exitCode = 1
  }
}
