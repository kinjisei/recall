/**
 * Смоук каркаса (src/app): доступ по таблице маршрутов.
 *
 * Зачем. С PLAN.md Ф1.3 кто куда пускается, решает таблица app/routes.ts, а не
 * экран: админку проверяет RoleGate по флагу role: 'admin'. Раньше владельца
 * проверяла сама админка. Смоук держит, что перенос ничего не открыл и не
 * закрыл лишнего:
 *   1. обычный пользователь на /admin видит «Доступно только владельцу», а не
 *      саму админку;
 *   2. владелец (is_admin) видит админку.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем `node scripts/smoke-shell.mjs`.
 * Аккаунт создаётся и удаляется сам (service_role тестовой базы).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const EMAIL = 'shell-smoke@recall.test'
const PASSWORD = 'ShellSmoke!2026'

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Есть ли на экране такой текст. */
const seen = (page, text) => page.evaluate((t) => (document.body.innerText || '').includes(t), text)

/** Заголовок экрана — «Админка» есть только у самой админки. */
const heading = (page) => page.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')

/** Дождаться текста (polling: в headless-вкладке кадры не выдаются). */
const waitText = (page, text, timeout = 15000) =>
  page
    .waitForFunction((t) => (document.body.innerText || '').includes(t), { polling: 250, timeout }, text)
    .then(() => true)
    .catch(() => false)

async function createUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'shell-smoke (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = cu?.user?.id ?? null
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!id) throw new Error('не удалось получить id тестового пользователя')
  // онбординг считаем пройденным, иначе ProtectedRoute уведёт на /onboarding
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  await admin.from('profiles').update({ level: 'B1', is_admin: false }).eq('id', id)
  return id
}

async function openBrowser() {
  // порт свой на каждый прогон: фиксированный ловил ЧУЖОЙ живой Edge с чужой сессией
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('shell-smoke')}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const b = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120000 })
      .catch(() => null)
    if (b) return b
  }
  throw new Error('Edge не поднялся')
}

async function main() {
  const userId = await createUser()
  const browser = await openBrowser()
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  // вход
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')
    b?.click()
  })
  await sleep(500)
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 }).catch(() => {})

  // ── 1. доступ по роли: админка ──────────────────────────────────────────
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  const denied = await waitText(page, 'Доступно только владельцу')
  check('не владелец на /admin видит отказ', denied)
  check('не владелец не видит саму админку', (await heading(page)) !== 'Админка', await heading(page))

  await admin.from('profiles').update({ is_admin: true }).eq('id', userId)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  check('владелец на /admin видит админку', await waitText(page, 'Email или его часть') || (await heading(page)) === 'Админка', await heading(page))
  check('у владельца нет отказа', !(await seen(page, 'Доступно только владельцу')))
  await admin.from('profiles').update({ is_admin: false }).eq('id', userId)

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '))

  await browser.close()
  await admin.auth.admin.deleteUser(userId).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
  console.log('Тестовый аккаунт удалён.')

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  // process.exit() с открытыми сокетами роняет node на Windows (libuv assert)
  process.exitCode = ok === results.length ? 0 : 1
}

main().catch((e) => {
  console.error('Смоук упал:', e)
  process.exitCode = 1
})
