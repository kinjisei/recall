/**
 * Push по-настоящему, весь путь: тестовая база → туннель → наш сервер → служба
 * push браузера → service worker → уведомление на экране (PLAN.md Ф2.9).
 *
 * Нужен запущенный туннель: `node scripts/push-tunnel.mjs` — его адрес
 * передаётся сюда. Браузер — Edge (служба push Microsoft), профиль — обычный,
 * не инкогнито: в инкогнито push не работает.
 *
 *   1. ученик с уроком через 3 часа открывает Главную — просьба «Включить
 *      уведомления?»; разрешение браузера выдано заранее (как нажатие
 *      «Разрешить» в окне браузера);
 *   2. «Включить» → подписка записана в базу (адрес службы Microsoft);
 *   3. учитель переносит урок → через ~1–2 минуты в браузере ученика
 *      уведомление «Урок перенесён» с временем было → стало;
 *   4. «Выключить» в Настройках → подписки в базе нет.
 *
 * Запуск: node scripts/push-tunnel.mjs   (в другом окне), затем
 *         node scripts/smoke-push-live.mjs https://….trycloudflare.com
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

const URL_ = process.argv.slice(2).find((a) => a.startsWith('https://'))
if (!URL_ || process.argv.includes('--prod')) {
  console.error('Адрес туннеля: node scripts/smoke-push-live.mjs https://….trycloudflare.com (только тестовая база)')
  process.exit(1)
}
const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PASS = 'PushLive!2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data
}
const made = []

async function makeUser(tag, name) {
  const email = `push-live-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-push-live (временный)' })
  for (const u of await sql(`select id from auth.users where lower(email) = '${email}'`)) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { display_name: name } })
  if (error) throw new Error(error.message)
  made.push(data.user.id)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  must(await client.auth.signInWithPassword({ email, password: PASS }), `вход ${tag}`)
  return { id: data.user.id, email, client }
}

let b = null
try {
  const t = await makeUser('t', 'Мадина Сейткали')
  must(await t.client.rpc('become_teacher'), 'режим преподавателя')
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '20 days' where id = '${t.id}'`)
  const s = await makeUser('s', 'Айгерим')
  await admin.from('teacher_students').insert({ teacher_id: t.id, student_id: s.id })
  const card = must(await t.client.rpc('get_my_student_cards'), 'карточки').find((c) => c.user_id === s.id).id
  const [{ now }] = await sql('select now() as now')
  const at = (h) => new Date(Date.parse(now) + h * 3600_000).toISOString()
  const lesson = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: at(3), p_minutes: 60, p_cards: [card] }), 'урок')

  const PORT = 9300 + Math.floor(Math.random() * 400)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('push-live')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }
  const ctx = b.defaultBrowserContext()
  await ctx.overridePermissions(URL_, ['notifications'])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  ошибка страницы:', e.message))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && console.log('  консоль:', m.text()))
  page.on('response', (r) => r.status() >= 400 && console.log(`  ответ ${r.status()}: ${r.url().slice(0, 120)}`))
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${URL_}/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', s.email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  const sw = await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, { polling: 250, timeout: 30000 }).then(() => true, () => false)
  if (!sw) {
    await page.reload({ waitUntil: 'networkidle2' })
  }
  check('service worker сборки работает (через туннель — https)', await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())))

  const asked = await page.waitForFunction(() => /Включить уведомления\?/.test(document.body.innerText), { polling: 250, timeout: 20000 }).then(() => true, () => false)
  check('на Главной — «Ближайший урок» и просьба «Включить уведомления?»', asked && /Ближайший урок/.test(await page.evaluate(() => document.body.innerText)))
  await page.evaluate(() => [...document.querySelectorAll('[data-push-ask] button')].find((x) => x.textContent.trim() === 'Включить')?.click())
  let subs = []
  for (let i = 0; i < 60 && !subs.length; i++) {
    await sleep(1000)
    subs = await sql(`select endpoint from public.push_subscriptions where user_id = '${s.id}'`)
  }
  if (!subs.length) console.log('  шторка:', await page.evaluate(() => document.querySelector('[data-push-ask]')?.innerText ?? 'закрыта'))
  check('«Включить» — подписка записана в базу', subs.length === 1, 'подписки нет')
  if (subs.length) console.log(`  служба push: ${new URL(subs[0].endpoint).hostname}`)

  must(await t.client.rpc('update_lesson', { p_lesson: lesson, p_kind: 'individual', p_starts_at: at(4), p_minutes: 60, p_cards: [card] }), 'перенос')
  console.log('  учитель перенёс урок; ждём уведомление (минута на «Вернуть» + будильник туннеля, до 3 минут)…')
  let shown = []
  for (let i = 0; i < 36 && !shown.length; i++) {
    await sleep(5000)
    shown = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag })))
  }
  check('в браузере ученика — «Урок перенесён» с временем было → стало, одно на урок',
    shown.length === 1 && shown[0].title === 'Урок перенесён' && / → /.test(shown[0].body) && shown[0].tag === `lesson-${lesson}`, JSON.stringify(shown))
  const [n] = await sql(`select sent_at is not null as sent, attempts from public.notifications where user_id = '${s.id}' and kind = 'lesson_moved'`)
  check('в базе: отдано серверу доставки, одна попытка', n?.sent === true && n?.attempts === 1, JSON.stringify(n))

  await page.goto(`${URL_}/settings`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => /На этом устройстве уведомления включены/.test(document.body.innerText), { polling: 250, timeout: 15000 }).catch(() => {})
  await page.evaluate(() => [...document.querySelectorAll('[data-lesson-reminders] button')].find((x) => x.textContent.trim() === 'Выключить')?.click())
  await sleep(3000)
  const left = await sql(`select count(*)::int as n from public.push_subscriptions where user_id = '${s.id}'`)
  check('«Выключить» в Настройках — подписки в базе нет', left[0].n === 0)
} catch (e) {
  check('проверка дошла до конца', false, String(e?.message ?? e).split('\n')[0])
} finally {
  await b?.close().catch(() => {})
  for (const id of made) await deleteTestUser(admin, sql, id).catch((e) => console.log(`  ⚠ ${e.message}`))
  await admin.from('allowed_emails').delete().like('email', 'push-live-%@recall.test')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
