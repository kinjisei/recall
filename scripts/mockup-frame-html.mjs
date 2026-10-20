/**
 * HTML кадров макета — для точных размеров, отступов и цветов (PLAN.md
 * Ф2.17-4, «Порядок захода», шаг 2). Макет в `design/mockups/*.html` — сжатый
 * бандл: CSS кадра видно только в развёрнутой странице. Скрипт разворачивает
 * её в Edge и пишет в один файл документ каждого кадра (iframe), чей
 * заголовок начинается с <начало> (`t5-2`, `d2 · перенос`; пусто — все
 * кадры). Заголовки кадров — первые строки `=== …` в `<макет>.txt` от
 * `shots-mockup-frames.mjs`.
 *
 * Запуск: node scripts/mockup-frame-html.mjs <макет.html> <начало заголовка> <out.html>
 * Правила CSS по классу: node -e "…split('}')…" (так в 4б-3 сняты .rad, .dpan).
 * Сеть и база не нужны; ~20 с.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [file, prefix, out] = process.argv.slice(2)
const PORT = 9700 + Math.floor(Math.random() * 200)
spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('mockup-frames')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
let browser = null
for (let i = 0; i < 30 && !browser; i++) {
  await sleep(500)
  browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 300000 }).catch(() => null)
}
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load', timeout: 120000 })
  await page.waitForFunction(() => !document.getElementById('__bundler_loading'), { polling: 250, timeout: 120000 }).catch(() => {})
  await sleep(2500)
  const parts = []
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue
    const t = await f.title().catch(() => '')
    if (!t.startsWith(prefix)) continue
    parts.push('<!-- ' + t + ' -->\n' + (await f.evaluate(() => document.documentElement.outerHTML)))
  }
  writeFileSync(out, parts.join('\n\n'))
  console.log('кадров:', parts.length)
} finally {
  await browser.close().catch(() => {})
}
process.exit(0)
