/**
 * Смоук «Моих текстов» (Заход 13): вставка текста → чтение → тап по слову →
 * «В колоду» → карточка в БД; загрузка PDF с текстовым слоем → текст извлечён.
 * Запуск: node scripts/smoke-mytexts.mjs (dev-сервер на 5173).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const EMAIL = 'mytexts-smoke@recall.test'
const PASSWORD = 'MyTexts!2026'
const PDF = 'C:/Users/77762/AppData/Local/Temp/claude/d--projects-recall-app/184b1f89-6960-471c-8fae-2cfaf0a9097b/scratchpad/test-text.pdf'

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
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'mytexts-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  })
  userId = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = list.users.find((u) => u.email === EMAIL)?.id
  } else if (error) throw new Error(error.message)

  const PORT = 9353
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpdir()}/recall-mytexts-${Date.now()}`, '--no-first-run', 'about:blank'],
    { detached: true, stdio: 'ignore' }).unref()
  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 90000 })
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
      ;[...document.querySelectorAll('button[type="button"]')]
        .find((b) => b.textContent.trim() === 'Войти')?.click()
    })
    await page.type('#f-email', EMAIL)
    await page.type('#f-password', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })

    // читалка → Свой текст
    await page.goto(BASE + '/study?view=reader', { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1200))
    const addBtn = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        x.textContent.includes('Свой текст'),
      )
      b?.click()
      return !!b
    })
    check('кнопка «Свой текст» найдена', addBtn)
    await page.waitForSelector('textarea[aria-label="Текст"]', { timeout: 10000 })

    // вставка текста
    await page.type('input[aria-label="Название текста"]', 'Смоук-текст')
    await page.type(
      'textarea[aria-label="Текст"]',
      'The brave scientist explored the ancient library every evening.',
    )
    await page.evaluate(() => {
      ;[...document.querySelectorAll('button')]
        .find((b) => b.textContent.includes('Сохранить и читать'))?.click()
    })
    await page.waitForFunction(() => document.body.textContent.includes('ancient library'), {
      timeout: 10000,
    })
    check('текст открылся в читалке', true)

    // тап по слову → шторка → «В колоду». Слова — span с pointer-событиями
    // (не click): down взводит long-press, up без удержания открывает шторку.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('span')].find(
        (x) => x.textContent.trim() === 'scientist' && x.childElementCount === 0,
      )
      if (!el) return
      const fire = (type) =>
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1 }))
      fire('pointerdown')
      fire('pointerup')
    })
    await page.waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => /мои слова/i.test(b.textContent)),
      { timeout: 25000 }, // ждём AI-перевод
    )
    await page.evaluate(() => {
      ;[...document.querySelectorAll('button')].find((b) => /мои слова/i.test(b.textContent))?.click()
    })
    await new Promise((r) => setTimeout(r, 3000))
    const { data: decks } = await admin.from('decks').select('id').eq('owner_id', userId)
    const { count } = await admin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .in('deck_id', decks.map((d) => d.id))
    check('слово из своего текста добавилось в мои слова', (count ?? 0) > 0, `карточек: ${count}`)

    // PDF: назад к списку → Свой текст → из файла
    await page.goto(BASE + '/study?view=reader', { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1000))
    await page.evaluate(() => {
      ;[...document.querySelectorAll('button')]
        .find((x) => x.textContent.includes('Свой текст'))?.click()
    })
    await page.waitForSelector('input[type="file"]', { timeout: 10000 })
    const fileInput = await page.$('input[type="file"]')
    await fileInput.uploadFile(PDF)
    try {
      await page.waitForFunction(
        () => document.querySelector('textarea[aria-label="Текст"]')?.value.includes('waterfall'),
        { timeout: 30000 }, // ленивый чанк pdfjs + парсинг
      )
      check('PDF с текстовым слоем извлечён (waterfall найден)', true)
    } catch {
      const diag = await page.evaluate(() => ({
        textarea: document.querySelector('textarea[aria-label="Текст"]')?.value?.slice(0, 120),
        error: [...document.querySelectorAll('p')]
          .map((p) => p.textContent)
          .filter((t) => /не удалось|нет текстового|Поддерживаются/i.test(t))
          .join(' | '),
      }))
      check('PDF с текстовым слоем извлечён', false, JSON.stringify(diag))
    }
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
