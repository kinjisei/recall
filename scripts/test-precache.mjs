/**
 * Офлайн-кэш = стартовый граф (scripts/_precache.mjs, PLAN.md Ф1.11).
 *
 * Ловим то, ради чего он есть: файл, который стартовый файл импортирует —
 * напрямую или через другой, — не попал в precache, и приложение без сети
 * открывается белым экраном. Проверка обязана краснеть: на сборке-образце и
 * на настоящей dist/ из списка по очереди убирается КАЖДЫЙ файл графа, и
 * сверка должна назвать именно его. Ленивые экраны (import()) в precache не
 * обязаны — их докачивают при первом открытии; но предел кэша докачанных
 * (recall-chunks) обязан вмещать их все.
 *
 * Запуск: node scripts/test-precache.mjs (настоящая dist/ — после npm run build;
 * в CI её отсутствие — ошибка, локально — пропуск этой части).
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  chunksOutsidePrecache,
  precacheProblems,
  readPrecache,
  RUNTIME_CHUNKS_MAX,
  startupFiles,
  startupGraph,
} from './_precache.mjs'

let ok = 0
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  pass ? ok++ : failed++
}
const without = (set, item) => new Set([...set].filter((x) => x !== item))

// --- граф по метаданным сборки ----------------------------------------------------
{
  const chunk = (fileName, extra) => ({ type: 'chunk', fileName, imports: [], isEntry: false, moduleIds: [], ...extra })
  const bundle = {
    'assets/index.js': chunk('assets/index.js', { isEntry: true, imports: ['assets/react.js'], dynamicImports: ['assets/Page.js'] }),
    'assets/react.js': chunk('assets/react.js', { imports: ['assets/runtime.js'] }),
    'assets/runtime.js': chunk('assets/runtime.js'),
    'assets/Page.js': chunk('assets/Page.js', { imports: ['assets/words.js'] }),
    'assets/words.js': chunk('assets/words.js'),
    'assets/wb.js': chunk('assets/wb.js', { moduleIds: ['/p/node_modules/workbox-window/build/workbox-window.prod.es5.mjs'] }),
    'assets/index.css': { type: 'asset', fileName: 'assets/index.css' },
  }
  const files = startupFiles(bundle)
  check('метаданные: вход и его импорты, в том числе через один', ['assets/index.js', 'assets/react.js', 'assets/runtime.js'].every((f) => files.has(f)))
  check('метаданные: ленивый экран и его импорты — не стартовые', !files.has('assets/Page.js') && !files.has('assets/words.js'))
  check('метаданные: workbox-window — стартовый (регистрация SW)', files.has('assets/wb.js'))
  check('метаданные: не-JS не в графе', !files.has('assets/index.css'), [...files].join(', '))
}

// --- сверка по файлам: сборка-образец ----------------------------------------------
const fixture = mkdtempSync(join(tmpdir(), 'recall-precache-'))
try {
  const put = (file, text) => {
    mkdirSync(dirname(join(fixture, file)), { recursive: true })
    writeFileSync(join(fixture, file), text)
  }
  put('index.html', [
    '<!doctype html><html><head>',
    '<link rel="icon" href="/favicon.svg">',
    '<script type="module" crossorigin src="/assets/index-A.js"></script>',
    '<link rel="modulepreload" crossorigin href="/assets/react-B.js">',
    '<link rel="stylesheet" crossorigin href="/assets/index-C.css">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '</head><body></body></html>',
  ].join('\n'))
  // минифицированный вид, как у Rolldown: import без пробелов, export * from, import "…"
  put('assets/index-A.js', 'import{a as e}from"./react-B.js";import"./side-D.js";const t=()=>import("./Page-E.js");e(t);')
  put('assets/react-B.js', 'export*from"./runtime-F.js";export{x as a}from"./runtime-F.js";')
  put('assets/side-D.js', 'console.log("side")')
  put('assets/runtime-F.js', 'export const x=1;const s="import{y}from\\"./fake.js\\"";')
  put('assets/Page-E.js', 'import"./words-G.js";export default 1')
  put('assets/words-G.js', 'export default []')
  put('assets/index-C.css', 'body{}')
  put('favicon.svg', '<svg/>')
  put('manifest.webmanifest', '{}')
  const full = ['index.html', 'favicon.svg', 'manifest.webmanifest', 'assets/index-C.css',
    'assets/index-A.js', 'assets/react-B.js', 'assets/side-D.js', 'assets/runtime-F.js']
  put('sw.js', `if(!self.define){}define(["./workbox"],function(e){e.precacheAndRoute([${full
    .map((u) => `{url:"${u}",revision:${u.endsWith('.js') ? 'null' : '"1"'}}`).join(',')}],{})});`)

  const pre = readPrecache(fixture)
  check('образец: список precache читается из sw.js', pre?.size === full.length, `${pre?.size} из ${full.length}`)
  const { graph } = startupGraph(fixture)
  check('образец: граф — вход, import, export * from, import "…"',
    ['assets/index-A.js', 'assets/react-B.js', 'assets/side-D.js', 'assets/runtime-F.js'].every((f) => graph.has(f)),
    [...graph.keys()].join(', '))
  check('образец: import() и текст «import» в строке — не статический импорт',
    !graph.has('assets/Page-E.js') && !graph.has('assets/fake.js'))
  check('образец: всё на месте — проблем нет', precacheProblems(fixture).length === 0, precacheProblems(fixture).join('; '))

  for (const f of full) {
    const p = precacheProblems(fixture, without(pre, f))
    check(`образец: убрали ${f} — сверка называет его`, p.some((x) => x.includes(f)), p.join('; ') || 'молчит')
  }
  check('образец: ленивый экран вне precache — не проблема', precacheProblems(fixture).length === 0)
  {
    const out = chunksOutsidePrecache(fixture).sort().join(', ')
    check('образец: вне precache — ровно ленивые чанки (их докачивает recall-chunks)', out === 'assets/Page-E.js, assets/words-G.js', out)
  }
  {
    const p = precacheProblems(fixture, new Set([...pre, 'assets/old-Z.js']))
    check('образец: запись precache на несуществующий файл — проблема', p.some((x) => x.includes('old-Z.js')))
  }
  rmSync(join(fixture, 'assets/side-D.js'))
  check('образец: импортированного файла нет в сборке — проблема',
    precacheProblems(fixture).some((x) => x.startsWith('нет файла: assets/side-D.js')))
  rmSync(join(fixture, 'sw.js'))
  check('образец: нет sw.js — проблема, а не падение', /нет sw\.js/.test(precacheProblems(fixture).join('')))
} finally {
  rmSync(fixture, { recursive: true, force: true })
}

// --- настоящая сборка -----------------------------------------------------------------
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
if (!existsSync(join(dist, 'sw.js'))) {
  if (process.env.CI) check('dist/: сборка есть', false, 'нет dist/sw.js — шаг сборки не отработал')
  else console.log('· dist/ нет — настоящая сборка не проверена (сначала npm run build)')
} else {
  const pre = readPrecache(dist)
  const { graph } = startupGraph(dist)
  const problems = precacheProblems(dist)
  check(`dist/: все ${graph.size} файлов стартового графа в precache`, graph.size > 1 && problems.length === 0, problems.join('; '))
  const silent = [...graph.keys()].filter((f) => !precacheProblems(dist, without(pre, f)).some((x) => x.includes(f)))
  check(`dist/: убрать любой из ${graph.size} файлов — сверка краснеет`, silent.length === 0, silent.join(', '))
  // предел recall-chunks вытесняет давно не открытое — он обязан вмещать всю
  // сборку, иначе у того, кто открывает всё, кэш выкидывал бы нужное (Ф1.12)
  const outside = chunksOutsidePrecache(dist, pre).length
  check(`dist/: чанков вне precache (${outside}) не больше предела recall-chunks (${RUNTIME_CHUNKS_MAX})`,
    outside > 0 && outside <= RUNTIME_CHUNKS_MAX, outside > RUNTIME_CHUNKS_MAX ? 'подними RUNTIME_CHUNKS_MAX в scripts/_precache.mjs' : '')
}

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
