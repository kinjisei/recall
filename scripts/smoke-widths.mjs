/**
 * Смоук правил ширины d0 в живом каркасе (PLAN.md Ф2.17-1, журнал п.55).
 *
 * Чистый тест (test-shell-geometry) проверяет числа; здесь — что каркас их
 * действительно рисует и что раскладки слушаются ширины СОДЕРЖИМОГО, а не окна:
 *   1. меню: 720 и 1000 — рельс 72 без шапки и нижней панели, подпись вкладки —
 *      при наведении; 1280 — меню 240; «Свернуть меню» → рельс, выбор
 *      переживает перезагрузку, «Развернуть» → снова 240;
 *   2. поля области 24 · 32 · 40 (окна 1000, 1280, 1440), колонка старого
 *      экрана — по центру области;
 *   3. раскладки витрины /dev/ui по порогам содержимого: «список + подробности»
 *      рядом на 1024 (содержимое 904) и по очереди на 960 (840); «Главная +
 *      правая» рядом на 1280 (976) и одной колонкой на 1024 (904); поля
 *      упражнения на 1440 (1120) есть, на 1280 — нет;
 *   4. правая панель («Оставить отзыв» из меню профиля): на 1440 сдвигает
 *      колонку без дымки; на 1100 (рельс, 1028 − 440 < 600) ложится поверх,
 *      дымка начинается справа от рельса; Escape закрывает, колонка
 *      возвращается.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-widths.mjs`. Аккаунт создаётся и удаляется сам.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { settleAnimations } from './_shots.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const EMAIL = 'widths-smoke@recall.test'
const PASSWORD = 'WidthsSmoke!2026'
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const px = (n) => Math.round(n)
/** Нажать через DOM: page.click ждёт кадр отрисовки, а фоновая headless-вкладка
 *  их не выдаёт — клик висел до таймаута протокола (так же в smoke-shell). */
const press = (page, selector) => page.evaluate((s) => document.querySelector(s)?.click(), selector)

async function createUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'widths-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { display_name: 'Айгерим Нурланова' } })
  let id = data?.user?.id ?? null
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  } else if (error) throw new Error(error.message)
  if (!id) throw new Error('нет id тестового пользователя')
  await admin.from('activity_log').upsert({ user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 }, { onConflict: 'user_id,type,day' })
  await admin.from('profiles').update({ level: 'B1', display_name: 'Айгерим Нурланова' }).eq('id', id)
  return id
}

async function openBrowser() {
  const port = 9300 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('widths-smoke')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
    if (b) return b
  }
  throw new Error('Edge не поднялся')
}

/** Каркас на текущем экране: меню, шапка, колонка и поля области вокруг неё. */
const shell = (page) =>
  page.evaluate(() => {
    const box = (el) => (el ? el.getBoundingClientRect().toJSON() : null)
    const main = document.querySelector('main')
    const area = main?.parentElement
    return {
      vw: document.documentElement.clientWidth,
      vh: innerHeight,
      navs: document.querySelectorAll('nav.vt-nav').length,
      nav: box(document.querySelector('nav.vt-nav')),
      menu: document.querySelector('nav.vt-nav')?.getAttribute('data-menu') ?? null,
      header: !!document.querySelector('header.vt-topbar'),
      main: box(main),
      pad: area ? parseFloat(getComputedStyle(area).paddingLeft) : -1,
    }
  })

async function at(page, width, path, height = 800) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
  await sleep(1300)
}

/** Колонка по центру области справа от меню (±2 px). */
const centered = (g, right = 0) => {
  const l = g.main.left - g.nav.right
  const r = g.vw - right - g.main.right
  return { ok: Math.abs(l - r) <= 2, text: `${px(l)} / ${px(r)}` }
}

async function menuRules(page) {
  for (const w of [720, 1000]) {
    await at(page, w, '/')
    const g = await shell(page)
    check(`${w}: шапки и нижней панели нет — одна навигация`, !g.header && g.navs === 1, `шапка ${g.header}, навигаций ${g.navs}`)
    check(`${w}: рельс 72 слева на всю высоту`, g.menu === 'rail' && px(g.nav.left) === 0 && px(g.nav.width) === 72 && px(g.nav.height) === g.vh, g.nav ? `${g.menu}, ${px(g.nav.width)}×${px(g.nav.height)}` : 'нет')
    const c = centered(g)
    check(`${w}: колонка по центру области`, c.ok, c.text)
  }
  // подпись вкладки при наведении
  await page.hover('nav.vt-nav a[aria-label^="Учёба"]')
  await sleep(400)
  const tip = await page.evaluate(() => {
    const a = document.querySelector('nav.vt-nav a[aria-label^="Учёба"]')
    const t = [...(a?.querySelectorAll('span[aria-hidden]') ?? [])].find((s) => (s.textContent || '').trim() === 'Учёба')
    if (!t) return null
    const r = t.getBoundingClientRect()
    return { opacity: getComputedStyle(t).opacity, left: r.left, navRight: a.closest('nav').getBoundingClientRect().right }
  })
  check('рельс: подпись «Учёба» видна при наведении, справа от рельса', !!tip && tip.opacity === '1' && tip.left >= tip.navRight, tip ? `opacity ${tip.opacity}, x ${px(tip.left)} при рельсе до ${px(tip.navRight)}` : 'подписи нет')

  await at(page, 1280, '/')
  let g = await shell(page)
  check('1280: меню 240 с подписями', g.menu === 'full' && px(g.nav.width) === 240, `${g.menu}, ${g.nav ? px(g.nav.width) : '—'}`)
  await press(page, 'nav.vt-nav button[aria-label="Свернуть меню"]')
  await sleep(500)
  g = await shell(page)
  check('1280: «Свернуть меню» — рельс 72, колонка по центру области', g.menu === 'rail' && px(g.nav.width) === 72 && centered(g).ok, `${g.menu}, ${centered(g).text}`)
  await at(page, 1280, '/')
  g = await shell(page)
  check('1280: свёрнутое меню переживает перезагрузку', g.menu === 'rail', String(g.menu))
  await press(page, 'nav.vt-nav button[aria-label="Развернуть меню"]')
  await sleep(500)
  g = await shell(page)
  check('1280: «Развернуть меню» — снова 240', g.menu === 'full' && px(g.nav.width) === 240, String(g.menu))
}

async function paddings(page) {
  for (const [w, pad] of [[1000, 24], [1280, 32], [1440, 40]]) {
    await at(page, w, '/')
    const g = await shell(page)
    check(`${w}: поле области ${pad}`, px(g.pad) === pad, `${g.pad}px`)
  }
}

async function layouts(page) {
  const sideBySide = (a, b) =>
    page.evaluate((x, y) => {
      const ra = document.querySelector(`[data-demo="${x}"]`)?.getBoundingClientRect()
      const rb = document.querySelector(`[data-demo="${y}"]`)?.getBoundingClientRect()
      if (!ra || !rb) return { both: false, side: false }
      return { both: true, side: rb.left >= ra.right }
    }, a, b)
  await at(page, 1024, '/dev/ui?l=list&who=%D0%90%D0%B9%D0%B3%D0%B5%D1%80%D0%B8%D0%BC')
  let r = await sideBySide('list', 'detail')
  check('1024 (содержимое 904): список и подробности рядом', r.both && r.side, JSON.stringify(r))
  await at(page, 960, '/dev/ui?l=list&who=%D0%90%D0%B9%D0%B3%D0%B5%D1%80%D0%B8%D0%BC')
  r = await sideBySide('list', 'detail')
  const onlyDetail = await page.evaluate(() => !document.querySelector('[data-demo="list"]') && !!document.querySelector('[data-demo="detail"]'))
  check('960 (содержимое 840): по очереди — только подробности', onlyDetail, JSON.stringify(r))
  await at(page, 1280, '/dev/ui?l=main')
  r = await sideBySide('main', 'aside')
  check('1280 (976): Главная и правая колонка рядом', r.both && r.side, JSON.stringify(r))
  await at(page, 1024, '/dev/ui?l=main')
  r = await sideBySide('main', 'aside')
  check('1024 (904): Главная одной колонкой', r.both && !r.side, JSON.stringify(r))
  await at(page, 1440, '/dev/ui?l=center', 900)
  r = await sideBySide('progress', 'center')
  check('1440 (1120): у упражнения поле прогресса слева', r.both && r.side, JSON.stringify(r))
  await at(page, 1280, '/dev/ui?l=center')
  const noSides = await page.evaluate(() => !document.querySelector('[data-demo="progress"]') && !!document.querySelector('[data-demo="center"]'))
  check('1280 (976): упражнение без боковых полей', noSides)
}

async function openFeedback(page) {
  await press(page, 'nav.vt-nav [aria-label="Меню профиля"]')
  await sleep(300)
  await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].find((x) => (x.textContent || '').includes('Оставить отзыв'))?.click())
  await page.waitForSelector('[role="dialog"][data-panel]', { timeout: 5000 }).catch(() => {})
  await sleep(500)
  // выезд справа — анимация; в headless-вкладке без кадров она стоит в начале
  await settleAnimations(page)
  return page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][data-panel]')
    const haze = d?.parentElement?.classList.contains('bg-haze') ? d.parentElement.getBoundingClientRect() : null
    const r = d?.getBoundingClientRect()
    return d ? { kind: d.getAttribute('data-panel'), left: r.left, right: r.right, width: r.width, hazeLeft: haze?.left ?? null } : null
  })
}

async function sidePanel(page) {
  await at(page, 1440, '/', 900)
  let g = await shell(page)
  const before = g.main
  let p = await openFeedback(page)
  g = await shell(page)
  check('1440: панель 440 справа сдвигает колонку, без дымки', !!p && p.kind === 'push' && px(p.width) === 440 && px(p.right) === g.vw && p.hazeLeft === null, JSON.stringify(p))
  check('1440: колонка ушла левее панели и стоит по центру оставшегося места', g.main.right <= g.vw - 440 && centered(g, 440).ok, `${px(before.left)}→${px(g.main.left)}, ${centered(g, 440).text}`)
  await page.keyboard.press('Escape')
  await sleep(500)
  g = await shell(page)
  check('1440: Escape закрыл панель, колонка вернулась', !(await page.$('[role="dialog"][data-panel]')) && px(g.main.left) === px(before.left), `${px(g.main.left)} / ${px(before.left)}`)

  await at(page, 1100, '/')
  p = await openFeedback(page)
  check('1100: панель поверх с дымкой, дымка справа от рельса', !!p && p.kind === 'over' && p.hazeLeft !== null && px(p.hazeLeft) === 72, JSON.stringify(p))
  await page.keyboard.press('Escape')
  await sleep(400)
}

async function main() {
  const userId = await createUser()
  const browser = await openBrowser()
  const jsErrors = []
  try {
    const page = await browser.newPage()
    page.on('pageerror', (e) => jsErrors.push(String(e)))
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
    await page.evaluate(() => {
      localStorage.setItem('recall.onboarded', '1')
      localStorage.setItem('recall.theme', 'dark')
    })
    await page.evaluate(() => [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')?.click())
    await sleep(500)
    await page.type('input[type=email]', EMAIL)
    await page.type('input[type=password]', PASSWORD)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 }).catch(() => {})

    await menuRules(page)
    await paddings(page)
    await layouts(page)
    await sidePanel(page)
    check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '))
  } catch (e) {
    check('смоук дошёл до конца', false, String(e?.message ?? e).split('\n')[0])
  } finally {
    await browser.close().catch(() => {})
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

main().catch((e) => {
  console.error('Смоук упал:', e)
  process.exitCode = 1
})
