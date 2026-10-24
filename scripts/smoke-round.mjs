/**
 * Смоук раунда «Практики» по макету d5 (PLAN.md Ф2.17-4д-4б, журнал п.76 (17)):
 *  1. компьютер 1280, «Перевод слова»: рамка раунда — «Выйти», полоска,
 *     «1 из 8», слева ход раунда, справа клавиши;
 *  2. два шага: «2» выбирает (без итога), Enter проверяет — итог и кружок
 *     хода раунда; Enter — следующий вопрос, «2 из 8»;
 *  3. «Проверить» выключена, пока ничего не выбрано; щелчок мышью по варианту
 *     и Enter — проверка (фокус на варианте не съедает Enter);
 *  4. Esc — выход из раунда в «Практику»;
 *  5. телефон 390: ответ одним нажатием — итог сразу, «Проверить» нет.
 * Аккаунт создаётся и удаляется сам (тестовая база, `npm run dev:test`).
 * Без рамки d5 и двух шагов — ✗ (проверено на коде до 4д-4б).
 */
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунт — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const EMAIL = `round-smoke-${Date.now()}@recall.test`
const PASSWORD = 'RoundSmoke!2026'
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra && !ok ? ` — ${extra}` : ''}`)
}
const waitFor = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 200 }, arg).then(() => true, () => false)

async function openPage(browser, width) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport(width < 600 ? { width, height: 844, isMobile: true, hasTouch: true } : { width, height: 800 })
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('recall.onboarded', '1')
      localStorage.setItem('recall.lang', 'en')
    } catch {
      /* about:blank */
    }
  })
  await page.goto(APP_URL + '/login', { waitUntil: 'networkidle2' })
  await page.waitForSelector('#f-password', { timeout: 15000 })
  await page.evaluate(() => [...document.querySelectorAll('button[type="button"]')].find((b) => b.textContent.trim() === 'Войти')?.click())
  await page.type('#f-email', EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 })
  return page
}

async function openTranslate(page) {
  await page.goto(APP_URL + '/practice?g=words', { waitUntil: 'networkidle2' })
  await waitFor(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Перевод слова')))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Перевод слова'))?.click())
  return page.waitForSelector('button[data-key="1"]', { timeout: 15000 }).then(() => true, () => false)
}

let userId = null
let browser = null
try {
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(error.message)
  userId = data.user.id

  const PORT = 9500 + Math.floor(Math.random() * 300)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('smoke-round')}`, '--no-first-run', 'about:blank'], {
    detached: true,
    stdio: 'ignore',
  }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  // ── 1–4. компьютер ─────────────────────────────────────────────────────────
  const desk = await openPage(browser, 1280)
  check('компьютер: «Перевод слова» открылся', await openTranslate(desk))
  const frame = await desk.evaluate(() => ({
    exit: [...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('Выйти')),
    bar: !!document.querySelector('[role="progressbar"]'),
    count: /1 из \d+/.test(document.body.innerText),
    round: document.querySelector('aside[aria-label="Ход раунда"]')?.textContent.includes('Перевод слова') ?? false,
    keys: document.querySelector('aside[aria-label="Клавиши"]')?.textContent.includes('проверить, дальше') ?? false,
  }))
  check('рамка d5: «Выйти», полоска, «1 из 8», ход раунда и клавиши по бокам', Object.values(frame).every(Boolean), JSON.stringify(frame))

  const checkOff = await desk.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Проверить')?.disabled === true)
  check('«Проверить» выключена, пока ничего не выбрано', checkOff)

  await desk.keyboard.press('2')
  const chosen = await waitFor(desk, () => document.querySelector('button[data-key="2"]')?.getAttribute('aria-pressed') === 'true' && !document.querySelector('[role="status"]'))
  check('клавиша 2 выбирает вариант, итога ещё нет (два шага)', chosen)
  await desk.keyboard.press('Enter')
  const judged = await waitFor(desk, () => /Верно!|Не совсем/.test(document.querySelector('[role="status"]')?.textContent ?? ''))
  const step1 = await desk.evaluate(() => document.querySelector('aside[aria-label="Ход раунда"] li')?.getAttribute('aria-label') ?? '')
  check('Enter проверяет: итог и кружок хода раунда', judged && /^1: (верно|с ошибкой)$/.test(step1), step1)
  await desk.keyboard.press('Enter')
  check('Enter — следующий вопрос, «2 из 8»', await waitFor(desk, () => /2 из \d+/.test(document.body.innerText) && !document.querySelector('[role="status"]')))

  await desk.click('button[data-key="3"]')
  await sleep(200)
  await desk.keyboard.press('Enter')
  check('щелчок мышью и Enter — проверка', await waitFor(desk, () => !!document.querySelector('[role="status"]')))

  await desk.keyboard.press('Escape')
  // после выхода — хаб «Практики»: заголовок экрана (разделы свёрнуты, плитки игры не видно)
  const left = await waitFor(desk, () => !document.querySelector('[role="progressbar"]') && document.querySelector('h1')?.textContent === 'Практика')
  check('Esc — выход в «Практику»', left, await desk.evaluate(() => JSON.stringify({ len: document.body.innerText.length, h1: [...document.querySelectorAll('h1')].map((h) => h.textContent), bar: !!document.querySelector('[role="progressbar"]'), vt: document.documentElement.className })))

  // ── 5. телефон ─────────────────────────────────────────────────────────────
  const phone = await openPage(browser, 390)
  check('телефон: «Перевод слова» открылся', await openTranslate(phone))
  const noCheck = !(await phone.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Проверить')))
  await phone.tap('button[data-key="1"]')
  const instant = await waitFor(phone, () => /Верно!|Не совсем/.test(document.querySelector('[role="status"]')?.textContent ?? ''), null, 4000)
  const sides = await phone.evaluate(() => !!document.querySelector('aside[aria-label="Ход раунда"]'))
  check('телефон: ответ одним нажатием, «Проверить» нет, без боковых полей', noCheck && instant && !sides, JSON.stringify({ noCheck, instant, sides }))
} catch (e) {
  check('смоук дошёл до конца', false, e instanceof Error ? e.message : String(e))
} finally {
  await browser?.close().catch(() => {})
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
}

const passed = results.filter(Boolean).length
console.log(`\nИтог: ${passed}/${results.length}`)
process.exitCode = passed === results.length ? 0 : 1
