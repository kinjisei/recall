/**
 * Учёт уроков в браузере (PLAN.md Ф2.8; макеты t7-1 … t7-3, d3-3). Сам
 * заводит учителя (Mini), ученика в приложении и ученика без приложения.
 *
 *   1. карточка без приложения: «Оплаты не отмечены» → «Отметить оплату»
 *      (+8, дата — вчера, «Было 0 → станет 8») → остаток 8, в базе дата;
 *   2. 7 уроков списались → в строке списка «1», учителю одно уведомление;
 *      колокольчик → «Тимур Ким: остался 1 оплаченный урок · Напомнить» →
 *      карточка открылась сразу со шторкой «Напомнить»: текст макета t7-3,
 *      WhatsApp на номер, «В приложении» нет (ученика нет в Recall);
 *   3. компьютер 1280, никто не выбран: «Требуют внимания» — Тимур;
 *   4. история: оплата +8 и списания; нажатие на урок → «Был, не списывать»
 *      → остаток 2;
 *   5. ученик в приложении: «Напомнить об оплате» → «В приложении» → у
 *      ученика ровно одно уведомление — сообщение учителя; других нет.
 *
 * Запуск: npm run dev:test, затем node scripts/smoke-lesson-balance.mjs
 *         [--shots <папка>] — скриншоты 390 и 1280.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунты и уроки — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'BalanceSmoke!2026'
const TEACHER = 'balance-smoke-teacher@recall.test'
const STUDENT = 'balance-smoke-student@recall.test'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
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

async function makeUser(email, name) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-lesson-balance' })
  for (const u of await sql(`select id from auth.users where lower(email) = '${email}'`)) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { display_name: name } })
  if (error) throw new Error(`${email}: ${error.message}`)
  await admin.from('profiles').update({ display_name: name }).eq('id', data.user.id)
  return data.user.id
}
async function openAs(b, email, width = 390) {
  const ctx = await b.createBrowserContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  ошибка страницы:', e.message))
  await page.setViewport({ width, height: width > 600 ? 860 : 844 })
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  await sleep(1000)
  return page
}
const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout }, re.source).then(() => true, () => false)
async function click(page, label, timeout = 15000) {
  const ok = await page
    .waitForFunction((l) => [...document.querySelectorAll('button, a')].some((x) => x.textContent.trim().includes(l) && !x.disabled), { polling: 250, timeout }, label)
    .then(() => true, () => false)
  if (ok) await page.evaluate((l) => [...document.querySelectorAll('button, a')].reverse().find((x) => x.textContent.trim().includes(l) && !x.disabled)?.click(), label)
  await sleep(500)
  return ok
}
async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

const ids = []
let b = null
try {
  const tId = await makeUser(TEACHER, 'Мадина Смоук')
  const sId = await makeUser(STUDENT, 'Айгерим Нурланова')
  ids.push(tId, sId)
  const tc = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  must(await tc.auth.signInWithPassword({ email: TEACHER, password: PASS }), 'вход')
  must(await tc.rpc('become_teacher'), 'режим преподавателя')
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '20 days' where id = '${tId}'`)
  await admin.from('teacher_students').insert({ teacher_id: tId, student_id: sId })
  const timur = must(await tc.rpc('create_student_card', { p_name: 'Тимур Ким', p_status: 'active', p_contact: '+7 701 123 45 67' }), 'Тимур')
  const aig = must(await tc.rpc('get_my_student_cards'), 'карточки').find((c) => c.user_id === sId).id
  const [{ now, today, yesterday }] = await sql(`select now() as now, (now() at time zone 'Asia/Almaty')::date::text as today, ((now() at time zone 'Asia/Almaty')::date - 1)::text as yesterday`)
  const ago = (h) => new Date(Date.parse(now) - h * 3600_000).toISOString()
  const balance = async (card) => must(await tc.rpc('get_lesson_balances'), 'остатки').find((r) => r.card_id === card)

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('lesson-balance')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }
  const te = await openAs(b, TEACHER)

  // ── 1. «Отметить оплату» с датой ─────────────────────────────────────────────
  await go(te, `/teacher?student=${timur}`)
  check('блок «Уроки»: «Оплаты не отмечены»', await waitText(te, /Уроки[\s\S]*Оплаты не отмечены/))
  await click(te, 'Отметить оплату')
  await te.evaluate(() => [...document.querySelectorAll('[role="dialog"] button[aria-expanded]')].find((x) => x.textContent.includes('Дата оплаты'))?.click())
  await sleep(300)
  if (yesterday.slice(5, 7) !== today.slice(5, 7)) await te.click('[aria-label="Предыдущий месяц"]')
  await te.click(`[aria-label="${Number(yesterday.slice(8))} ${MONTHS[Number(yesterday.slice(5, 7)) - 1]}"]`)
  await sleep(300)
  const preview = await te.$eval('[data-pay-preview]', (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '')
  check('«Было 0 → станет 8 уроков» (+8 по умолчанию)', /Было 0.*станет 8 уроков/.test(preview), preview)
  await shot(te, 'pay-390')
  await click(te, 'Отметить')
  check('«Отмечено: +8», остаток 8', await waitText(te, /Отмечено: \+8/) && /Оплачено, осталось 8 уроков/.test(await text(te)))
  const [{ paid_on }] = await sql(`select paid_on::text from public.paid_lessons where card_id = '${timur}'`)
  check('база: дата оплаты — вчера', paid_on === yesterday, paid_on)

  // ── 2. 7 списаний → «1» в строке, одно уведомление → «Напомнить» ─────────────────
  for (let i = 0; i < 7; i++) {
    const l = must(await tc.rpc('create_lesson', { p_kind: 'individual', p_starts_at: ago(30 - i), p_minutes: 30, p_cards: [timur] }), 'урок')
    must(await tc.rpc('mark_lesson_participant', { p_lesson: l, p_card: timur, p_outcome: 'present' }), 'отметка')
  }
  const lows = await sql(`select count(*)::int as n from public.notifications where user_id = '${tId}' and kind = 'lessons_low'`)
  check('учителю ровно одно «остался 1»', lows[0].n === 1, JSON.stringify(lows))
  await go(te, '/teacher')
  const count = await te.waitForSelector('[data-balance-count]', { timeout: 10000 }).then(() => te.$eval('[data-balance-count]', (e) => e.textContent)).catch(() => null)
  check('в строке списка — «1»', count === '1', String(count))
  await shot(te, 'list-390')
  await te.evaluate(() => document.querySelector('button[aria-label^="Уведомления"]')?.click())
  check('лента: «Тимур Ким: остался 1 оплаченный урок»', await waitText(te, /Тимур Ким: остался 1 оплаченный урок/))
  await shot(te, 'feed-390')
  await click(te, 'Напомнить')
  check('из уведомления — карточка и шторка «Напомнить»', await waitText(te, /Напомнить: Тимур Ким/))
  const remindText = await te.$eval('[data-remind-text]', (e) => e.value).catch(() => '')
  check('текст макета t7-3: «Тимур, привет! Остался один оплаченный урок…»', /^Тимур, привет! Остался один оплаченный урок\. Продолжаем\? Тогда пришли, пожалуйста, оплату за следующие уроки\.$/.test(remindText), remindText)
  const wa = await te.evaluate(() => document.querySelector('[role="dialog"] a[data-share="whatsapp"]')?.href ?? '')
  check('WhatsApp — на номер из карточки, «В приложении» нет', wa.startsWith('https://wa.me/77011234567?text=') && !/В приложении/.test(await text(te)))
  await shot(te, 'remind-390')
  await click(te, 'Напомню лично')
  await sleep(500)
  check('«Напомню лично» закрыл шторку и убрал ?remind', !new URL(te.url()).searchParams.has('remind') && !/Напомнить: Тимур/.test(await text(te)))

  // ── 3. компьютер: «Требуют внимания» ────────────────────────────────────────────
  const desk = await openAs(b, TEACHER, 1280)
  await go(desk, '/teacher')
  check('1280, никто не выбран: «Требуют внимания» — Тимур, остался 1', await waitText(desk, /Требуют внимания · 1[\s\S]*Тимур Ким[\s\S]*Остался 1 оплаченный урок/))
  await shot(desk, 'attention-1280')

  // ── 4. история и исправление задним числом ──────────────────────────────────────
  await go(te, `/teacher?student=${timur}`)
  await click(te, 'История уроков и оплат')
  check('история: оплата +8 и уроки −1', await waitText(te, /Оплата[\s\S]*\+8/) && (await te.$$eval('[data-history-row="lesson"]', (x) => x.length)) === 7)
  await shot(te, 'history-390')
  await te.evaluate(() => document.querySelector('[data-history-row="lesson"]')?.click())
  await click(te, 'Был, не списывать')
  await shot(te, 'fix-390')
  await click(te, 'Исправить')
  await sleep(1500)
  check('исправление задним числом: остаток 2', (await balance(timur)).balance === 2)

  // ── 5. ученик в приложении: «Напомнить → В приложении» ──────────────────────────
  must(await tc.rpc('add_paid_lessons', { p_card: aig, p_count: 2 }), '+2 Айгерим')
  const al = must(await tc.rpc('create_lesson', { p_kind: 'individual', p_starts_at: ago(5), p_minutes: 30, p_cards: [aig] }), 'урок Айгерим')
  must(await tc.rpc('mark_lesson_participant', { p_lesson: al, p_card: aig, p_outcome: 'present' }), 'отметка Айгерим')
  const before = await sql(`select count(*)::int as n from public.notifications where user_id = '${sId}'`)
  check('ученику Recall об оплате сам не написал', before[0].n === 0, JSON.stringify(before))
  await go(te, `/teacher?student=${aig}`)
  await click(te, 'Напомнить об оплате')
  await click(te, 'В приложении')
  check('«Напоминание отправлено в приложение»', await waitText(te, /Напоминание отправлено в приложение/))
  const got = await sql(`select kind, data->>'text' as text from public.notifications where user_id = '${sId}'`)
  check('у ученика ровно одно — сообщение учителя с текстом', got.length === 1 && got[0].kind === 'teacher_message' && /^Айгерим, привет! Остался один оплаченный урок/.test(got[0].text), JSON.stringify(got))
} catch (e) {
  check('смоук дошёл до конца', false, e instanceof Error ? e.message : String(e))
} finally {
  await b?.close().catch(() => {})
  for (const id of ids) await deleteTestUser(admin, sql, id).catch((e) => console.log(`  ⚠ ${e.message}`))
}

const passed = results.filter(Boolean).length
console.log(`\nИтог: ${passed}/${results.length}`)
process.exitCode = passed === results.length ? 0 : 1
