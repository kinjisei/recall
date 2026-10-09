/**
 * Смоук «конец тарифа и пробного» в браузере (PLAN.md Ф2.4; журнал п.36;
 * макет t9-2, t9-3).
 *
 *   1. пробный репетитора кончился — на Главной плашка «Пробный период
 *      закончился · Всё сохранено · Выбрать тариф», она же в студии; на
 *      «Учёбе» и «Практике» — нет; кнопка ведёт на «Как оплатить»;
 *   2. кончился тариф репетитора — «Тариф закончился · Репетитор Mini · до …
 *      · Продлить»;
 *   3. владелец продлил — плашка уходит при возврате в приложение, без
 *      перезагрузки;
 *   4. «Тариф закончится завтра» в ленте: имя тарифа, дата, «Как оплатить»;
 *   5. компьютер 1280: плашка в колонке экрана, не под меню слева;
 *   6. самоучка: кончился Premium — плашка про Premium; без тарифа — нет.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-access-ending.mjs [--shots <папка>]`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { settledScreenshot } from './_shots.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = APP_URL
const PASSWORD = 'AccessSmoke!2026'
const USERS = {
  teacher: { email: 'access-smoke-t@recall.test', name: 'Мадина Плашка' },
  learner: { email: 'access-smoke-l@recall.test', name: 'Самоучка Плашка' },
}
const BELL = 'button[aria-label^="Уведомления"]'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt !== -1 ? process.argv[shotsAt + 1] : null

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ago = (ms) => new Date(Date.now() - ms).toISOString()
const HOUR = 3600_000
const DAY = 24 * HOUR

async function makeUser({ email, name }) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-access-ending (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: name } })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = data?.user?.id
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
  }
  await admin.from('profiles').update({ level: 'B1' }).eq('id', id)
  return id
}

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('access-smoke')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
    if (b) return b
  }
  throw new Error('Edge не поднялся')
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')?.click())
  await sleep(500)
  await page.type('input[type=email]', email)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 })
  await sleep(1500)
}

async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await settledScreenshot(page, { path: join(SHOTS, `${name}.png`) })
}

/** Плашка на экране: вид, тексты, ссылка, где стоит. null — плашки нет. */
const readBanner = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-access-ended]')
    if (!el) return null
    const a = el.querySelector('a')
    const r = el.getBoundingClientRect()
    const main = document.querySelector('main')?.getBoundingClientRect()
    const [title, body] = [...el.querySelectorAll('p')].map((p) => (p.textContent || '').trim())
    return {
      source: el.getAttribute('data-access-ended'),
      title,
      body,
      action: (a?.textContent || '').trim(),
      href: a?.getAttribute('href'),
      inMain: !!main && r.left >= main.left - 1 && r.right <= main.right + 1,
      left: Math.round(r.left),
      top: Math.round(r.top),
      inView: r.top >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth,
    }
  })

async function bannerAt(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  return readBanner(page)
}

async function run(browser, tId, lId) {
  const tc = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  await tc.auth.signInWithPassword({ email: USERS.teacher.email, password: PASSWORD })
  const bt = await tc.rpc('become_teacher')
  check('режим преподавателя включён', !bt.error, bt.error?.message ?? '')
  // режим включён 25 дней назад, учеников нет — пробный кончился 5 дней назад
  await sql(`update public.teacher_signups set created_at = now() - interval '25 days' where user_id = '${tId}'`)
  await sql(`select public.recompute_teacher_trial('${tId}')`)

  const ctx = await browser.createBrowserContext()
  const t = await ctx.newPage()
  await t.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await login(t, USERS.teacher.email)

  // 1. пробный кончился
  const b1 = await bannerAt(t, '/')
  await shot(t, 'trial-ended-390')
  check(
    'пробный кончился: на Главной «Пробный период закончился · Всё сохранено · Выбрать тариф»',
    b1?.source === 'trial' && b1.title === 'Пробный период закончился' && b1.body === 'Всё сохранено' && b1.action === 'Выбрать тариф' && b1.href === '/pay',
    JSON.stringify(b1),
  )
  check('телефон: плашка вверху колонки экрана, в окне', !!b1?.inMain && !!b1?.inView && (b1?.top ?? 999) < 160, JSON.stringify(b1 && { top: b1.top, inMain: b1.inMain }))
  const b1s = await bannerAt(t, '/teacher')
  check('в студии — тоже', b1s?.source === 'trial', JSON.stringify(b1s))
  check('на «Учёбе» — нет', (await bannerAt(t, '/study')) === null)
  check('на «Практике» — нет', (await bannerAt(t, '/practice')) === null)
  await bannerAt(t, '/')
  await t.click('[data-access-ended] a')
  await t.waitForFunction(() => location.pathname === '/pay', { polling: 200, timeout: 10000 }).catch(() => {})
  check('«Выбрать тариф» ведёт на «Как оплатить»', new URL(t.url()).pathname === '/pay', t.url())

  // 2. кончился тариф репетитора
  await admin.from('profiles').update({ plan: 'teacher_mini', plan_expires_at: ago(HOUR) }).eq('id', tId)
  const b2 = await bannerAt(t, '/')
  await shot(t, 'plan-ended-390')
  check(
    'тариф кончился: «Тариф закончился · Репетитор Mini · до … Всё сохранено · Продлить»',
    b2?.source === 'plan' && b2.title === 'Тариф закончился' && /^Репетитор Mini · до \d+ [а-я]+\. Всё сохранено$/.test(b2.body ?? '') && b2.action === 'Продлить' && b2.href === '/pay',
    JSON.stringify(b2),
  )

  // 3. владелец продлил — плашка уходит при возврате в приложение, без перезагрузки
  await t.evaluate(() => {
    window.__noReload = true
  })
  await admin.from('profiles').update({ plan_expires_at: new Date(Date.now() + 30 * DAY).toISOString() }).eq('id', tId)
  await t.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await sleep(2000)
  const kept = await t.evaluate(() => window.__noReload === true)
  check('продлили — плашка ушла без перезагрузки', (await readBanner(t)) === null && kept, `страница та же: ${kept}`)

  // 4. «Тариф закончится завтра» в ленте
  const [{ until }] = await sql(`select plan_expires_at as until from public.profiles where id = '${tId}'`)
  await sql(`select public.notify_access_ending(((('${until}'::timestamptz at time zone 'Asia/Almaty')::date - 1 + time '12:00') at time zone 'Asia/Almaty'))`)
  await t.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await t.waitForSelector(BELL, { timeout: 10000 })
  await t.click(BELL)
  await sleep(1500)
  const item = await t.evaluate(() => {
    const li = [...document.querySelectorAll('[data-notification]')].find((e) => /Тариф закончится завтра/.test(e.textContent || ''))
    if (!li) return null
    return { text: (li.textContent || '').replace(/\s+/g, ' ').trim(), action: li.querySelector('[data-action]')?.textContent?.trim(), href: li.querySelector('a')?.getAttribute('href') }
  })
  await shot(t, 'feed-plan-ending-390')
  check(
    'в ленте: «Тариф закончится завтра», «Репетитор Mini действует до …», «Как оплатить» → /pay',
    !!item && /Репетитор Mini действует до \d+ [а-я]+/.test(item.text) && item.action === 'Как оплатить' && item.href === '/pay',
    JSON.stringify(item),
  )
  await t.keyboard.press('Escape')

  // 5. компьютер
  await admin.from('profiles').update({ plan_expires_at: ago(HOUR) }).eq('id', tId)
  await t.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await t.screenshot({ encoding: 'base64' }) // кадр: медиа-запрос ширины
  const b5 = await bannerAt(t, '/')
  await shot(t, 'plan-ended-1280')
  check('компьютер: плашка в колонке экрана, правее меню, в окне', b5?.source === 'plan' && b5.inMain && b5.left >= 240 && b5.inView, JSON.stringify(b5 && { left: b5.left, inMain: b5.inMain, inView: b5.inView }))

  // 6. самоучка
  await admin.from('profiles').update({ plan: 'premium', plan_expires_at: ago(HOUR) }).eq('id', lId)
  const ctx2 = await browser.createBrowserContext()
  const l = await ctx2.newPage()
  await l.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await login(l, USERS.learner.email)
  const b6 = await bannerAt(l, '/')
  await shot(l, 'premium-ended-390')
  check('самоучка: кончился Premium — «Тариф закончился · Premium · до …»', b6?.source === 'plan' && /^Premium · до /.test(b6.body ?? '') && b6.action === 'Продлить', JSON.stringify(b6))
  check('у самоучки в «Преподавателе» (приглашение) — нет', (await bannerAt(l, '/teacher')) === null)
  await admin.from('profiles').update({ plan: 'free', plan_expires_at: null }).eq('id', lId)
  check('без тарифа — плашки нет', (await bannerAt(l, '/')) === null)
}

async function main() {
  const ids = {}
  let browser = null
  try {
    ids.teacher = await makeUser(USERS.teacher)
    ids.learner = await makeUser(USERS.learner)
    browser = await openBrowser()
    await run(browser, ids.teacher, ids.learner)
  } catch (e) {
    check('смоук дошёл до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
  } finally {
    await browser?.close().catch(() => {})
    for (const id of Object.values(ids)) await admin.auth.admin.deleteUser(id).catch(() => {})
    await admin.from('allowed_emails').delete().in('email', Object.values(USERS).map((u) => u.email))
    console.log('Временные аккаунты удалены.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

await main()
