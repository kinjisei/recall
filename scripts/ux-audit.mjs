/**
 * UX-аудит экранов Recall по правилам скилла ui-ux-pro-max.
 * Меряет РЕАЛЬНЫЕ значения в headless Edge (390×844, как iPhone 12):
 *   §1 Accessibility — контраст текста (4.5:1 обычный, 3:1 крупный),
 *                      подписи у полей и кнопок-иконок;
 *   §2 Touch         — тач-цели ≥44×44 (кроме inline-ссылок в тексте, WCAG 2.5.5).
 *
 * Запуск:  node scripts/ux-audit.mjs [--theme light]   (нужен `npm run dev:test` — 5174, тестовая база)
 * --theme light — светлая тема, включённая так же, как её включает владелец в
 * /admin (выбор устройства recall.theme); отчёт — ux-audit-report-light.md.
 * Тестовый аккаунт создаётся через service_role и удаляется в конце.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { auditPage } from './_ux-audit-page.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || APP_URL
const EMAIL = 'ux-audit@recall.test'
const PASSWORD = 'UxAudit!2026-temp'
// тема устройства: как переключатель владельца в /admin (shared/ui/theme.ts)
const themeAt = process.argv.indexOf('--theme')
const THEME = themeAt !== -1 && process.argv[themeAt + 1] === 'light' ? 'light' : 'dark'

// ---- ключи из .env.local (без dotenv) ----
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function createTestUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'ux-audit (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error && !/already/i.test(error.message)) throw new Error('createUser: ' + error.message)
  if (data?.user) return data.user.id
  // уже существует — найдём id
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = list.users.find((u) => u.email === EMAIL)
  if (!u) throw new Error('user exists but not found')
  return u.id
}

async function deleteTestUser(id) {
  if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
}

// ---- экраны ----
// lang: 'es' переключает язык приложения перед аудитом экрана (ES-экраны
// отличаются: свои вкладки читалки, спряжения, «Собери фразу»).
const SCREENS = [
  { name: 'Вход', path: '/login', public: true },
  { name: 'Главная', path: '/' },
  { name: 'Практика (хаб)', path: '/practice' },
  { name: 'Учёба', path: '/study' },
  { name: 'Грамматика', path: '/grammar' },
  { name: 'Речь', path: '/pronunciation' },
  { name: 'Диалог', path: '/conversation' },
  { name: 'Прогресс', path: '/progress' },
  { name: 'Настройки', path: '/settings' },
  { name: 'Placement', path: '/placement' },
  { name: 'AI-квесты', path: '/quests' },
  { name: 'Учёба ES', path: '/study', lang: 'es' },
  { name: 'Грамматика ES', path: '/grammar', lang: 'es' },
  { name: 'Практика ES', path: '/practice', lang: 'es' },
  { name: 'Диалог ES', path: '/conversation', lang: 'es' },
  { name: 'Placement ES', path: '/placement', lang: 'es' },
]

const main = async () => {
  let userId = null
  // puppeteer.launch с Edge не работает, когда у пользователя открыт свой Edge:
  // лончер делегирует запуск и сразу выходит (Code: 0). Поэтому запускаем Edge
  // сами и подключаемся к порту отладки.
  const PORT = 9333
  spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${PORT}`,
      // уникальный профиль на запуск: иначе второй прогон делегируется
      // зависшему процессу прошлого и порт не открывается
      `--user-data-dir=${profileDir('recall-ux-audit')}`,
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
  if (!browser) throw new Error('Edge не поднялся на порту ' + PORT)
  try {
    userId = await createTestUser()
    console.log('Тестовый аккаунт готов:', EMAIL)

    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    const consoleErrors = []
    page.on('pageerror', (e) => consoleErrors.push(String(e)))

    // флаги, чтобы не улетать в онбординг/туториал
    await page.evaluateOnNewDocument((theme) => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.deck_tutorial_seen', '1')
        localStorage.setItem('recall.theme', theme)
      } catch {}
    }, THEME)

    const results = []
    let currentLang = 'en'
    for (const s of SCREENS) {
      await page.goto(BASE + s.path, { waitUntil: 'networkidle2', timeout: 30000 })
      if (!s.public && page.url().endsWith('/login') && s.path !== '/login') {
        // залогиниться один раз при первом защищённом экране
        await login(page)
        await page.goto(BASE + s.path, { waitUntil: 'networkidle2', timeout: 30000 })
      }
      // язык читается приложением на старте — при смене нужен reload
      const wantLang = s.lang ?? 'en'
      if (wantLang !== currentLang) {
        await page.evaluate((l) => localStorage.setItem('recall.lang', l), wantLang)
        await page.reload({ waitUntil: 'networkidle2' })
        currentLang = wantLang
      }
      await new Promise((r) => setTimeout(r, 1200)) // ленивые чанки + анимации входа
      const issues = await page.evaluate(auditPage)
      results.push({ screen: s.name, path: s.path, issues })
      console.log(`${s.name} (${s.path}): ${issues.length} замечаний`)
    }

    // отчёт
    const total = results.reduce((n, r) => n + r.issues.length, 0)
    let md = `# UX-аудит Recall — ${new Date().toISOString().slice(0, 10)}, тема: ${THEME}\n\nВсего замечаний: **${total}**\n`
    for (const r of results) {
      md += `\n## ${r.screen} (${r.path}) — ${r.issues.length}\n`
      for (const i of r.issues) md += `- [${i.type}] ${i.detail}\n`
    }
    if (consoleErrors.length) md += `\n## JS-ошибки\n` + consoleErrors.map((e) => `- ${e}`).join('\n')
    const file = THEME === 'light' ? 'ux-audit-report-light.md' : 'ux-audit-report.md'
    const out = new URL(`../${file}`, import.meta.url)
    writeFileSync(out, md, 'utf8')
    console.log(`\nИтого: ${total} замечаний (тема: ${THEME}). Отчёт: ${file}`)
    if (consoleErrors.length) console.log('JS-ошибок:', consoleErrors.length)
  } finally {
    await browser.close()
    await deleteTestUser(userId)
    console.log('Тестовый аккаунт удалён.')
  }
}

async function login(page) {
  // экран открывается в режиме регистрации — переключаемся на вход
  await page.waitForSelector('#f-password', { timeout: 15000 })
  const toggled = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="button"]')].find(
      (b) => b.textContent.trim() === 'Войти',
    )
    if (btn) btn.click()
    return !!btn
  })
  if (!toggled) throw new Error('не нашёл переключатель «Войти»')
  await page.type('#f-email', EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000, polling: 250 })
  await new Promise((r) => setTimeout(r, 800))
}

main().catch((e) => {
  console.error('Аудит упал:', e)
  process.exitCode = 1
})
