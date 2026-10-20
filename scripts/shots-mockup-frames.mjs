/**
 * Кадры макетов → PNG для сверки «кадр | снимок» (PLAN.md Ф2.17-4).
 *
 * Макет в `design/mockups/*.html` — доска: каждая `section.board` — ряд
 * кадров (iframe) с подписями «d10-2 · 1280 · Сумерки · светлая · …». Скрипт
 * снимает каждую доску целиком в `<папка>/<макет>-NN.png` и кладёт рядом
 * тексты всех кадров (`<макет>.txt`) и оглавление (`index.txt`: файл и
 * подпись первой доски) — по ним видно, какой номер у нужного кадра.
 * Где именно кадр на доске (левый край, верх) — `shots-pairs.mjs` найдёт
 * верх сам, левый край — 24 px у первого кадра ряда, дальше + ширина + 40.
 *
 * Запуск: node scripts/shots-mockup-frames.mjs <папка> design/mockups/d7-tasks.html …
 * Сеть и база не нужны; ~20 с на макет.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [outDir, ...files] = process.argv.slice(2)
if (!outDir || !files.length) {
  console.error('Запуск: node scripts/shots-mockup-frames.mjs <папка> <макет.html> …')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const PORT = 9700 + Math.floor(Math.random() * 200)
spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('mockup-frames')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
let browser = null
for (let i = 0; i < 30 && !browser; i++) {
  await sleep(500)
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 300000 }).catch(() => null)
}
if (!browser) {
  console.error('Edge не поднялся')
  process.exit(1)
}

const index = []
try {
  for (const file of files) {
    const name = basename(file, '.html')
    const page = await browser.newPage()
    await page.setViewport({ width: 1600, height: 1000 })
    await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load', timeout: 120000 })
    // макет — бандл: пока он разворачивается, на странице заглушка загрузки
    await page.waitForFunction(() => !document.getElementById('__bundler_loading'), { polling: 250, timeout: 120000 }).catch(() => {})
    await sleep(2500)
    const boards = await page.$$('section.board')
    for (let i = 0; i < boards.length; i++) {
      const title = await boards[i].evaluate((b) => b.querySelector('iframe')?.title || b.innerText.slice(0, 80))
      await boards[i].evaluate((b) => b.scrollIntoView())
      await sleep(400)
      const png = `${outDir}/${name}-${String(i + 1).padStart(2, '0')}.png`
      await boards[i].screenshot({ path: png })
      index.push(`${png}\t${title}`)
      console.log(png, '—', title)
    }
    // тексты кадров: всё, что внутри iframe, — подписи кадров и надписи экранов
    const texts = []
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue
      try {
        texts.push('=== ' + (await f.title()) + '\n' + (await f.evaluate(() => document.body.innerText)))
      } catch {
        /* кадр без доступа — пропускаем */
      }
    }
    writeFileSync(`${outDir}/${name}.txt`, texts.join('\n\n'))
    await page.close()
  }
  writeFileSync(`${outDir}/index.txt`, index.join('\n'))
} finally {
  await browser.close().catch(() => {})
}
process.exit(0)
