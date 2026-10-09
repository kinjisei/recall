/**
 * Смоук офлайн-старта PWA (PLAN.md Ф1.11): приложение открывается без сети —
 * и сразу после установки, и после выкладки новой сборки. И обновление
 * (Ф1.12): новая сборка включается сама, не дожидаясь закрытия окон, а кэш
 * докачанных чанков не растёт сверх предела и хранит всю текущую сборку.
 *
 * Зачем. Офлайн-кэш (precache) брал стартовые файлы по маскам имён, и больше
 * десятка файлов стартового графа (react-dom, клиент базы, роутер…) в него не
 * попадали. Пока HTTP-кэш браузера их помнит, это незаметно. Но приложение
 * обновилось в фоне — новый стартовый файл просит файлы с НОВЫМИ именами,
 * которых нигде нет, и без сети вместо экрана пусто.
 *
 * Метод. Сборка на тестовой базе и `vite preview` прямо в этом процессе — у
 * dev-сервера service worker'а нет. «Нет сети» — по-настоящему: сервер рвёт
 * каждое соединение (иначе промах кэша service worker молча докачал бы файл),
 * а страница переходит в офлайн (база недоступна, navigator.onLine = false).
 * Перед каждой офлайн-перезагрузкой стираем всё, кроме precache: HTTP-кэш и
 * кэш докачанных чанков. Так проверяется ровно обещание precache — «для
 * старта хватит меня одного» — и тот худший случай, когда новая сборка
 * скачана в фоне, а её файлы страница ещё ни разу не запрашивала (HTTP-кэш
 * на iOS вытесняется быстро).
 *
 * Вторая сборка — с другими именами у ВСЕХ файлов (суффикс -v2): худший
 * случай выкладки.
 *
 * Запуск: node scripts/smoke-offline-start.mjs
 * (dev-сервер не нужен — смоук сам собирает и поднимает приложение на :4173;
 * тестовая база, аккаунт заводится и удаляется).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { build, preview } from 'vite'
import { chunksOutsidePrecache, RUNTIME_CHUNKS_MAX, startupGraph } from './_precache.mjs'
import { profileDir } from './_profile.mjs'
import { ROOT, scriptEnv } from './_env.mjs'
import { settledScreenshot } from './_shots.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук офлайн-старта — только на тестовой базе.')
  process.exit(1)
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 4173
const URL_ = `http://localhost:${PORT}`
const OUT = join(tmpdir(), 'recall-offline-start')
const root = fileURLToPath(ROOT)
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const EMAIL = 'offline-start@recall.test', PASS = 'OfflineStart!2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const wait = { polling: 250, timeout: 60000 }
/** Нижнее меню ученика — признак, что каркас нарисовался, а не белый экран. */
const TABS = ['Главная', 'Учёба', 'Практика', 'Диалог']
/** Кнопка главной — признак, что нарисовался сам экран, а не только каркас. */
const HOME = 'Начать занятие'

// Сборка видит тестовую базу так же, как dev:test: Vite не перезаписывает
// переменные, которые уже есть в окружении.
process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY

let offline = false
/** «Нет сети» на стороне сервера: каждое соединение рвётся. */
const offlineSwitch = {
  name: 'smoke:offline-switch',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => (offline ? req.socket.destroy() : next()))
  },
}

async function buildApp(suffix) {
  const names = suffix ? `assets/[name]-[hash]-${suffix}.js` : undefined
  await build({
    root,
    logLevel: 'error',
    build: {
      outDir: OUT,
      emptyOutDir: true,
      rolldownOptions: names ? { output: { entryFileNames: names, chunkFileNames: names } } : {},
    },
  })
}
const serve = () =>
  preview({ root, logLevel: 'error', plugins: [offlineSwitch], build: { outDir: OUT }, preview: { port: PORT, strictPort: true } })

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// --- аккаунт на тестовой базе ---------------------------------------------------
await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'offline-start' })
const { data: cu } = await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true })
let id = cu?.user?.id
if (!id) {
  const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
  id = l.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id
}

let server = null
let b = null
let page = null
/** Файлы своего сайта, которые не загрузились в текущем окне. */
let failed = []

/** Новое окно приложения — как открыть его заново с иконки. */
async function openApp(path, { offlineMode = false } = {}) {
  page = await b.newPage()
  await page.setViewport({ width: 390, height: 844 })
  failed = []
  page.on('requestfailed', (r) => {
    const u = r.url()
    // /_vercel/insights — скрипт аналитики: его отдаёт сам Vercel, в сборке его нет
    if (u.startsWith(URL_) && /\.(js|css|woff2)$/.test(u) && !u.includes('/_vercel/')) failed.push(u.slice(URL_.length + 1))
  })
  if (offlineMode) await page.setOfflineMode(true)
  await page.goto(`${URL_}${path}`, { waitUntil: offlineMode ? 'domcontentloaded' : 'networkidle2' }).catch(() => {})
}
const screen = () => page.evaluate(() => document.body.innerText)
/** Дождаться меню (и, если задан, текста экрана). */
const tabsShown = (timeout, also = '') =>
  page.waitForFunction((need) => need.every((t) => document.body.innerText.includes(t)), { polling: 250, timeout },
    also ? [...TABS, also] : TABS)
    .then(() => true, () => false)
const entryName = () => page.evaluate(() => document.querySelector('script[type="module"]')?.getAttribute('src') ?? '')

/** Как будто открыли все разделы: каждый чанк сборки вне precache — через service worker. */
async function openAllChunks() {
  const urls = chunksOutsidePrecache(OUT).map((f) => `/${f}`)
  const ok = await page.evaluate(
    async (list) => (await Promise.all(list.map((u) => fetch(u).then((r) => r.ok, () => false)))).filter(Boolean).length,
    urls,
  )
  return { urls, ok }
}

/**
 * Закрыть приложение, стереть всё, кроме precache, и открыть его без сети.
 * Потом сеть возвращается — человек пользуется дальше, как обычно.
 */
async function offlineStart(label, expectEntry = '') {
  await page.evaluate(async () => {
    for (const k of await caches.keys()) if (!k.includes('precache')) await caches.delete(k)
  })
  await (await page.createCDPSession()).send('Network.clearBrowserCache')
  await page.close()
  offline = true
  await openApp('/', { offlineMode: true })
  await tabsShown(15000)
  // главная ждёт базу до 4 с (страховка в DashboardPage), потом рисует что есть;
  // заодно ленивые куски успеют упасть, если им суждено
  await sleep(6000)
  const txt = await screen()
  const entry = await entryName()
  if (expectEntry) check(`${label}: открылась новая сборка`, entry.includes(expectEntry), entry)
  const shown = TABS.every((t) => txt.includes(t))
  check(`${label}: экран есть, меню на месте`, shown, shown ? '' : `на экране: «${txt.trim().slice(0, 80)}»`)
  check(`${label}: главная нарисовалась, а не только каркас`, txt.includes(HOME))
  if (process.argv.includes('--shots')) await settledScreenshot(page, { path: join(tmpdir(), `offline-start-${label.replace(/\s+/g, '-')}.png`) })
  // Стартовые файлы обязаны быть; ленивые куски (слово дня тянет словарь на
  // 750–850 КБ) в precache не входят по замыслу — без сети в стёртом кэше они
  // не грузятся, и экран обходится без них (проверки выше и ниже).
  const graph = startupGraph(OUT).graph
  const lostStart = failed.filter((f) => graph.has(f))
  const lostLazy = failed.filter((f) => !graph.has(f))
  check(`${label}: все ${graph.size} стартовых файлов загрузились`, lostStart.length === 0, lostStart.slice(0, 12).join(', '))
  if (lostLazy.length) console.log(`  · ленивые куски без сети не загрузились (так задумано): ${lostLazy.join(', ')}`)
  check(`${label}: не экран ошибки`, !/пошло не так/i.test(txt))
  // Раздел, который в этой версии ещё не открывали (кэш докачанного стёрт):
  // без сети — «нет интернета», а не «что-то пошло не так» (Ф1.13)
  await page.goto(`${URL_}/grammar`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForFunction(() => /Нет интернета|пошло не так/i.test(document.body.innerText), { polling: 250, timeout: 15000 })
    .catch(() => {})
  const lazy = await screen()
  check(`${label}: нескачанный раздел — «нет интернета», а не поломка`, /Нет интернета/.test(lazy) && !/пошло не так/i.test(lazy),
    lazy.trim().slice(0, 80))
  offline = false
  await page.setOfflineMode(false)
  await page.reload({ waitUntil: 'networkidle2' })
  if (!(await tabsShown(60000))) throw new Error(`${label}: в сети после офлайна главная не открылась`)
}

try {
  console.log('Сборка 1…')
  await buildApp('')
  server = await serve()

  const DEBUG_PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, '--no-first-run', '--disable-gpu',
    `--user-data-dir=${profileDir('offstart')}`, 'about:blank'],
    { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${DEBUG_PORT}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
  }

  await openApp('/login')
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', EMAIL)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname === '/', wait).catch(async () => {
    throw new Error(`после входа не на главной: ${await page.evaluate(() => location.href + ' | ' + document.body.innerText.slice(0, 200))}`)
  })
  // clientsClaim: service worker берёт страницу в первый же заход, без перезагрузки
  const claimed = await page.waitForFunction(() => navigator.serviceWorker.controller !== null, wait).then(() => true, () => false)
  check('первый заход: service worker взял страницу без перезагрузки', claimed)
  if (!claimed) await page.reload({ waitUntil: 'networkidle2' }) // чтобы остальное всё-таки проверить

  // Контроль: онлайн экран с меню есть. Без него «офлайн — экран есть» ничего
  // не значил бы: искомого текста могло не быть и в сети.
  check('онлайн: главная с меню на месте', await tabsShown(60000, HOME))

  await offlineStart('после установки')
  const opened1 = await openAllChunks()

  // --- выкладка новой сборки -------------------------------------------------------
  console.log('Сборка 2 (новые имена у всех файлов)…')
  await server.close()
  await buildApp('v2')
  server = await serve()
  // Человек вернулся в приложение — main.tsx проверяет новую версию; она
  // скачивается, включается сразу (skipWaiting) и перезагружает страницу.
  // Окно не закрываем и не перезагружаем сами: на прежнем поведении новая
  // версия ждала бы закрытия всех окон, и проверка краснеет.
  await page.bringToFront()
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  const switched = await page.waitForFunction(
    () => document.querySelector('script[type="module"]')?.getAttribute('src')?.includes('-v2.js'), wait,
  ).then(() => true, () => false)
  check('новая сборка включилась сама — окно не закрывали', switched, await entryName())
  if (!(await tabsShown(60000))) throw new Error('после включения новой сборки главная не открылась')

  // Человек открыл все разделы и в старой, и в новой версии: файлов больше,
  // чем вмещает кэш. Предел обязан выкинуть старые и сохранить всю новую.
  const opened2 = await openAllChunks()
  check(`проверка кэша имеет смысл: открыто ${opened1.ok} + ${opened2.ok} чанков > предела ${RUNTIME_CHUNKS_MAX}`,
    opened1.ok + opened2.ok > RUNTIME_CHUNKS_MAX && opened2.ok === opened2.urls.length)
  const kept = await page.waitForFunction(async (max) => {
    const keys = await (await caches.open('recall-chunks')).keys()
    return keys.length <= max ? keys.map((r) => new URL(r.url).pathname) : false
  }, { polling: 500, timeout: 20000 }, RUNTIME_CHUNKS_MAX).then((h) => h.jsonValue(), () => null)
  const count = kept?.length ?? await page.evaluate(async () => (await (await caches.open('recall-chunks')).keys()).length)
  check(`кэш докачанных чанков не больше предела (${RUNTIME_CHUNKS_MAX})`, Boolean(kept), `в кэше ${count}`)
  const lost = opened2.urls.filter((u) => !kept?.includes(u))
  check('в кэше — все чанки новой сборки', Boolean(kept) && lost.length === 0, lost.slice(0, 5).join(', '))

  await offlineStart('после выкладки', '-v2.js')
} finally {
  await b?.close().catch(() => {})
  await server?.close().catch(() => {})
  rmSync(OUT, { recursive: true, force: true })
  await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
  console.log('Тестовый аккаунт удалён.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
