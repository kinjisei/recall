/**
 * Смоук офлайн-старта PWA (PLAN.md Ф1.11): приложение открывается без сети —
 * и сразу после установки, и после выкладки новой сборки.
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
 * скачана в фоне, а её файлы страница ещё ни разу не запрашивала.
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
import { profileDir } from './_profile.mjs'
import { ROOT, scriptEnv } from './_env.mjs'

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
const tabsShown = (timeout) =>
  page.waitForFunction((tabs) => tabs.every((t) => document.body.innerText.includes(t)), { polling: 250, timeout }, TABS)
    .then(() => true, () => false)
const entryName = () => page.evaluate(() => document.querySelector('script[type="module"]')?.getAttribute('src') ?? '')

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
  if (process.argv.includes('--shots')) await page.screenshot({ path: join(tmpdir(), `offline-start-${label.replace(/\s+/g, '-')}.png`) })
  check(`${label}: ни один файл сайта не потерялся`, failed.length === 0, failed.slice(0, 12).join(', '))
  check(`${label}: не экран ошибки`, !/пошло не так/i.test(txt))
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
  // clientsClaim не включён: первый заход service worker только ставит, а
  // страницу берёт со следующего открытия — как у человека.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, wait).catch(() => {
    throw new Error('service worker не взял страницу')
  })

  // Контроль: онлайн экран с меню есть. Без него «офлайн — экран есть» ничего
  // не значил бы: искомого текста могло не быть и в сети.
  check('онлайн: главная с меню на месте', (await tabsShown(60000)) && (await screen()).includes(HOME))

  await offlineStart('после установки')

  // --- выкладка новой сборки -------------------------------------------------------
  console.log('Сборка 2 (новые имена у всех файлов)…')
  await server.close()
  await buildApp('v2')
  server = await serve()
  // Приложение проверяет новую версию при открытии и возвращении (main.tsx).
  // Новый service worker ставится в фоне и ЖДЁТ, пока закроют все окна
  // приложения (skipWaiting не включён) — потому и открытие без сети после
  // выкладки получает именно новую сборку.
  await page.reload({ waitUntil: 'networkidle2' })
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()))
  const fetched = await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting) ||
      Boolean(document.querySelector('script[type="module"]')?.getAttribute('src')?.includes('-v2.js')),
    wait,
  ).then(() => true, () => false)
  check('новая сборка скачана в фоне', fetched)

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
