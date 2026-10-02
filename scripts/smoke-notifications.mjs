/**
 * Смоук колокольчика и ленты уведомлений (PLAN.md Ф1.5; архитектура §17).
 *
 * Решение владельца 28.09.2026: колокольчик появляется у человека, только
 * когда у него есть хоть одно уведомление. Проверяем путь человека:
 *   1. уведомлений нет — колокольчика нет ни в шапке, ни в боковом меню;
 *   2. правило прислало (здесь — notify() служебным ключом, как это делает
 *      будильник) — колокольчик появился с цифрой непрочитанных;
 *   3. открыл ленту — видно уведомление, оно выделено как новое, цифра ушла,
 *      в базе отмечено прочитанным;
 *   4. новое пришло, пока приложение открыто, — цифра появляется при
 *      возвращении в приложение, без перезагрузки;
 *   5. уведомление со ссылкой ведёт на свой экран и закрывает ленту;
 *   6. компьютер: колокольчик в боковом меню, лента — панелью справа;
 *   7. второй заход: колокольчик рисуется сразу (помним на устройстве), даже
 *      если сеть медленная, — шапка не прыгает.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-notifications.mjs [--shots <папка>]`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const EMAIL = 'notif-smoke@recall.test'
const PASSWORD = 'NotifSmoke!2026'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt !== -1 ? process.argv[shotsAt + 1] : null

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const BELL = 'button[aria-label^="Уведомления"]'

async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, `${name}.png`) })
}

async function createUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'notif-smoke (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = cu?.user?.id ?? null
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!id) throw new Error('не удалось получить id тестового пользователя')
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  await admin.from('profiles').update({ level: 'B1' }).eq('id', id)
  return id
}

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('notif-smoke')}`, 'about:blank'],
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

const bellState = (page) =>
  page.evaluate((sel) => {
    const b = document.querySelector(sel)
    return b ? { label: b.getAttribute('aria-label'), inNav: !!b.closest('nav'), inHeader: !!b.closest('header') } : null
  }, BELL)

// Нажатие — через el.click() в странице, как в остальных смоуках: «мышиный»
// page.click в headless-вкладке дважды из пяти прогонов подвешивал следующий
// вызов в страницу (Runtime.callFunctionOn timed out), а сама лента при этом
// открывалась нормально — проверено отдельным прогоном.
const tapBell = (page) => page.evaluate((sel) => document.querySelector(sel)?.click(), BELL)

const waitFor = (page, fn, arg, timeout = 10000) =>
  page
    .waitForFunction(fn, { polling: 250, timeout }, arg)
    .then(() => true)
    .catch(() => false)

async function run(page, userId) {
  const notify = (key, data) =>
    admin.rpc('notify', { p_user_id: userId, p_kind: 'manual', p_data: data, p_dedupe_key: key })

  // вход
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')?.click())
  await sleep(500)
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 })
  await sleep(2500)

  // ── 1. нет уведомлений — нет колокольчика ───────────────────────────────────
  check('без уведомлений колокольчика нет', !(await bellState(page)))

  // ── 2. пришло — появился ────────────────────────────────────────────────────
  const r1 = await notify('smoke:first', { title: 'Проверка колокольчика', body: 'Первое уведомление' })
  check('notify() служебным ключом создаёт уведомление', r1.data === true, JSON.stringify(r1.error?.message ?? r1.data))
  await page.reload({ waitUntil: 'networkidle2' })
  const appeared = await waitFor(page, (sel) => !!document.querySelector(sel), BELL)
  let bell = await bellState(page)
  check('колокольчик появился в шапке с цифрой', appeared && !!bell?.inHeader && /1 новое/.test(bell?.label ?? ''), bell?.label)
  check('на устройстве запомнено, что колокольчик есть', await page.evaluate((id) => localStorage.getItem(`recall.notifications.present.${id}`) === '1', userId))
  await shot(page, 'phone-bell')

  // ── 3. открыл ленту ─────────────────────────────────────────────────────────
  await tapBell(page)
  const listed = await waitFor(page, () => (document.querySelector('[role="dialog"]')?.textContent || '').includes('Проверка колокольчика'))
  const fresh = await page.evaluate(() => !!document.querySelector('[role="dialog"] [data-fresh]'))
  check('лента открылась, уведомление видно и выделено как новое', listed && fresh)
  await shot(page, 'phone-feed')
  const readInDb = await (async () => {
    for (let i = 0; i < 20; i++) {
      const { data } = await admin.from('notifications').select('read_at').eq('user_id', userId).eq('dedupe_key', 'smoke:first').single()
      if (data?.read_at) return true
      await sleep(250)
    }
    return false
  })()
  check('в базе отмечено прочитанным', readInDb)
  await page.keyboard.press('Escape')
  await sleep(500)
  bell = await bellState(page)
  check('цифра ушла, колокольчик остался', !!bell && bell.label === 'Уведомления', bell?.label)

  // ── 4. новое, пока приложение открыто ───────────────────────────────────────
  await notify('smoke:second', { title: 'Ссылка на прогресс', body: 'Открой прогресс', href: '/progress' })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  const counted = await waitFor(page, (sel) => /1 новое/.test(document.querySelector(sel)?.getAttribute('aria-label') ?? ''), BELL)
  check('вернулся в приложение — цифра появилась без перезагрузки', counted)

  // ── 5. ссылка из уведомления ───────────────────────────────────────────────
  await tapBell(page)
  await waitFor(page, () => !!document.querySelector('[role="dialog"] a[href="/progress"]'))
  await page.evaluate(() => document.querySelector('[role="dialog"] a[href="/progress"]')?.click())
  const went = await waitFor(page, () => location.pathname === '/progress')
  await sleep(400)
  check('уведомление со ссылкой ведёт на свой экран и закрывает ленту', went && !(await page.$('[role="dialog"]')))

  // ── узкий телефон: четыре кнопки шапки помещаются ──────────────────────────
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 1 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await waitFor(page, (sel) => !!document.querySelector(sel), BELL)
  await page.screenshot({ encoding: 'base64' }) // кадр: медиа-запрос ширины
  const fit = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const els = [...document.querySelectorAll('header.vt-topbar a, header.vt-topbar button')]
    const worst = Math.max(...els.map((e) => e.getBoundingClientRect().right))
    return { vw, worst: Math.round(worst), scroll: document.documentElement.scrollWidth }
  })
  check('360 px: шапка с колокольчиком не вылезает за край', fit.worst <= fit.vw && fit.scroll <= fit.vw, JSON.stringify(fit))
  await shot(page, 'phone360-bell')

  // ── 6. компьютер ─────────────────────────────────────────────────────────────
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await waitFor(page, (sel) => !!document.querySelector(sel), BELL)
  bell = await bellState(page)
  check('компьютер: колокольчик в боковом меню', !!bell?.inNav, JSON.stringify(bell))
  await tapBell(page)
  await waitFor(page, () => !!document.querySelector('[role="dialog"]'))
  await sleep(600)
  const panel = await page.evaluate(() => {
    const r = document.querySelector('[role="dialog"]')?.getBoundingClientRect()
    return r ? { right: r.right, top: r.top, height: r.height, vw: document.documentElement.clientWidth, vh: innerHeight } : null
  })
  check(
    'компьютер: лента — панель справа на всю высоту',
    !!panel && Math.abs(panel.right - panel.vw) <= 1 && Math.round(panel.top) === 0 && Math.abs(panel.height - panel.vh) <= 1,
    JSON.stringify(panel),
  )
  await shot(page, 'desk-feed')
  await page.keyboard.press('Escape')

  // ── 7. второй заход: рисуется сразу, даже при медленной сети ─────────────────
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.setRequestInterception(true)
  const slow = (req) => {
    if (/\/rest\/v1\/notifications/.test(req.url())) setTimeout(() => req.continue().catch(() => {}), 4000)
    else req.continue().catch(() => {})
  }
  page.on('request', slow)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  const early = await waitFor(page, (sel) => !!document.querySelector(sel), BELL, 3000)
  check('второй заход: колокольчик на месте раньше, чем ответила сеть', early)
  page.off('request', slow)
  await page.setRequestInterception(false)
}

async function main() {
  const userId = await createUser()
  const browser = await openBrowser()
  const jsErrors = []
  try {
    const page = await browser.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => jsErrors.push(String(e)))
    await run(page, userId)
    check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '))
  } catch (e) {
    check('смоук дошёл до конца', false, String(e?.message ?? e).split('\n')[0])
  } finally {
    await browser.close().catch(() => {})
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    console.log('Тестовый аккаунт удалён (его уведомления — вместе с ним).')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

await main()
