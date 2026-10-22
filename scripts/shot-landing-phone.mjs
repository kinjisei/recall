/**
 * Снимок для лендинга (d15, «Между уроками ученик не пропадает»): Главная
 * ученика на телефоне — настоящий экран Recall, а не иллюстрация.
 *
 * Ученица Айгерим из тестовой студии (_seed-studio.mjs: серия, план дня,
 * домашка от преподавателя), 390 × 844, плотность 2, светлая тема «Сумерки»,
 * WebP → public/landing/student-home.webp. Переснять, когда Главная
 * изменится: `npm run dev:test`, затем `node scripts/shot-landing-phone.mjs`.
 * Данные — только в ТЕСТОВОЙ базе, AI и письма не трогаются; аккаунты
 * удаляются в конце.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { APP_URL } from './_env.mjs'
import { profileDir } from './_profile.mjs'
import { PASS, studio } from './_seed-studio.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = join(import.meta.dirname, '../public/landing/student-home.webp')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const st = studio('landing-phone')
let browser
let failed = false
try {
  const { a } = await st.seed()
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('landing-phone')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null }).catch(() => null)
  }
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => {
    localStorage.setItem('recall.onboarded', '1')
    localStorage.setItem('recall.palette', 'twilight')
    localStorage.setItem('recall.theme', 'light')
  })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')?.click())
  await sleep(500)
  await page.type('input[type=email]', a.email)
  await page.type('input[type=password]', PASS)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 })
  // тема применяется при загрузке страницы, а после входа приложение ушло на Главную без неё
  await page.evaluate(() => {
    localStorage.setItem('recall.palette', 'twilight')
    localStorage.setItem('recall.theme', 'light')
  })
  await page.reload({ waitUntil: 'networkidle2' })
  // Главная собрана: серия и план дня на месте, скелетонов нет
  await page.waitForFunction(() => /План на сегодня/.test(document.body.innerText) && !document.querySelector('[data-skeleton], .animate-pulse'), { polling: 250, timeout: 20000 })
  await sleep(1500)
  mkdirSync(join(OUT, '..'), { recursive: true })
  await page.screenshot({ path: OUT, type: 'webp', quality: 82 })
  console.log(`✓ ${OUT} — ${Math.round(statSync(OUT).size / 1024)} КБ`)
} catch (e) {
  failed = true
  console.log(`✗ снимок не снят: ${e.message}`)
} finally {
  await browser?.close().catch(() => {})
  await st.cleanup()
}
process.exit(failed ? 1 : 0)
