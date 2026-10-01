#!/usr/bin/env node
// ============================================================================
// Карта кода: кто кого импортирует и что трогает в базе — механически, без AI.
//
// Зачем: проект архитектуры строится по фактам, а не по памяти. Скрипт
// проходит src/ и api/, и для каждого файла выписывает:
//   • строки кода, локальные импорты (с разрешением путей);
//   • таблицы (.from('x')) и RPC (.rpc('x')) Supabase; у сервера api/ — его
//     вызовы базы по REST (userRpc/rpcAs('x'), /rest/v1/x?…);
//   • ключи localStorage ('recall.*');
//   • развилки по языку (lang === 'es' / 'en');
//   • AI-задачи (task: 'x').
// Затем сводит всё по разделам (features/<имя>), модулям lib/ и слоям
// app · shared/<x> · domains/<x>: кто чем пользуется, какие разделы
// импортируют друг друга напрямую.
//
// Сканер (scanCode) берёт и генератор описаний модулей
// (scripts/gen/module-docs.mjs) — одни и те же факты для карты и для блоков
// generated в CLAUDE.md.
//
// Выход: docs/architecture/code-map.json (полные данные, не в git) и
//        docs/architecture/code-map.md   (сводка для чтения).
// Запуск: node scripts/arch-map.mjs
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { withoutComments } from './checks/tokens.mjs'

export const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const OUT_DIR = join(ROOT, 'docs', 'architecture')
const SCAN = ['src', 'api']
const SKIP_DIRS = new Set(['node_modules', 'data']) // src/data — контент, не код

const rel = (p) => relative(ROOT, p).split(sep).join('/')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out)
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

function resolveImport(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec.replace(/\.js$/, ''))
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

const uniq = (a) => [...new Set(a)].sort()
const matchAll = (text, re) => [...text.matchAll(re)].map((m) => m[1])

/**
 * Факты по каждому файлу кода src/ и api/ (без src/data): путь от корня →
 * { lines, imports, tables, rpcs, storageKeys, langBranches, aiTasks }.
 */
export function scanCode() {
  const byFile = {}
  for (const f of SCAN.flatMap((d) => walk(join(ROOT, d)))) {
    const raw = readFileSync(f, 'utf8')
    // факты — по коду без комментариев: пример в пояснении не таблица и не импорт
    const text = withoutComments(raw)
    const specs = [
      ...matchAll(text, /(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g),
      ...matchAll(text, /import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g),
      ...matchAll(text, /^\s*import\s+['"](\.{1,2}\/[^'"]+)['"]/gm),
    ]
    byFile[rel(f)] = {
      lines: raw.split('\n').length,
      imports: uniq(specs.map((s) => resolveImport(f, s)).filter(Boolean).map(rel)),
      tables: uniq([
        ...matchAll(text, /\.from\(\s*['"]([a-z_]+)['"]\s*\)/g),
        // сервер ходит в базу по REST: `${url}/rest/v1/profiles?…`
        ...matchAll(text, /\/rest\/v1\/([a-z_]+)\?/g),
      ]),
      rpcs: uniq([
        ...matchAll(text, /\.rpc\(\s*['"]([a-z_]+)['"]/g),
        // сервер: userRpc(req, 'x', …) / rpcAs(c, 'x', …) из api/_auth.ts
        ...matchAll(text, /\b(?:userRpc|rpcAs)\(\s*[\w.]+\s*,\s*['"]([a-z_]+)['"]/g),
      ]),
      storageKeys: uniq(matchAll(text, /['"`](recall\.[a-zA-Z0-9_.-]+)['"`]/g)),
      langBranches: (text.match(/lang\s*[!=]==?\s*['"](?:es|en)['"]/g) || []).length,
      aiTasks: uniq(matchAll(text, /task:\s*['"]([a-z_]+)['"]/g)),
    }
  }
  return byFile
}

// ---- группировка: раздел features/<x>, модуль lib/<x>, слои, прочее ---------
export function groupOf(path) {
  let m
  if ((m = path.match(/^src\/features\/([^/]+)\//))) return `features/${m[1]}`
  if ((m = path.match(/^src\/lib\/([^/]+)\.tsx?$/))) return `lib/${m[1]}`
  if ((m = path.match(/^src\/(shared|domains)\/([^/]+)\//))) return `${m[1]}/${m[2]}`
  if (path.startsWith('src/app/')) return 'app'
  if (path.startsWith('src/components/')) return 'components'
  if (path.startsWith('src/context/')) return 'context'
  if (path.startsWith('src/types/')) return 'types'
  if (path.startsWith('api/')) return 'api'
  return path.startsWith('src/') ? 'src-root' : 'other'
}

function writeMap(byFile) {
  const groups = {}
  for (const [path, info] of Object.entries(byFile)) {
    const g = (groups[groupOf(path)] ??= { files: [], lines: 0, tables: [], rpcs: [], storageKeys: [], langBranches: 0, aiTasks: [], uses: [] })
    g.files.push(path)
    g.lines += info.lines
    g.tables.push(...info.tables)
    g.rpcs.push(...info.rpcs)
    g.storageKeys.push(...info.storageKeys)
    g.langBranches += info.langBranches
    g.aiTasks.push(...info.aiTasks)
    g.uses.push(...info.imports.map(groupOf))
  }
  for (const [name, g] of Object.entries(groups)) {
    for (const k of ['tables', 'rpcs', 'storageKeys', 'aiTasks']) g[k] = uniq(g[k])
    g.uses = uniq(g.uses.filter((u) => u !== name))
  }

  // кто пользуется модулем (обратный индекс)
  const usedBy = {}
  for (const [name, g] of Object.entries(groups)) for (const u of g.uses) (usedBy[u] ??= []).push(name)

  // прямые импорты между разделами — кандидаты в нарушения границ
  const crossFeature = []
  for (const [path, info] of Object.entries(byFile)) {
    const from = groupOf(path)
    if (!from.startsWith('features/')) continue
    for (const imp of info.imports) {
      const to = groupOf(imp)
      if (to.startsWith('features/') && to !== from) crossFeature.push({ from: path, to: imp })
    }
  }

  // прямые обращения к базе из экранов (а не через lib/)
  const dbInScreens = Object.entries(byFile)
    .filter(([p, i]) => p.startsWith('src/features/') && (i.tables.length || i.rpcs.length))
    .map(([p, i]) => ({ file: p, tables: i.tables, rpcs: i.rpcs }))

  // кто пользуется каждой таблицей и RPC
  const tableUse = {}
  const rpcUse = {}
  for (const [path, info] of Object.entries(byFile)) {
    for (const t of info.tables) (tableUse[t] ??= []).push(path)
    for (const r of info.rpcs) (rpcUse[r] ??= []).push(path)
  }

  const orphanLib = Object.keys(groups).filter((g) => g.startsWith('lib/') && !usedBy[g])

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(
    join(OUT_DIR, 'code-map.json'),
    JSON.stringify({ generatedBy: 'scripts/arch-map.mjs', byFile, groups, usedBy, crossFeature, dbInScreens, tableUse, rpcUse, orphanLib }, null, 1),
  )

  // ---- сводка в markdown -----------------------------------------------------
  const files = Object.keys(byFile)
  const totalLines = Object.values(byFile).reduce((s, i) => s + i.lines, 0)
  const sorted = (prefix) => Object.entries(groups).filter(([n]) => n.startsWith(prefix)).sort((a, b) => b[1].lines - a[1].lines)
  const md = []
  md.push('# Карта кода (сгенерировано)', '')
  md.push('> Генерирует `node scripts/arch-map.mjs`. Руками не править — перезапустить.', '')
  md.push(`Файлов: ${files.length}, строк кода: ${totalLines} (без \`src/data\`).`, '')
  md.push('## Разделы (features/)', '', '| Раздел | Файлов | Строк | Таблицы | RPC | Развилки языка | Зависит от |', '|---|---|---|---|---|---|---|')
  for (const [n, g] of sorted('features/')) {
    md.push(`| ${n.replace('features/', '')} | ${g.files.length} | ${g.lines} | ${g.tables.join(', ') || '—'} | ${g.rpcs.length} | ${g.langBranches || '—'} | ${g.uses.filter((u) => u !== 'types').join(', ')} |`)
  }
  md.push('', '## Слои app · shared · domains', '', '| Слой | Файлов | Строк | Таблицы / RPC | Кем используется |', '|---|---|---|---|---|')
  for (const [n, g] of Object.entries(groups).filter(([n]) => n === 'app' || /^(shared|domains)\//.test(n)).sort(([a], [b]) => a.localeCompare(b))) {
    const who = (usedBy[n] || []).map((u) => u.replace('features/', 'f:'))
    md.push(`| ${n} | ${g.files.length} | ${g.lines} | ${[...g.tables, ...g.rpcs.map((r) => `${r}()`)].join(', ') || '—'} | ${who.length ? who.join(', ') : '—'} |`)
  }
  md.push('', '## Модули lib/', '', '| Модуль | Строк | Кем используется | Таблицы / RPC |', '|---|---|---|---|')
  for (const [n, g] of sorted('lib/')) {
    const who = (usedBy[n] || []).map((u) => u.replace('features/', 'f:'))
    md.push(`| ${n.replace('lib/', '')} | ${g.lines} | ${who.length ? who.join(', ') : '**никем**'} | ${[...g.tables, ...g.rpcs.map((r) => `${r}()`)].join(', ') || '—'} |`)
  }
  md.push('', `## Прямые импорты между разделами (${crossFeature.length})`, '')
  for (const c of crossFeature) md.push(`- \`${c.from}\` → \`${c.to}\``)
  md.push('', `## Экраны, которые ходят в базу напрямую, мимо lib/ (${dbInScreens.length})`, '')
  for (const d of dbInScreens) md.push(`- \`${d.file}\`: ${[...d.tables, ...d.rpcs.map((r) => `${r}()`)].join(', ')}`)
  md.push('', `## Модули lib/ без единого потребителя (${orphanLib.length})`, '')
  for (const o of orphanLib) md.push(`- \`${o}\``)
  const langTotal = Object.values(byFile).reduce((s, i) => s + i.langBranches, 0)
  md.push('', `## Развилки по языку: ${langTotal} в ${Object.values(byFile).filter((i) => i.langBranches).length} файлах`, '')
  for (const [p, i] of Object.entries(byFile).filter(([, i]) => i.langBranches).sort((a, b) => b[1].langBranches - a[1].langBranches)) md.push(`- \`${p}\`: ${i.langBranches}`)
  md.push('', `## Таблицы: кто их трогает (${Object.keys(tableUse).length})`, '')
  for (const [t, ps] of Object.entries(tableUse).sort()) md.push(`- **${t}** — ${ps.length} файл(ов): ${ps.map((p) => `\`${p.replace(/^src\//, '')}\``).join(', ')}`)
  md.push('', `## RPC: кто их зовёт (${Object.keys(rpcUse).length})`, '')
  for (const [r, ps] of Object.entries(rpcUse).sort()) md.push(`- **${r}()** — ${ps.map((p) => `\`${p.replace(/^src\//, '')}\``).join(', ')}`)
  writeFileSync(join(OUT_DIR, 'code-map.md'), md.join('\n') + '\n')

  console.log(`files=${files.length} lines=${totalLines} crossFeature=${crossFeature.length} dbInScreens=${dbInScreens.length} orphanLib=${orphanLib.length} langBranches=${langTotal}`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) writeMap(scanCode())
