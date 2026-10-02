/**
 * Офлайн-кэш PWA (precache) = стартовый граф сборки (PLAN.md Ф1.11).
 *
 * Зачем. Раньше precache набирался масками имён (`index-*.js`, `icons-*.js`), и
 * больше десятка файлов, которые стартовый файл импортирует статически
 * (react-dom, клиент базы, роутер…), в него не попадали. Пока HTTP-кэш их
 * помнит — незаметно. Но новая версия ставится в фоне, а её файлы страница
 * ещё ни разу не запрашивала: открыл приложение без сети — белый экран.
 *
 * Здесь две независимые половины — и это нарочно:
 *   startupPrecache() — для vite.config.ts: граф берётся из МЕТАДАННЫХ сборки
 *     (что Rolldown записал в каждый чанк), по ним фильтруется список precache;
 *   precacheProblems() — сверка по готовым ФАЙЛАМ dist/: index.html → импорты
 *     внутри самих .js (как их увидит браузер) → список в sw.js. Сборка падает,
 *     если хоть один файл стартового графа не в precache.
 * Если метаданные когда-нибудь разойдутся с файлами, сверка это поймает.
 *
 * Здесь же предел кэша докачанных чанков (RUNTIME_CHUNKS_MAX, Ф1.12).
 *
 * Тест: node scripts/test-precache.mjs. Смоук: node scripts/smoke-offline-start.mjs.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, posix, resolve } from 'node:path'
import { parseAst } from 'vite'

/**
 * Пакеты, чей чанк грузится на старте не статическим импортом, но нужен
 * всегда: workbox-window — регистрация service worker'а из main.tsx
 * (virtual:pwa-register подтягивает его через import()).
 */
const ALWAYS = [/[\\/]node_modules[\\/]workbox-window[\\/]/]

/**
 * Предел кэша докачанных чанков `recall-chunks` (PLAN.md Ф1.12). Имена чанков
 * с хэшем: после выкладки старые больше не нужны, но без предела копились бы
 * навсегда. Вытесняются давно не открытые — значит, предел обязан вмещать ВСЕ
 * чанки одной сборки вне precache (на 03.10.2026 — 75, 3,7 МБ), иначе у того,
 * кто открывает всё, кэш выкидывал бы нужное. Это держит test-precache.mjs.
 */
export const RUNTIME_CHUNKS_MAX = 100

/** JS-файлы сборки, которых нет в precache, — их докачивает recall-chunks. */
export function chunksOutsidePrecache(distDir, precache = readPrecache(distDir)) {
  const assets = join(distDir, 'assets')
  if (!existsSync(assets) || !precache) return []
  return readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => `assets/${f}`).filter((f) => !precache.has(f))
}

/**
 * Файлы стартового графа по метаданным сборки: входные чанки и всё, что они
 * импортируют статически, рекурсивно (+ чанки пакетов из ALWAYS).
 * @param {Record<string, any>} bundle выход Rolldown (generateBundle)
 * @returns {Set<string>} имена файлов вида assets/x-hash.js
 */
export function startupFiles(bundle, always = ALWAYS) {
  const chunks = new Map(Object.values(bundle).filter((c) => c.type === 'chunk').map((c) => [c.fileName, c]))
  const files = new Set()
  const add = (name) => {
    const chunk = chunks.get(name)
    if (!chunk || files.has(name)) return
    files.add(name)
    chunk.imports.forEach(add)
  }
  for (const c of chunks.values()) {
    if (c.isEntry || c.moduleIds.some((id) => always.some((re) => re.test(id)))) add(c.fileName)
  }
  return files
}

/**
 * Подключение к vite.config.ts:
 *   collect   — плагин, запоминает стартовый граф в generateBundle (sw.js
 *               vite-plugin-pwa пишет позже, в closeBundle);
 *   transform — для workbox.manifestTransforms: из .js оставляет только граф;
 *   verify    — плагин, после sw.js сверяет dist/ (precacheProblems).
 * Пустой граф или файл графа, не попавший под globPatterns (или выброшенный
 * workbox за размер > 2 МБ), — ошибка сборки, а не тихо урезанный кэш.
 */
export function startupPrecache() {
  const files = new Set()
  let outDir = ''
  return {
    collect: {
      name: 'recall:startup-graph',
      apply: 'build',
      generateBundle(_, bundle) {
        files.clear()
        for (const f of startupFiles(bundle)) files.add(f)
      },
    },
    transform: async (entries) => {
      if (!files.size) throw new Error('precache: стартовый граф пуст — плагин recall:startup-graph не отработал')
      const manifest = entries.filter((e) => !e.url.endsWith('.js') || files.has(e.url))
      const lost = [...files].filter((f) => !manifest.some((e) => e.url === f))
      if (lost.length) throw new Error(`precache: стартовые файлы не попали в список — ${lost.join(', ')}`)
      return { manifest, warnings: [] }
    },
    verify: {
      name: 'recall:precache-guard',
      apply: 'build',
      enforce: 'post',
      configResolved(config) {
        outDir = resolve(config.root, config.build.outDir)
      },
      closeBundle: {
        order: 'post',
        sequential: true,
        handler() {
          const problems = precacheProblems(outDir)
          if (problems.length) throw new Error(`Офлайн-кэш (precache) неполный:\n  ${problems.join('\n  ')}`)
        },
      },
    },
  }
}

/** Свои адреса из index.html (script src, link href) — без ведущего «/». */
function htmlRefs(html) {
  const refs = { modules: [], all: [] }
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const url = tag.match(/\b(?:src|href)="([^"]+)"/)?.[1]
    if (!url || !url.startsWith('/') || url.startsWith('//')) continue
    const file = url.slice(1).split(/[?#]/)[0]
    refs.all.push(file)
    if (/^<script\b/.test(tag) && /\btype="module"/.test(tag)) refs.modules.push(file)
  }
  return refs
}

/** Статические импорты файла: import … from, export … from, import "…" — не import(). */
function staticImports(code) {
  const out = []
  for (const node of parseAst(code).body) {
    const isStatic = ['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration'].includes(node.type)
    if (isStatic && typeof node.source?.value === 'string') out.push(node.source.value)
  }
  return out
}

/**
 * Стартовый граф по файлам dist/: модули из index.html и всё, что они
 * импортируют статически. Ключ — файл, значение — кто его импортирует.
 * @returns {{ refs: string[], graph: Map<string, string> }}
 */
export function startupGraph(distDir) {
  const { modules, all } = htmlRefs(readFileSync(join(distDir, 'index.html'), 'utf8'))
  const graph = new Map()
  const walk = (file, from) => {
    if (graph.has(file)) return
    graph.set(file, from)
    const path = join(distDir, file)
    if (!existsSync(path)) return // о пропаже скажет precacheProblems
    for (const spec of staticImports(readFileSync(path, 'utf8'))) {
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue // пакеты в сборке не остаются
      walk(spec.startsWith('/') ? spec.slice(1) : posix.join(posix.dirname(file), spec), file)
    }
  }
  modules.forEach((m) => walk(m, 'index.html'))
  return { refs: all, graph }
}

/** Адреса из списка precache в sw.js (аргумент precacheAndRoute); null — нет sw.js или списка. */
export function readPrecache(distDir) {
  const sw = join(distDir, 'sw.js')
  if (!existsSync(sw)) return null
  const ast = parseAst(readFileSync(sw, 'utf8'))
  let list = null
  const visit = (node) => {
    if (list || !node || typeof node !== 'object') return
    if (node.type === 'CallExpression' && (node.callee.property?.name ?? node.callee.name) === 'precacheAndRoute') {
      list = node.arguments[0]?.elements ?? []
      return
    }
    for (const v of Object.values(node)) Array.isArray(v) ? v.forEach(visit) : visit(v)
  }
  visit(ast)
  if (!list) return null
  const urls = new Set()
  for (const el of list) {
    const prop = el.properties?.find((p) => (p.key.name ?? p.key.value) === 'url')
    if (typeof prop?.value.value === 'string') urls.add(prop.value.value)
  }
  return urls
}

/**
 * Чего не хватает офлайн-старту: файлы стартового графа и ссылки index.html
 * вне precache; записи precache на несуществующие файлы.
 * @param {Set<string> | null} [precache] список precache (по умолчанию — из sw.js)
 * @returns {string[]} проблемы; пусто — всё на месте
 */
export function precacheProblems(distDir, precache = readPrecache(distDir)) {
  if (!existsSync(join(distDir, 'index.html'))) return [`нет ${join(distDir, 'index.html')} — сборки нет`]
  if (!precache) return ['нет sw.js или в нём нет списка precache (precacheAndRoute)']
  const problems = []
  const { refs, graph } = startupGraph(distDir)
  const why = (from) => (from === 'index.html' ? 'стартовый файл из index.html' : `его импортирует ${from}`)
  if (!graph.size) problems.push('в index.html нет <script type="module"> — стартовый файл не найден')
  if (!precache.has('index.html')) problems.push('не в precache: index.html')
  for (const [file, from] of graph) {
    if (!existsSync(join(distDir, file))) problems.push(`нет файла: ${file} (${why(from)})`)
    else if (!precache.has(file)) problems.push(`не в precache: ${file} (${why(from)})`)
  }
  for (const ref of refs) if (!graph.has(ref) && !precache.has(ref)) problems.push(`не в precache: ${ref} (ссылка из index.html)`)
  for (const url of precache) if (!existsSync(join(distDir, url))) problems.push(`в precache файл, которого нет: ${url}`)
  return problems
}
