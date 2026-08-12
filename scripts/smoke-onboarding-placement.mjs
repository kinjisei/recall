/**
 * Смоук стыка «онбординг → тест уровня» (баг захода 1, HIGH).
 * Новичок (нет активности, флаг recall.onboarded НЕ выставлен) заходит в
 * онбординг, выбирает язык, жмёт «Пройти тест» — и должен ОКАЗАТЬСЯ на тесте,
 * а не улететь обратно на шаг 1. Проверяем оба языка.
 *
 * До фикса onboarding-гвард в ProtectedRoute бэунсил /placement обратно на
 * /onboarding, и тест был недостижим для нового пользователя.
 *
 * Запуск: node scripts/smoke-onboarding-placement.mjs (dev-сервер на 5173)
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const PASSWORD = 'Onb!2026'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
// ref проекта из URL — под ключом sb-<ref>-auth-token supabase-js хранит сессию
const REF = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function freshUser(email) {
  await admin.from('allowed_emails').upsert({ email, note: 'onb-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === email)?.id
    // на всякий случай чистим активность, чтобы аккаунт считался новичком
    await admin.from('activity_log').delete().eq('user_id', id)
  } else if (error) throw new Error(error.message)
  return id
}

/**
 * Логин без UI: получаем сессию в Node и кладём её в localStorage до загрузки
 * страницы — supabase-js подхватит её на старте. Надёжнее флейкового ввода в
 * headless Edge и не зависит от вёрстки экрана входа.
 */
async function authSession(email) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return data.session
}

const clickText = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').includes(t),
    )
    if (el) el.click()
    return !!el
  }, text)

async function run(browser, lang) {
  const email = `onb-${lang}@recall.test`
  const id = await freshUser(email)
  try {
    const session = await authSession(email)
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true })
    // ВАЖНО: recall.onboarded НЕ выставляем — гвард должен быть активен.
    // Сессию и язык кладём ДО загрузки страницы; onboarded НЕ ставим.
    await page.evaluateOnNewDocument(
      (l, ref, sess) => {
        try {
          localStorage.setItem('recall.lang', l)
          localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess))
        } catch {}
      },
      lang,
      REF,
      session,
    )

    // новичка приложение само уводит на /onboarding
    await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1200))

    // шаг 1: выбрать язык (кнопка с описанием языка)
    const langLabel = lang === 'es' ? 'Испанский' : 'Английский'
    await clickText(page, langLabel)
    await new Promise((r) => setTimeout(r, 800))

    // шаг 2: нажать «Пройти тест»
    const tapped = await clickText(page, 'Пройти тест')
    check(`[${lang}] кнопка «Пройти тест» есть`, tapped)
    await new Promise((r) => setTimeout(r, 2000))

    const url = page.url()
    const onPlacement = url.endsWith('/placement')
    check(`[${lang}] дошли до /placement, не бэунснуло на онбординг`, onPlacement, url.replace(BASE, ''))

    // на тесте виден экран старта или вопрос (а не редирект)
    const hasTest = await page.evaluate(() => {
      const t = document.querySelector('main')?.innerText ?? ''
      return /Начать тест|Определи|вопрос|уровень/i.test(t)
    })
    check(`[${lang}] на экране реально тест уровня`, onPlacement && hasTest)

    await page.close()
  } finally {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', email)
  }
}

const main = async () => {
  const PORT = 9600 + (Date.now() % 300)
  spawn(EDGE, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir('recall-onb')}`, '--no-first-run', 'about:blank',
  ], { detached: true, stdio: 'ignore' }).unref()

  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    await run(browser, 'es')
    await run(browser, 'en')
  } finally {
    await browser.close().catch(() => {})
  }

  const failed = results.filter((r) => !r).length
  console.log(`\n${results.length - failed}/${results.length} проверок прошло`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
