/**
 * Смоук: отказ AI «энергия закончилась» на экране (PLAN.md Ф2.17-4д-1).
 *
 * Сервер отвечает на бесплатном тарифе текстом «…это 5 ⚡ в день…»
 * (api/_auth.ts, RECALL_FREE_LIMIT). Экран показывает его общим ErrorText:
 * строка-тревога (role="alert"), цвет danger-strong, энергия — значком, а
 * символ «⚡» остаётся только скрытым для чтения с экрана. До 4д-1 «Диалог»
 * печатал своим абзацем бледным красным и символом.
 *
 * Самоучка из тестовой студии открывает «Диалог», пишет реплику; запрос к
 * /api/gemini перехватывается и получает ответ 429 с текстом сервера — AI и
 * энергия не тратятся. Кадры — `--shots <папка>` (390 и 1280).
 *
 * Умеет краснеть: убери BoltText из ErrorText — проверка «значком» упадёт.
 * Запуск: `npm run dev:test` (5174), затем `node scripts/smoke-ai-error.mjs`.
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { APP_URL } from './_env.mjs'
import { profileDir } from './_profile.mjs'
import { PASS, studio } from './_seed-studio.mjs'
import { settledScreenshot } from './_shots.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt !== -1 ? process.argv[shotsAt + 1] : null
// текст сервера дословно (api/_auth.ts, RECALL_FREE_LIMIT)
const FREE_LIMIT =
  'Энергия на сегодня закончилась — на бесплатном тарифе это 5 ⚡ в день. ' +
  'Вернётся утром. Слова, тексты и игры работают без лимитов; ' +
  'больше AI даёт Premium — раздел «Тарифы» в настройках.'

const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra && !ok ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const st = studio('ai-error')
let browser
try {
  const { solo } = await st.seed()
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('ai-error-smoke')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
  }
  for (const width of [390, 1280]) {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    await page.setViewport(width < 600 ? { width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height: 800 })
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (req.url().includes('/api/gemini')) {
        req.respond({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: FREE_LIMIT, code: 'RECALL_FREE_LIMIT' }) })
      } else req.continue()
    })
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
    await page.evaluate(() => {
      localStorage.setItem('recall.onboarded', '1')
      localStorage.setItem('recall.theme', 'light')
    })
    await page.evaluate(() => [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')?.click())
    await sleep(500)
    await page.type('input[type=email]', solo.email)
    await page.type('input[type=password]', PASS)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => !location.pathname.startsWith('/login'), { polling: 250, timeout: 20000 })
    await page.goto(`${APP_URL}/conversation`, { waitUntil: 'networkidle2' })
    const input = await page.waitForSelector('form input[aria-label]', { timeout: 15000 })
    await input.type('Hello! How are you?')
    await page.keyboard.press('Enter')
    const shown = await page
      .waitForFunction(() => [...document.querySelectorAll('[role=alert]')].some((e) => /Энергия на сегодня закончилась/.test(e.textContent ?? '')), { polling: 250, timeout: 15000 })
      .then(() => true)
      .catch(() => false)
    const look = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role=alert]')].find((e) => /Энергия на сегодня закончилась/.test(e.textContent ?? ''))
      if (!el) return null
      const hidden = [...el.querySelectorAll('.sr-only')].map((e) => e.textContent).join('')
      const all = (el.textContent ?? '').split('⚡').length - 1
      return { svg: !!el.querySelector('svg'), bolts: all, hiddenBolts: hidden.split('⚡').length - 1, color: getComputedStyle(el).color }
    })
    check(`${width}: отказ сервера — строкой-тревогой (role="alert")`, shown)
    check(`${width}: энергия — значком, символ «⚡» только для чтения с экрана`, !!look?.svg && look.bolts === 1 && look.hiddenBolts === 1, JSON.stringify(look))
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true })
      await settledScreenshot(page, { path: join(SHOTS, `ai-error-${width}.png`) })
    }
    await ctx.close()
  }
} catch (e) {
  check(`прогон без сбоя (${e.message})`, false)
} finally {
  await browser?.close().catch(() => {})
  await st.cleanup()
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
