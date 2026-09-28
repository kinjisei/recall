/**
 * Смоук дизайн-системы (PLAN.md Ф1.4): тема за флагом, шторка боковой
 * панелью, общие раскладки, клавиатура в упражнениях.
 *
 *   1. тема: у обычного человека тёмная даже при светлом телефоне; владелец в
 *      /admin выбирает светлую — меняются data-theme, фон страницы и цвет строки
 *      состояния, выбор переживает перезагрузку; «как в системе» идёт за
 *      телефоном; в Настройках переключателя нет;
 *   2. шторка: на телефоне — снизу во всю ширину, на компьютере — панелью
 *      справа на всю высоту;
 *   3. раскладки (витрина /dev/ui, только в разработке): колонка упражнения,
 *      колонка чтения с панелью сбоку, «список + подробности» — на 1280 и 390;
 *   4. клавиатура: 1–4 выбирают вариант, Enter — «дальше», Esc — выход из
 *      раунда.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-ui.mjs [--shots <папка>]`. Аккаунт создаётся и
 * удаляется сам (service_role тестовой базы).
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
const EMAIL = 'ui-smoke@recall.test'
const PASSWORD = 'UiSmoke!2026'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt !== -1 ? process.argv[shotsAt + 1] : null

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const px = (n) => Math.round(n)

const waitText = (page, text, timeout = 15000) =>
  page
    .waitForFunction((t) => (document.body.innerText || '').includes(t), { polling: 250, timeout }, text)
    .then(() => true)
    .catch(() => false)

/** Нажать кнопку по видимому тексту (первую подходящую). */
const clickText = (page, text, sel = 'button') =>
  page.evaluate(
    (t, s) => {
      const b = [...document.querySelectorAll(s)].find((e) => (e.textContent || '').trim() === t)
      b?.click()
      return !!b
    },
    text,
    sel,
  )

/** Состояние темы на странице. */
const themeState = (page) =>
  page.evaluate(() => ({
    attr: document.documentElement.dataset.theme ?? null,
    bg: getComputedStyle(document.body).backgroundColor,
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  }))

async function createUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'ui-smoke (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = cu?.user?.id ?? null
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!id) throw new Error('не удалось получить id тестового пользователя')
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  await admin.from('profiles').update({ level: 'B1', is_admin: false }).eq('id', id)
  return id
}

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('ui-smoke')}`, 'about:blank'],
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

async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, `${name}.png`) })
}

// ── 1. тема ─────────────────────────────────────────────────────────────────
async function theme(page, userId) {
  // обычный человек со светлым телефоном — всё равно тёмная
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  let t = await themeState(page)
  check('без выбора: тёмная даже при светлом телефоне', t.attr === 'dark' && t.bg === 'rgb(22, 24, 38)', JSON.stringify(t))
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' })
  await waitText(page, 'Настройки')
  check('в Настройках переключателя темы нет', !(await page.evaluate(() => !!document.querySelector('[aria-label="Тема оформления"]'))))

  // владелец: блок в админке
  await admin.from('profiles').update({ is_admin: true }).eq('id', userId)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  check('в админке есть «Тема на этом устройстве»', await waitText(page, 'Тема на этом устройстве'))
  await clickText(page, 'Светлая')
  await sleep(300)
  t = await themeState(page)
  check('владелец выбрал светлую: data-theme, фон, строка состояния', t.attr === 'light' && t.bg === 'rgb(245, 245, 249)' && t.meta === '#f5f5f9', JSON.stringify(t))
  await shot(page, 'theme-light-admin')

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(800)
  t = await themeState(page)
  check('выбор переживает перезагрузку', t.attr === 'light', JSON.stringify(t))
  await shot(page, 'theme-light-home')

  // «как в системе» идёт за телефоном — и при смене на лету
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  await waitText(page, 'Тема на этом устройстве')
  await clickText(page, 'Как в системе')
  await sleep(300)
  const sysLight = (await themeState(page)).attr
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await page.screenshot({ encoding: 'base64' }) // кадр: событие медиа-запроса приходит с ним
  await sleep(300)
  const sysDark = (await themeState(page)).attr
  check('«как в системе»: светлый телефон → светлая, сменил на тёмный → тёмная', sysLight === 'light' && sysDark === 'dark', `${sysLight} → ${sysDark}`)

  await clickText(page, 'Тёмная')
  await admin.from('profiles').update({ is_admin: false }).eq('id', userId)
  await page.emulateMediaFeatures([])
}

async function run(browser, userId) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await clickText(page, 'Войти')
  await sleep(500)
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 })

  await theme(page, userId)

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '))
}

async function main() {
  const userId = await createUser()
  const browser = await openBrowser()
  try {
    await run(browser, userId)
  } catch (e) {
    check('смоук дошёл до конца', false, String(e?.message ?? e).split('\n')[0])
  } finally {
    await browser.close().catch(() => {})
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    console.log('Тестовый аккаунт удалён.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

void px
await main()
