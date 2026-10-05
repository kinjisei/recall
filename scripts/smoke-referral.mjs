/**
 * Смоук рефералки в браузере (PLAN.md Ф2.3; макеты t8-1…t8-3).
 *
 * Путь, как у людей:
 *   1. репетитор А, у которого оплачен тариф: в шапке подарок с разовой
 *      подсветкой; закрыл — после перезагрузки её нет (отметка в базе); шапка
 *      влезает в 390 и 360 px;
 *   2. подарок → «Пригласи коллегу»: пусто — «Пока никого»; ссылка верная,
 *      «Скопировать» кладёт её в буфер; WhatsApp — сообщение целиком,
 *      Telegram — ссылка отдельным полем; превью = то, что уйдёт;
 *   3. коллега Б открывает ссылку: на экране входа — строка про приглашение;
 *      входит → режим репетитора включается сам, в базе приглашение и +7
 *      дней, подарок в шапке появляется без перезагрузки;
 *   4. владелец подтверждает оплату Б → у А счётчик 1 · 1 · 1 мес;
 *   5. компьютер 1280: подарок строкой в боковой панели, экран в колонке;
 *   6. ученик: подарка нет, /invite — общее приглашение экранов студии
 *      «Ведёшь учеников?» (проверка роли в таблице маршрутов, PLAN.md Ф2.10).
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-referral.mjs [--shots <папка>]`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { INVITE_TEXT } from '../src/domains/billing/referral.ts'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const PASSWORD = 'ReferralSmoke!2026'
const USERS = {
  a: { email: 'referral-smoke-a@recall.test', name: 'Мадина Смоук' },
  b: { email: 'referral-smoke-b@recall.test', name: 'Бота Смоук' },
  owner: { email: 'referral-smoke-o@recall.test', name: 'Владелец Смоук' },
  learner: { email: 'referral-smoke-l@recall.test', name: 'Ученик Смоук' },
}
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt !== -1 ? process.argv[shotsAt + 1] : null

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  await page.screenshot({ path: join(SHOTS, `${name}.png`) })
  const more = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 20)
  if (!more) return
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await sleep(400)
  await page.screenshot({ path: join(SHOTS, `${name}-bottom.png`) })
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function makeUser({ email, name }) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-referral (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: name } })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = data?.user?.id
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
  }
  if (!id) throw new Error(`нет id для ${email}`)
  await admin.from('profiles').update({ level: 'B1' }).eq('id', id)
  return id
}

async function clientFor(email) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('referral-smoke')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
    if (b) return b
  }
  throw new Error('Edge не поднялся')
}

async function pageFor(browser, width, height) {
  const ctx = await browser.createBrowserContext()
  await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {})
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  return page
}

async function login(page, email, path = '/login') {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')?.click())
  await sleep(500)
  await page.type('input[type=email]', email)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 })
  await sleep(1500)
}

const waitText = (page, s, timeout = 12000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { polling: 250, timeout }, s).then(() => true).catch(() => false)
const gift = (page) => page.evaluate(() => document.querySelector('[data-gift]')?.getAttribute('data-gift') ?? null)
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
/** Шапка не вылезает: правый край аватара в окне. */
const headerFits = (page) =>
  page.evaluate(() => {
    const av = document.querySelector('header button[aria-label="Меню профиля"]')?.getBoundingClientRect()
    return !!av && av.right <= window.innerWidth
  })

async function run(browser, ids) {
  const aClient = await clientFor(USERS.a.email)
  await aClient.rpc('become_teacher')
  await admin.from('profiles').update({ is_admin: true }).eq('id', ids.owner)
  const owner = await clientFor(USERS.owner.email)
  const pay = (id) => owner.rpc('confirm_payment', { p_user: id, p_plan: 'teacher_mini', p_months: 1, p_amount: 3900 })
  const p1 = await pay(ids.a)
  if (p1.error) throw new Error(`оплата А: ${p1.error.message}`)
  const code = (await aClient.rpc('get_my_referral')).data[0].code
  const link = `${BASE}/login?role=teacher&ref=${code}`

  // ── 1. подарок и разовая подсветка ─────────────────────────────────────────
  const a = await pageFor(browser, 390, 844)
  await login(a, USERS.a.email)
  // подсветка приходит отдельным запросом после того, как подарок уже есть
  await a.waitForSelector('header [data-gift=hint]', { timeout: 10000 }).catch(() => {})
  check('А (тариф оплачен): подарок в шапке подсвечен, подсказка видна', (await gift(a)) === 'hint' && (await waitText(a, 'Подарок за коллег')))
  check('шапка репетитора с колокольчиком и подарком влезает в 390', (await headerFits(a)) && (await noHScroll(a)))
  await shot(a, 'referral-header-hint-390')
  await a.setViewport({ width: 360, height: 780, deviceScaleFactor: 1 })
  await sleep(400)
  check('…и в 360', (await headerFits(a)) && (await noHScroll(a)))
  await a.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await a.click('button[aria-label="Закрыть подсказку"]')
  await sleep(800)
  await a.reload({ waitUntil: 'networkidle2' })
  await a.waitForSelector('header [data-gift]', { timeout: 10000 }).catch(() => {})
  await sleep(1200)
  check('закрыл подсказку — после перезагрузки подарок без подсветки', (await gift(a)) === 'plain')

  // ── 2. «Пригласи коллегу» ───────────────────────────────────────────────────
  await a.click('header a[aria-label="Пригласи коллегу"]')
  await a.waitForFunction(() => location.pathname === '/invite', { timeout: 10000 })
  check('подарок ведёт на «Пригласи коллегу»; пока никого — «Пока никого»', (await waitText(a, 'Пока никого')) && (await waitText(a, '+7 дней')))
  const shown = await a.evaluate(() => ({
    link: document.querySelector('[data-referral-link]')?.getAttribute('data-referral-link'),
    message: document.querySelector('[data-referral-message]')?.textContent,
    wa: document.querySelector('[data-share=whatsapp]')?.getAttribute('href'),
    tg: document.querySelector('[data-share=telegram]')?.getAttribute('href'),
  }))
  check('ссылка — регистрация репетитором с моим кодом', shown.link === link, shown.link)
  check('превью сообщения = текст + ссылка', shown.message === `${INVITE_TEXT} ${link}`)
  const wa = shown.wa ? new URL(shown.wa) : null
  const tg = shown.tg ? new URL(shown.tg) : null
  check('WhatsApp: то самое сообщение целиком', wa?.host === 'wa.me' && wa.searchParams.get('text') === shown.message)
  check('Telegram: ссылка полем url, текст без повтора ссылки', tg?.searchParams.get('url') === link && tg.searchParams.get('text') === INVITE_TEXT)
  await a.evaluate(() => [...document.querySelectorAll('button')].find((e) => (e.textContent || '').includes('Скопировать'))?.click())
  await sleep(500)
  const clip = await a.evaluate(() => navigator.clipboard.readText().catch(() => null))
  check('«Скопировать» кладёт ссылку в буфер и отвечает «Скопировано»', clip === link && (await waitText(a, 'Скопировано', 3000)), clip ?? 'буфер недоступен')
  check('экран без горизонтальной прокрутки (390)', await noHScroll(a))
  await shot(a, 'referral-invite-empty-390')

  // ── 3. коллега по ссылке ────────────────────────────────────────────────────
  const b = await pageFor(browser, 390, 844)
  // ошибки страницы Б — чтобы при красном было видно, что ответила база
  const bErrors = []
  b.on('console', (m) => m.type() === 'error' && bErrors.push(m.text().slice(0, 300)))
  b.on('requestfailed', (r) => bErrors.push(`запрос не дошёл: ${r.url().slice(0, 120)} — ${r.failure()?.errorText}`))
  await b.goto(`${BASE}/login?role=teacher&ref=${code}`, { waitUntil: 'networkidle2' })
  check('экран входа по ссылке: «По приглашению коллеги…»', !!(await b.$('[data-referral-note]')))
  await shot(b, 'referral-login-390')
  await login(b, USERS.b.email, `/login?role=teacher&ref=${code}`)
  let ref = null
  for (let i = 0; i < 20 && !ref; i++) {
    await sleep(500)
    ref = (await admin.from('referrals').select('status, code').eq('referee_id', ids.b)).data?.[0] ?? null
  }
  const pb = (await admin.from('profiles').select('role, trial_bonus_days').eq('id', ids.b)).data?.[0]
  const bOk = ref?.status === 'registered' && ref.code === code && pb?.role === 'teacher' && pb.trial_bonus_days === 7
  check('Б вошёл по ссылке: режим включился сам, приглашение записано, +7 дней', bOk, bOk ? '' : JSON.stringify({ ref, pb, bErrors }))
  const bGift = await b.waitForSelector('header [data-gift]', { timeout: 10000 }).then(() => true).catch(() => false)
  check('у Б подарок в шапке появился без перезагрузки', bGift)
  check('метка из ссылки снята после включения', (await b.evaluate(() => [localStorage.getItem('recall.pending_role'), localStorage.getItem('recall.pending_ref')])).every((v) => v === null))

  // ── 4. оплата Б → счётчик А ──────────────────────────────────────────────────
  const p2 = await pay(ids.b)
  check('владелец подтвердил оплату Б', !p2.error, p2.error?.message)
  await a.reload({ waitUntil: 'networkidle2' })
  await waitText(a, 'Приглашено')
  const counter = await a.evaluate(() => document.querySelector('[data-referral-counter]')?.innerText.replace(/\s+/g, ' ').trim())
  // счётчика нет — показать, что на экране вместо него (иначе красное без подсказки)
  const seenInstead = counter ?? (await a.evaluate(() => `${location.pathname}: ${document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)}`))
  check('у А счётчик: приглашено 1, оплатили 1, получено 1 мес', counter === 'Приглашено 1 Оплатили 1 Получено 1 мес', seenInstead)
  await shot(a, 'referral-invite-390')
  if (SHOTS) {
    // светлая тема (пока у владельца, журнал п.48) — тот же экран на токенах
    await a.evaluate(() => localStorage.setItem('recall.theme', 'light'))
    await a.reload({ waitUntil: 'networkidle2' })
    await waitText(a, 'Приглашено')
    await shot(a, 'referral-invite-390-light')
    await a.evaluate(() => localStorage.removeItem('recall.theme'))
  }

  // ── 5. компьютер ─────────────────────────────────────────────────────────────
  await a.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
  await a.reload({ waitUntil: 'networkidle2' })
  await a.waitForSelector('nav [data-gift]', { timeout: 10000 }).catch(() => {})
  const row = await a.evaluate(() => {
    const el = document.querySelector('nav [data-gift] a')
    const r = el?.getBoundingClientRect()
    const nav = document.querySelector('nav[aria-label="Разделы"]')?.getBoundingClientRect()
    return { text: el?.textContent?.trim(), inside: !!r && !!nav && r.left >= nav.left && r.right <= nav.right }
  })
  check('1280: подарок строкой «Пригласи коллегу» в боковой панели', row.text === 'Пригласи коллегу' && row.inside, JSON.stringify(row))
  const col = await a.evaluate(() => document.querySelector('main')?.getBoundingClientRect().width ?? 0)
  check('1280: экран — колонка, без горизонтальной прокрутки', col > 0 && col <= 700 && (await noHScroll(a)), `${Math.round(col)} px`)
  await shot(a, 'referral-invite-1280')

  // ── 6. ученик ───────────────────────────────────────────────────────────────
  const l = await pageFor(browser, 390, 844)
  await login(l, USERS.learner.email)
  await sleep(1000)
  check('ученик: подарка в шапке нет', (await gift(l)) === null)
  await l.goto(`${BASE}/invite`, { waitUntil: 'networkidle2' })
  check('ученик на /invite: приглашение «Ведёшь учеников?»', await waitText(l, 'Ведёшь учеников?'))
}

async function main() {
  const ids = {}
  let browser = null
  try {
    for (const [k, u] of Object.entries(USERS)) ids[k] = await makeUser(u)
    browser = await openBrowser()
    await run(browser, ids)
  } catch (e) {
    check('смоук дошёл до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
  } finally {
    await browser?.close().catch(() => {})
    const list = Object.values(ids)
    if (list.length) {
      await admin.from('referrals').delete().in('referrer_id', list)
      await admin.from('payments').delete().in('user_id', list)
      await admin.from('events').delete().in('user_id', list).eq('name', 'payment_activated')
    }
    for (const id of list) await admin.auth.admin.deleteUser(id).catch(() => {})
    await admin.from('allowed_emails').delete().in('email', Object.values(USERS).map((u) => u.email))
    console.log('Временные аккаунты, приглашения и оплаты удалены.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

await main()
