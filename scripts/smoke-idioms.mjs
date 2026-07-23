/**
 * UI-смоук идиом (Заход 4): Учёба → Слова → Паки → темы «Идиомы: …» видны,
 * пак раскрывается и слова добавляются в колоду (счётчик > 0).
 * Запуск: node scripts/smoke-idioms.mjs (dev-сервер на 5173).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const EMAIL = 'idioms-smoke@recall.test'
const PASSWORD = 'IdiomsSmoke!2026'

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
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'idioms-smoke (временный)' })
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

  const PORT = 9343
  spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${tmpdir()}\\recall-idioms-smoke-${Date.now()}`,
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

    // Учёба → Слова → Паки
    await page.goto(BASE + '/study', { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1000))
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('button, a')].find((b) =>
        b.textContent.includes('Слова'),
      )
      el?.click()
    })
    await new Promise((r) => setTimeout(r, 800))
    const packsOpened = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button')].find((b) =>
        b.textContent.includes('Паки слов'),
      )
      el?.click()
      return !!el
    })
    check('кнопка «Паки слов» найдена', packsOpened)

    await page.waitForFunction(() => document.body.textContent.includes('Идиомы:'), {
      timeout: 20000,
    })
    const topicOk = await page.evaluate(
      () =>
        document.body.textContent.includes('Идиомы: Время') ||
        document.body.textContent.includes('Идиомы: Деньги'),
    )
    check('темы «Идиомы: …» видны в паках', topicOk)

    // тема — строка списка с отдельной кнопкой «+ Добавить» рядом
    const added = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('div, li')].filter(
        (el) => el.textContent.includes('Идиомы:') && el.querySelector('button'),
      )
      // самый вложенный контейнер строки — последний в списке
      const row = rows[rows.length - 1]
      if (!row) return 'нет строки темы'
      const addBtn = [...row.querySelectorAll('button')].find((b) =>
        b.textContent.includes('Добавить'),
      )
      if (!addBtn) return 'нет кнопки добавления'
      addBtn.click()
      return 'ok'
    })
    check('пак идиом раскрыт и добавлен', added === 'ok', added)
    await new Promise((r) => setTimeout(r, 2500))

    const { count } = await admin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .in(
        'deck_id',
        (await admin.from('decks').select('id').eq('owner_id', userId)).data.map((d) => d.id),
      )
    check('карточки-идиомы появились в колоде', (count ?? 0) > 0, `карточек: ${count}`)
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
