/**
 * Скриншоты нового контента для визуальной проверки: фразовые (справочник,
 * тренажёр), паки идиом. Кладёт PNG в scratchpad. Одноразовый помощник.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const EMAIL = 'shot-smoke@recall.test'
const PASSWORD = 'ShotSmoke!2026'
const OUT = 'C:\\Users\\77762\\AppData\\Local\\Temp\\claude\\d--projects-recall-app\\184b1f89-6960-471c-8fae-2cfaf0a9097b\\scratchpad'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let userId = null
try {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'shot (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  })
  userId = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = list.users.find((u) => u.email === EMAIL)?.id
  } else if (error) throw new Error(error.message)

  const PORT = 9345
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpdir()}\\recall-shot-${Date.now()}`, '--no-first-run', 'about:blank'],
    { detached: true, stdio: 'ignore' }).unref()
  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('recall.onboarded', '1'); localStorage.setItem('recall.lang', 'en') } catch {}
  })

  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' })
  await page.waitForSelector('#f-password', { timeout: 15000 })
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="button"]')].find((b) => b.textContent.trim() === 'Войти')
    btn?.click()
  })
  await page.type('#f-email', EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })

  // 1. фразовые: справочник
  await page.goto(BASE + '/grammar?verbs=1', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1200))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Фразовые')
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 1000))
  await page.screenshot({ path: OUT + '\\shot-phrasal-ref.png' })

  // 2. фразовые: тренажёр (с ответом)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Тренажёр')
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 700))
  await page.evaluate(() => document.querySelector('.grid.grid-cols-2 button')?.click())
  await new Promise((r) => setTimeout(r, 500))
  await page.screenshot({ path: OUT + '\\shot-phrasal-trainer.png' })

  // 3. паки: идиомы раскрыты
  await page.goto(BASE + '/study', { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 900))
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.includes('Слова'))
    el?.click()
  })
  await new Promise((r) => setTimeout(r, 700))
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Паки слов'))
    el?.click()
  })
  await new Promise((r) => setTimeout(r, 1500))
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('div, li')].filter(
      (el) => el.textContent.includes('Идиомы:') && el.querySelector('button'),
    )
    rows[rows.length - 1]?.scrollIntoView()
  })
  await new Promise((r) => setTimeout(r, 400))
  await page.screenshot({ path: OUT + '\\shot-idiom-packs.png' })

  await browser.close()
  console.log('скриншоты готовы')
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
  try { await admin.from('allowed_emails').delete().eq('email', EMAIL) } catch {}
}
