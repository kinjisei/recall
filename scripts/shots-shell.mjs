/**
 * Снимки каркаса на разных ширинах (PLAN.md Ф2.17-1, правила d0): меню 240,
 * рельс 72, нижняя панель; поля и пределы содержимого; правая панель поверх
 * или со сдвигом. Ключевые экраны ученицы с репетитором и студии Мадины
 * (данные — `_seed-studio.mjs`, AI не вызывается, аккаунты удаляются сами).
 *
 *   npm run dev:test, затем
 *   node scripts/shots-shell.mjs [папка] [--widths 390,720,1280] [--theme light]
 *
 * По умолчанию — папка shots-shell/, ширины 390 · 720 · 1024 · 1280 · 1440 ·
 * 1920, тёмная тема. Снимки «до» и «после» правки — в разные папки, сравнение
 * глазами рядом или `shots-compare.mjs --compare`. Входов всего два (ученица и
 * репетитор): ширина меняется в той же вкладке, иначе упираемся в лимит
 * входов Supabase.
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL } from './_env.mjs'
import { PASS, studio } from './_seed-studio.mjs'
import { settledScreenshot } from './_shots.mjs'

if (process.argv.includes('--prod')) {
  console.error('Снимки заводят аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'shots-shell'
const WIDTHS = (arg('--widths') ?? '390,720,1024,1280,1440,1920').split(',').map(Number)
const THEME = arg('--theme') === 'light' ? 'light' : 'dark'
const HEIGHT = { 390: 844, 1440: 900, 1920: 1000 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = studio('shots-shell')
const report = []
let browser = null

async function newPage() {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.evaluateOnNewDocument((theme) => {
    try {
      localStorage.setItem('recall.theme', theme)
      localStorage.setItem('recall.lang', 'en')
      localStorage.setItem('recall.onboarded', '1')
    } catch {
      /* about:blank */
    }
  }, THEME)
  return page
}

async function size(page, width) {
  const height = HEIGHT[width] ?? 800
  await page.setViewport(width < 600 ? { width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height })
}

async function signIn(page, email) {
  await size(page, 1280)
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Войти')?.click())
  await sleep(600)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 30000, polling: 250 })
  await sleep(1200)
}

/** Открыть адрес на ширине и снять; expect — регэксп по тексту: экран тот. */
async function snap(page, width, name, path, expect, { fullPage = true, before } = {}) {
  await size(page, width)
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
  await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout: 15000 }, expect.source).catch(() => {})
  await sleep(1500)
  if (before) await before(page)
  const ok = expect.test(await page.evaluate(() => document.body.innerText))
  report.push(`${ok ? '✓' : '✗'} ${name}-${width}`)
  const file = `${DIR}/${name}-${width}.png`
  await settledScreenshot(page, { path: file, fullPage })
  console.log(`${ok ? 'снимок' : 'НЕ ТОТ ЭКРАН'} ${file}`)
}

/** Нажать кнопку по подписи (не в меню). */
async function press(page, label) {
  await page.evaluate((l) => [...document.querySelectorAll('main button, main a')].find((x) => x.textContent.trim().includes(l) || x.getAttribute('aria-label') === l)?.click(), label)
  await sleep(1200)
}

try {
  const { t, a, ca } = await st.seed()
  mkdirSync(DIR, { recursive: true })
  const PORT = 9500 + Math.floor(Math.random() * 200)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('shots-shell')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  const sp = await newPage()
  await signIn(sp, a.email)
  const tp = await newPage()
  await signIn(tp, t.email)

  for (const w of WIDTHS) {
    console.log(`── ширина ${w}`)
    await snap(sp, w, 'home', '/', /Начать занятие|Start/i)
    await snap(sp, w, 'reading', '/study?view=reader', /Чтение|Reading|текст/i)
    await snap(sp, w, 'exercise', '/practice?m=review', /reluctant|although|accommodation|bargain|deadline/i, { fullPage: false })
    await snap(tp, w, 'schedule', '/schedule', /Расписание|урок/i)
    await snap(tp, w, 'schedule-sheet', '/schedule', /Новый урок/, { fullPage: false, before: (p) => press(p, 'Новый урок') })
    await snap(tp, w, 'students', `/teacher?student=${ca}`, /Айгерим/)
    await snap(tp, w, 'tasks', '/tasks', /Задания/)
  }
} finally {
  await browser?.close().catch(() => {})
  await st.cleanup()
  console.log('\n' + report.join('\n'))
  if (report.some((r) => r.startsWith('✗'))) process.exitCode = 1
}
