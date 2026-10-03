/**
 * Смоук метки пробного периода репетитора (PLAN.md Ф2.2; макет t9-1).
 *
 * Меню профиля у репетитора:
 *   1. учеников ещё нет — «Пробный · 14 дней с первого ученика»; «Тариф» с
 *      «Выбрать» ведёт на «Как оплатить»;
 *   2. привязался первый ученик — «Пробный · осталось 14 дней» (отсчёт
 *      пошёл, база пересчитала конец сама);
 *   3. пробный кончился — метки нет, «Выбрать» есть;
 *   4. оплачен тариф репетитора — ни метки, ни «Выбрать»;
 *   5. у ученика — «Тарифы» на страницу тарифов, метки нет;
 *   6. компьютер 1280: меню вверх из боковой панели, метка в окне.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-trial.mjs [--shots <папка>]`.
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
const PASSWORD = 'TrialSmoke!2026'
const USERS = {
  teacher: { email: 'trial-smoke-t@recall.test', name: 'Мадина Пробная' },
  student: { email: 'trial-smoke-s@recall.test', name: 'Ученик Пробный' },
}
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

async function makeUser({ email, name }) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-trial (временный)' })
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
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('trial-smoke')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
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

/** Открыть меню профиля и прочитать: метку пробного и пункт про тариф. */
async function menu(page, shotName) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  await page.click('button[aria-label="Меню профиля"]')
  await page.waitForSelector('[role=menu]', { timeout: 8000 })
  await sleep(1200) // план приходит отдельным запросом
  if (SHOTS && shotName) {
    mkdirSync(SHOTS, { recursive: true })
    await page.screenshot({ path: join(SHOTS, `${shotName}.png`) })
  }
  const r = await page.evaluate(() => {
    const m = document.querySelector('[role=menu]')
    const box = m?.getBoundingClientRect()
    const items = [...(m?.querySelectorAll('[role=menuitem]') ?? [])].map((e) => ({ text: (e.textContent || '').trim(), href: e.getAttribute('href') }))
    return {
      trial: m?.querySelector('[data-trial]')?.textContent?.trim() ?? null,
      plan: items.find((i) => /^Тариф/.test(i.text)) ?? null,
      inView: !!box && box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth,
    }
  })
  await page.keyboard.press('Escape')
  return r
}

async function run(browser, tId, sId) {
  // включить режим преподавателя — настоящий become_teacher от имени репетитора
  const tc = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  await tc.auth.signInWithPassword({ email: USERS.teacher.email, password: PASSWORD })
  const bt = await tc.rpc('become_teacher')
  check('режим преподавателя включён', !bt.error, bt.error?.message ?? '')
  const ctx = await browser.createBrowserContext()
  const t = await ctx.newPage()
  await t.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await login(t, USERS.teacher.email)

  // 1. учеников нет
  const m1 = await menu(t, 'menu-no-students-390')
  check('нет учеников — «Пробный · 14 дней с первого ученика»', m1.trial === 'Пробный · 14 дней с первого ученика', String(m1.trial))
  check('«Тариф · Выбрать» ведёт на «Как оплатить»', m1.plan?.href === '/pay' && /Выбрать/.test(m1.plan.text), JSON.stringify(m1.plan))
  check('телефон: меню целиком в окне', m1.inView)

  // 2. первый ученик — база сама пересчитывает конец пробного
  await admin.from('teacher_students').insert({ teacher_id: tId, student_id: sId })
  const m2 = await menu(t, 'menu-first-student-390')
  check('первый ученик — «Пробный · осталось 14 дней»', m2.trial === 'Пробный · осталось 14 дней', String(m2.trial))

  // 6. компьютер
  await t.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await t.screenshot({ encoding: 'base64' }) // кадр: медиа-запрос ширины
  const m6 = await menu(t, 'menu-1280')
  check('компьютер: метка в меню, меню в окне', m6.trial === 'Пробный · осталось 14 дней' && m6.inView, JSON.stringify(m6))
  await t.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })

  // 3. пробный кончился
  await admin.from('profiles').update({ trial_until: new Date(Date.now() - 86400000).toISOString() }).eq('id', tId)
  const m3 = await menu(t)
  check('пробный кончился — метки нет, «Выбрать» есть', m3.trial === null && /Выбрать/.test(m3.plan?.text ?? ''), JSON.stringify(m3))

  // 4. оплачен тариф репетитора
  await admin.from('profiles').update({ plan: 'teacher_mini', plan_expires_at: new Date(Date.now() + 20 * 86400000).toISOString() }).eq('id', tId)
  const m4 = await menu(t)
  check('тариф оплачен — ни метки, ни «Выбрать»', m4.trial === null && m4.plan?.text === 'Тариф', JSON.stringify(m4))

  // 5. ученик
  const ctx2 = await browser.createBrowserContext()
  const s = await ctx2.newPage()
  await s.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await login(s, USERS.student.email)
  const m5 = await menu(s)
  check('у ученика — «Тарифы» на страницу тарифов, метки нет', m5.trial === null && m5.plan?.href === '/pricing' && m5.plan.text === 'Тарифы', JSON.stringify(m5))
}

async function main() {
  const ids = {}
  let browser = null
  try {
    ids.teacher = await makeUser(USERS.teacher)
    ids.student = await makeUser(USERS.student)
    browser = await openBrowser()
    await run(browser, ids.teacher, ids.student)
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
