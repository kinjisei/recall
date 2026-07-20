/**
 * UX-аудит экранов Recall по правилам скилла ui-ux-pro-max.
 * Меряет РЕАЛЬНЫЕ значения в headless Edge (390×844, как iPhone 12):
 *   §1 Accessibility — контраст текста (4.5:1 обычный, 3:1 крупный),
 *                      подписи у полей и кнопок-иконок;
 *   §2 Touch         — тач-цели ≥44×44 (кроме inline-ссылок в тексте, WCAG 2.5.5).
 *
 * Запуск:  node scripts/ux-audit.mjs   (dev-сервер должен работать на 5173)
 * Тестовый аккаунт создаётся через service_role и удаляется в конце.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const EMAIL = 'ux-audit@recall.test'
const PASSWORD = 'UxAudit!2026-temp'

// ---- ключи из .env.local (без dotenv) ----
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
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

/** Выполняется В СТРАНИЦЕ: собирает замечания по контрасту, тач-целям и подписям. */
function auditPage() {
  const issues = []
  const BASE_BG = [22, 24, 38] // #161826

  const parseColor = (s) => {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
    if (!m) return null
    return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
  }
  const blend = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3])
    if (a === 0) return [0, 0, 0, 0]
    return [
      (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / a,
      (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / a,
      (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / a,
      a,
    ]
  }
  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (c1, c2) => {
    const [l1, l2] = [lum(c1), lum(c2)].sort((a, b) => b - a)
    return (l1 + 0.05) / (l2 + 0.05)
  }

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    if (el.closest('[aria-hidden="true"]')) return false
    return true
  }

  // фон элемента: идём вверх, копим полупрозрачные слои до первого непрозрачного
  const effectiveBg = (el) => {
    const layers = []
    let node = el
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node)
      if (cs.backgroundImage !== 'none') return null // градиент — не посчитать честно
      const c = parseColor(cs.backgroundColor)
      if (c && c[3] > 0) {
        layers.push(c)
        if (c[3] >= 1) break
      }
      node = node.parentElement
    }
    let bg = [...BASE_BG, 1]
    for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg)
    return bg
  }

  const snippet = (el) =>
    (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) || '<без текста>'

  // ---- 1. Контраст текста ----
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    const hasText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
    )
    if (!hasText || !visible(el)) continue
    // WCAG исключает неактивные контролы из требований к контрасту
    if (el.closest(':disabled, [aria-disabled="true"]')) continue
    const cs = getComputedStyle(el)
    // суммарная прозрачность по предкам
    let op = 1
    for (let n = el; n && n !== document.body; n = n.parentElement) op *= +getComputedStyle(n).opacity
    if (op < 0.5) continue // исчезающие/анимируемые
    const fgRaw = parseColor(cs.color)
    const bg = effectiveBg(el)
    if (!fgRaw || !bg) continue
    const fg = blend([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * op], bg)
    const r = ratio(fg, bg)
    const size = parseFloat(cs.fontSize)
    const weight = +cs.fontWeight || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = large ? 3 : 4.5
    if (r < need) {
      const key = snippet(el) + '|' + cs.color
      if (!seen.has(key)) {
        seen.add(key)
        issues.push({
          type: 'contrast',
          detail: `${r.toFixed(2)}:1 (нужно ${need}:1, ${Math.round(size)}px) — «${snippet(el)}»`,
        })
      }
    }
  }

  // ---- 2. Тач-цели ≥44×44 ----
  const targets = document.querySelectorAll(
    'a, button, input, select, textarea, [role="button"], [role="tab"]',
  )
  for (const el of targets) {
    if (!visible(el)) continue
    if (el.disabled) continue
    const r = el.getBoundingClientRect()
    if (r.width >= 44 && r.height >= 44) continue
    // исключение WCAG 2.5.5: inline-ссылка внутри предложения
    const cs = getComputedStyle(el)
    const parentText = (el.parentElement?.textContent || '').trim()
    const ownText = (el.textContent || '').trim()
    if (cs.display === 'inline' && parentText.length > ownText.length + 5) continue
    issues.push({
      type: 'touch',
      detail: `${Math.round(r.width)}×${Math.round(r.height)} — <${el.tagName.toLowerCase()}> «${snippet(el)}»`,
    })
  }

  // ---- 3. Подписи ----
  for (const el of document.querySelectorAll('input, textarea, select')) {
    if (!visible(el)) continue
    if (['hidden', 'submit', 'button'].includes(el.type)) continue
    const labelled =
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      (el.labels && el.labels.length > 0)
    if (!labelled)
      issues.push({ type: 'label', detail: `поле без label/aria-label: ${el.type || el.tagName} «${el.placeholder || el.id || ''}»` })
  }
  for (const el of document.querySelectorAll('button, a, [role="button"]')) {
    if (!visible(el)) continue
    const hasText = (el.textContent || '').trim().length > 0
    const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title
    if (!hasText && !labelled)
      issues.push({ type: 'label', detail: `кнопка-иконка без aria-label: <${el.tagName.toLowerCase()} class="${(el.className || '').toString().slice(0, 50)}">` })
  }

  return issues
}

// ---- экраны ----
// lang: 'es' переключает язык приложения перед аудитом экрана (ES-экраны
// отличаются: свои вкладки читалки, спряжения, «Собери фразу»).
const SCREENS = [
  { name: 'Вход', path: '/login', public: true },
  { name: 'Главная', path: '/' },
  { name: 'Слова (хаб)', path: '/flashcards' },
  { name: 'Учёба', path: '/study' },
  { name: 'Грамматика', path: '/grammar' },
  { name: 'Речь', path: '/pronunciation' },
  { name: 'Диалог', path: '/conversation' },
  { name: 'Прогресс', path: '/progress' },
  { name: 'Настройки', path: '/settings' },
  { name: 'Placement', path: '/placement' },
  { name: 'Учёба ES', path: '/study', lang: 'es' },
  { name: 'Грамматика ES', path: '/grammar', lang: 'es' },
  { name: 'Слова ES', path: '/flashcards', lang: 'es' },
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
      `--user-data-dir=${tmpdir()}\\recall-ux-audit-${Date.now()}`,
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
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.deck_tutorial_seen', '1')
      } catch {}
    })

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
    let md = `# UX-аудит Recall — ${new Date().toISOString().slice(0, 10)}\n\nВсего замечаний: **${total}**\n`
    for (const r of results) {
      md += `\n## ${r.screen} (${r.path}) — ${r.issues.length}\n`
      for (const i of r.issues) md += `- [${i.type}] ${i.detail}\n`
    }
    if (consoleErrors.length) md += `\n## JS-ошибки\n` + consoleErrors.map((e) => `- ${e}`).join('\n')
    const out = new URL('../ux-audit-report.md', import.meta.url)
    writeFileSync(out, md, 'utf8')
    console.log(`\nИтого: ${total} замечаний. Отчёт: ux-audit-report.md`)
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
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 800))
}

main().catch((e) => {
  console.error('Аудит упал:', e)
  process.exitCode = 1
})
