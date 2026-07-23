/**
 * UI-смоук фразовых глаголов (Заход 3): /grammar?verbs=1 (EN) → сегмент
 * «Фразовые» → справочник рендерится (look after) → поиск работает →
 * тренажёр: вопрос с 4 частицами, ответ подсвечивается, «Дальше» двигает раунд.
 * Запуск: node scripts/smoke-phrasal.mjs (dev-сервер на 5173).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const EMAIL = 'phrasal-smoke@recall.test'
const PASSWORD = 'PhrasalSmoke!2026'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

let userId = null
try {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'phrasal-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  userId = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = list.users.find((u) => u.email === EMAIL)?.id
  } else if (error) throw new Error(error.message)

  const PORT = 9341
  spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${tmpdir()}\\recall-phrasal-smoke-${Date.now()}`,
      '--no-first-run',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
      .catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    const jsErrors = []
    page.on('pageerror', (e) => jsErrors.push(String(e)))
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.lang', 'en')
      } catch {}
    })

    // вход
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 })
    await page.waitForSelector('#f-password', { timeout: 15000 })
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button[type="button"]')].find(
        (b) => b.textContent.trim() === 'Войти',
      )
      btn?.click()
    })
    await page.type('#f-email', EMAIL)
    await page.type('#f-password', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })

    // грамматика → Глаголы → Фразовые
    await page.goto(BASE + '/grammar?verbs=1', { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1200))
    const segOk = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.textContent.trim() === 'Фразовые',
      )
      btn?.click()
      return !!btn
    })
    check('сегмент «Фразовые» найден', segOk)
    await page.waitForFunction(() => document.body.textContent.includes('look after'), {
      timeout: 15000,
    })
    check('справочник отрисован (look after виден)', true)

    // поиск
    await page.type('input[aria-label="Поиск по фразовым глаголам"]', 'откладывать')
    await new Promise((r) => setTimeout(r, 400))
    const searchOk = await page.evaluate(
      () =>
        document.body.textContent.includes('put off') &&
        !document.body.textContent.includes('look after'),
    )
    check('поиск по переводу работает (put off)', searchOk)

    // тренажёр
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.textContent.trim() === 'Тренажёр',
      )
      btn?.click()
    })
    await page.waitForFunction(() => document.body.textContent.includes('___'), { timeout: 10000 })
    const q = await page.evaluate(() => {
      // 4 варианта-частицы в сетке
      const grid = document.querySelector('.grid.grid-cols-2')
      return grid ? grid.querySelectorAll('button').length : 0
    })
    check('вопрос тренажёра: 4 варианта', q === 4, `вариантов: ${q}`)

    // ответить (любой вариант) → подсветка + «Дальше»
    await page.evaluate(() => {
      document.querySelector('.grid.grid-cols-2 button')?.click()
    })
    await new Promise((r) => setTimeout(r, 400))
    const nextOk = await page.evaluate(() => {
      return [...document.querySelectorAll('button')].some((b) =>
        /Дальше|Итоги/.test(b.textContent),
      )
    })
    check('после ответа появляется «Дальше»', nextOk)
    check('JS-ошибок нет', jsErrors.length === 0, jsErrors[0] ?? '')
  } finally {
    await browser.close().catch(() => {})
  }
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
  try {
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
  } catch {
    /* некритично */
  }
  console.log('Тестовый аккаунт удалён.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
