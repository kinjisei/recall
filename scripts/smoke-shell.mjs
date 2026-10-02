/**
 * Смоук каркаса (src/app): доступ по таблице маршрутов и раскладка по ширине.
 *
 * Зачем. С PLAN.md Ф1.3:
 *   1. кто куда пускается, решает таблица app/routes.ts, а не экран: админку
 *      проверяет RoleGate по флагу role: 'admin'. Не владелец видит «Доступно
 *      только владельцу», владелец — админку. Открытые страницы (тарифы,
 *      оферта, политика, лендинг) гость видит без меню, вошедший — в общей
 *      рамке с вкладками и без второй рамки страницы;
 *   2. раскладка по ширине (журнал п.45–46): телефон и планшет — как было
 *      (шапка сверху, плавающая панель снизу); компьютер (от 1024 px) — меню
 *      слева на всю высоту, EN/ES и аватар внизу панели, экраны остаются
 *      колонкой 640 px по центру свободного места; закреплённая панель ввода
 *      чата — в колонке; в раунде меню прячется; смена ширины окна
 *      переключает раскладку без перезагрузки.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-shell.mjs [--shots <папка>]` — со скриншотами 1280 и 390.
 * Аккаунт создаётся и удаляется сам (service_role тестовой базы).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const EMAIL = 'shell-smoke@recall.test'
const PASSWORD = 'ShellSmoke!2026'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt !== -1 ? process.argv[shotsAt + 1] : null

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Есть ли на экране такой текст. */
const seen = (page, text) => page.evaluate((t) => (document.body.innerText || '').includes(t), text)

/** Заголовок экрана — «Админка» есть только у самой админки. */
const heading = (page) => page.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')

/** Дождаться текста (polling: в headless-вкладке кадры не выдаются). */
const waitText = (page, text, timeout = 15000) =>
  page
    .waitForFunction((t) => (document.body.innerText || '').includes(t), { polling: 250, timeout }, text)
    .then(() => true)
    .catch(() => false)

async function createUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'shell-smoke (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = cu?.user?.id ?? null
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!id) throw new Error('не удалось получить id тестового пользователя')
  // онбординг считаем пройденным, иначе ProtectedRoute уведёт на /onboarding
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  await admin.from('profiles').update({ level: 'B1', is_admin: false }).eq('id', id)
  return id
}

async function openBrowser() {
  // порт свой на каждый прогон: фиксированный ловил ЧУЖОЙ живой Edge с чужой сессией
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('shell-smoke')}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const b = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120000 })
      .catch(() => null)
    if (b) return b
  }
  throw new Error('Edge не поднялся')
}

/** Размеры главных частей каркаса на текущем экране. */
const geometry = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
    }
    const nav = document.querySelector('nav.vt-nav')
    return {
      vw: document.documentElement.clientWidth, // без полосы прокрутки: innerWidth её включает
      vh: window.innerHeight,
      header: box(document.querySelector('header.vt-topbar')),
      nav: box(nav),
      main: box(document.querySelector('main')),
      tabs: nav ? [...nav.querySelectorAll('a[href]')].map((a) => (a.textContent || '').trim()).filter(Boolean) : [],
      active: (nav?.querySelector('a[aria-current="page"]')?.textContent || '').trim(),
      langInNav: !!nav?.querySelector('[aria-label="Язык изучения"]'),
      avatarInNav: !!nav?.querySelector('[aria-label="Меню профиля"]'),
    }
  })

const TABS = ['Главная', 'Учёба', 'Практика', 'Диалог']
const hasTabs = (g) => TABS.every((t) => g.tabs.some((x) => x.includes(t)))
const px = (n) => Math.round(n)

/** Телефон и планшет: как было — шапка сверху, плавающая панель снизу, колонка ≤ 640. */
async function phoneLayout(page, width, height, name) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  const g = await geometry(page)
  check(`${name}: шапка сверху`, !!g.header && px(g.header.top) === 0)
  check(`${name}: навигация внизу`, !!g.nav && g.vh - g.nav.bottom < 40, g.nav ? `низ ${px(g.nav.bottom)} из ${g.vh}` : 'нет')
  check(`${name}: четыре вкладки`, hasTabs(g), g.tabs.join(' · '))
  check(`${name}: колонка не шире 640`, !!g.main && g.main.width <= 640, g.main ? `${px(g.main.width)}px` : 'нет')
}

/** Компьютер (от 1024 px): меню слева, колонка 640 по центру оставшегося места. */
async function desktopLayout(page) {
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  let g = await geometry(page)
  check('компьютер: шапки сверху нет — всё в панели слева', !g.header)
  check(
    'компьютер: меню слева на всю высоту',
    !!g.nav && px(g.nav.left) === 0 && px(g.nav.top) === 0 && px(g.nav.height) === g.vh && g.nav.width >= 200 && g.nav.width <= 280,
    g.nav ? `x ${px(g.nav.left)}, ширина ${px(g.nav.width)}, высота ${px(g.nav.height)} из ${g.vh}` : 'нет',
  )
  check('компьютер: четыре вкладки в меню', hasTabs(g), g.tabs.join(' · '))
  check('компьютер: EN/ES и аватар — в панели', g.langInNav && g.avatarInNav)
  const gapL = g.main && g.nav ? g.main.left - g.nav.right : -1
  const gapR = g.main ? g.vw - g.main.right : -1
  check('компьютер: колонка не заходит под меню', gapL >= 0, `зазор ${px(gapL)}px`)
  check('компьютер: колонка не шире 640', !!g.main && g.main.width <= 640, g.main ? `${px(g.main.width)}px` : 'нет')
  check('компьютер: колонка по центру свободного места', Math.abs(gapL - gapR) <= 2, `${px(gapL)} / ${px(gapR)}`)

  // меню профиля внизу панели открывается вверх и целиком в окне
  await page.evaluate(() => document.querySelector('nav.vt-nav [aria-label="Меню профиля"]')?.click())
  await sleep(400)
  const menu = await page.evaluate(() => {
    const r = document.querySelector('[role="menu"]')?.getBoundingClientRect()
    return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null
  })
  check(
    'компьютер: меню профиля целиком в окне',
    !!menu && menu.top >= 0 && menu.bottom <= g.vh && menu.left >= 0 && menu.right <= g.vw,
    menu ? `y ${px(menu.top)}–${px(menu.bottom)}, x ${px(menu.left)}–${px(menu.right)}` : 'не открылось',
  )
  await page.keyboard.press('Escape')

  // вкладка работает и подсвечивается
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('nav.vt-nav a')].find((e) => (e.textContent || '').includes('Учёба'))
    a?.click()
  })
  await page.waitForFunction(() => location.pathname === '/study', { polling: 250, timeout: 8000 }).catch(() => {})
  await sleep(800)
  g = await geometry(page)
  check('компьютер: вкладка «Учёба» открывает /study и подсвечена', page.url().endsWith('/study') && g.active.includes('Учёба'), `${new URL(page.url()).pathname}, активна: ${g.active}`)

  // закреплённая панель ввода чата стоит в колонке, а не по центру окна
  await page.goto(`${BASE}/conversation`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  const chat = await page.evaluate(() => {
    const bar = document.querySelector('form input[aria-label^="Сообщение"]')?.closest('div.fixed')
    const main = document.querySelector('main')?.getBoundingClientRect()
    const r = bar?.getBoundingClientRect()
    return r && main ? { left: r.left, right: r.right, bottom: r.bottom, mainLeft: main.left, mainRight: main.right, vh: window.innerHeight } : null
  })
  check(
    'компьютер: панель ввода «Диалога» — в колонке и у низа окна',
    !!chat && Math.abs(chat.left - chat.mainLeft) <= 1 && Math.abs(chat.right - chat.mainRight) <= 1 && Math.abs(chat.bottom - chat.vh) <= 1,
    chat ? `x ${px(chat.left)}–${px(chat.right)} при колонке ${px(chat.mainLeft)}–${px(chat.mainRight)}, низ ${px(chat.bottom)} из ${chat.vh}` : 'нет панели',
  )

  // режим раунда: на время игры меню прячется, как нижняя панель на телефоне
  await page.goto(`${BASE}/practice?m=translate`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  g = await geometry(page)
  const gl = g.main ? g.main.left : -1
  const gr = g.main ? g.vw - g.main.right : -1
  check('компьютер: в раунде меню нет', !g.nav)
  check('компьютер: в раунде колонка по центру окна', Math.abs(gl - gr) <= 2, `${px(gl)} / ${px(gr)}`)

  // окно сузили — раскладка переключилась без перезагрузки
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(1000)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  // Изменение медиа-запроса браузер рассылает на шаге отрисовки кадра, а в
  // headless-вкладке кадры сами не выдаются (как и у waitForFunction без
  // polling). Скриншот заставляет отрисовать кадр — как у живого окна.
  await page.screenshot({ encoding: 'base64' })
  await sleep(800)
  g = await geometry(page)
  const diag = await page.evaluate(() => ({
    desktop: matchMedia('(min-width: 64rem)').matches,
    ih: innerHeight,
    vvh: Math.round(visualViewport?.height ?? -1),
  }))
  check(
    'сузили окно: снова шапка и нижняя панель',
    !!g.header && !!g.nav && g.vh - g.nav.bottom < 40,
    `ширина ${g.vw}, шапка ${g.header ? 'есть' : 'нет'}, навигация ${g.nav ? `x ${px(g.nav.left)}, низ ${px(g.nav.bottom)} из ${g.vh}` : 'нет'}; ${JSON.stringify(diag)}`,
  )
}

/** Скриншоты для приёмки: --shots <папка>. */
async function screenshots(page) {
  mkdirSync(SHOTS, { recursive: true })
  const pages = ['/', '/study', '/practice', '/conversation', '/teacher', '/settings']
  for (const [w, h, tag] of [[1280, 800, 'desk'], [390, 844, 'phone']]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
    for (const p of pages) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle2' })
      await sleep(1800)
      const name = `${tag}-${p === '/' ? 'home' : p.slice(1)}.png`
      await page.screenshot({ path: join(SHOTS, name) })
    }
  }
  console.log(`скриншоты: ${SHOTS}`)
}

/**
 * Открытые страницы (place: 'open' в app/routes.ts): гость видит их на весь
 * экран, без меню; вошедший — в общей рамке с меню и вкладками. Раньше тарифы
 * у вошедшего открывались окном без меню, выйти — только «Назад».
 */
const OPEN_PAGES = ['/pricing', '/terms', '/privacy', '/teachers']
async function openPages(page, signedIn) {
  for (const p of OPEN_PAGES) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle2' })
    await sleep(300)
    const g = await geometry(page)
    if (signedIn) {
      const mains = await page.evaluate(() => document.querySelectorAll('main').length)
      check(`вошедший на ${p}: меню и вкладки на месте`, !!g.nav && hasTabs(g), g.tabs.join(' · ') || 'меню нет')
      check(`вошедший на ${p}: своя рамка страницы не задвоена`, mains === 1, `main: ${mains}`)
    } else {
      check(`гость на ${p}: без меню, на весь экран`, !g.nav && !g.header, g.nav ? 'меню есть' : '')
    }
  }
  if (signedIn) {
    const loginLink = await page.evaluate(() => [...document.querySelectorAll('a')].some((a) => (a.textContent || '').trim() === 'Войти'))
    check('вошедший на /teachers: шапки лендинга с «Войти» нет', !loginLink)
  }
}

async function run(browser, userId) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  // ── 0. открытые страницы глазами гостя ─────────────────────────────────
  await openPages(page, false)

  // вход
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')
    b?.click()
  })
  await sleep(500)
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 }).catch(() => {})

  // ── 1. доступ по роли: админка ──────────────────────────────────────────
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  const denied = await waitText(page, 'Доступно только владельцу')
  check('не владелец на /admin видит отказ', denied)
  check('не владелец не видит саму админку', (await heading(page)) !== 'Админка', await heading(page))

  await admin.from('profiles').update({ is_admin: true }).eq('id', userId)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  check('владелец на /admin видит админку', await waitText(page, 'Email или его часть') || (await heading(page)) === 'Админка', await heading(page))
  check('у владельца нет отказа', !(await seen(page, 'Доступно только владельцу')))
  await admin.from('profiles').update({ is_admin: false }).eq('id', userId)

  // ── 1б. открытые страницы у вошедшего — в рамке ─────────────────────────
  await openPages(page, true)

  // ── 2. раскладка по ширине экрана ───────────────────────────────────────
  await phoneLayout(page, 390, 844, 'телефон')
  await phoneLayout(page, 820, 1180, 'планшет')
  await desktopLayout(page)
  if (SHOTS) await screenshots(page)

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '))
}

async function main() {
  const userId = await createUser()
  const browser = await openBrowser()
  try {
    await run(browser, userId)
  } catch (e) {
    // упавший шаг — красная проверка, а не брошенный браузер и аккаунт
    check('смоук дошёл до конца', false, String(e?.message ?? e).split('\n')[0])
  } finally {
    await browser.close().catch(() => {})
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    console.log('Тестовый аккаунт удалён.')
  }

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  // process.exit() с открытыми сокетами роняет node на Windows (libuv assert)
  process.exitCode = ok === results.length ? 0 : 1
}

main().catch((e) => {
  console.error('Смоук упал:', e)
  process.exitCode = 1
})
