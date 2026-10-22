/**
 * Смоук раздела «Данные» в Настройках (PLAN.md Ф2.17-4г-2б; миграция 0016;
 * макеты d14, u4): выгрузка и удаление аккаунта на ТЕСТОВОЙ базе.
 *
 *   1. база: выгрузка ученицы и репетитора — своё есть, чужих занятий нет;
 *      удаление из старой сессии (> 10 мин) — отказ, аккаунт на месте;
 *      аккаунт владельца (is_admin) — отказ;
 *   2. ученица, телефон 390: «Данные» в Настройках, «Выгрузить» — файл JSON
 *      со словами и почтой; «Удалить аккаунт» → диалог: неверный пароль —
 *      «Пароль неверный.», окно на месте, аккаунт цел; верный — экран входа
 *      «Аккаунт удалён», в базе нет ни аккаунта, ни слов, а карточка у
 *      репетитора осталась без связи;
 *   3. репетитор, компьютер 1280: «Данные» в оглавлении, диалог называет
 *      учеников и оплаченный тариф; удалён — уроков нет, оплата тарифа
 *      осталась без владельца;
 *   4. без горизонтальной прокрутки; кадры — `--shots <папка>`.
 *
 * Запуск: `npm run dev:test` (5174), затем `node scripts/smoke-account.mjs [--shots <папка>]`.
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { PASS, admin, sql, studio } from './_seed-studio.mjs'
import { settledScreenshot } from './_shots.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt !== -1 ? process.argv[shotsAt + 1] : null
const env = scriptEnv()

const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra && !ok ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await settledScreenshot(page, { path: join(SHOTS, `${name}.png`) })
}

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('account-smoke')}`, 'about:blank'], {
    detached: true,
    stdio: 'ignore',
  }).unref()
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
    if (b) return b
  }
  throw new Error('Edge не поднялся')
}

async function pageFor(browser, width, height) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  // «Выгрузить» кликает по ссылке на Blob — ловим имя и адрес вместо скачивания
  await page.evaluateOnNewDocument(() => {
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        window.__download = { name: this.download, href: this.href }
        return
      }
      return click.call(this)
    }
  })
  return page
}

const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, s, timeout = 15000) =>
  page
    .waitForFunction((t) => document.body.innerText.includes(t), { polling: 250, timeout }, s)
    .then(() => true)
    .catch(() => false)
const clickText = (page, s, scope = 'button, a') =>
  page.evaluate(
    (t, sc) => {
      const el = [...document.querySelectorAll(sc)].find((e) => (e.textContent || '').trim() === t)
      el?.click()
      return !!el
    },
    s,
    scope,
  )
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await clickText(page, 'Войти')
  await sleep(500)
  await page.type('input[type=email]', email)
  await page.type('input[type=password]', PASS)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { polling: 250, timeout: 20000 })
  await sleep(1500)
}

/** Свежий клиент с новым входом — как после ввода пароля. */
async function freshClient(email) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

const exists = async (id) => (await sql(`select count(*)::int n from auth.users where id = '${id}'`))[0].n === 1

async function openDialog(page) {
  await clickText(page, 'Удалить аккаунт')
  return page
    .waitForSelector('[role=alertdialog] input[type=password]', { timeout: 15000 })
    .then(() => true)
    .catch(() => false)
}

async function confirmWith(page, password) {
  // поле — очистить клавишами: тройной клик в поле пароля текст не выделяет
  await page.focus('[role=alertdialog] input[type=password]')
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type('[role=alertdialog] input[type=password]', password)
  await clickText(page, 'Удалить навсегда', '[role=alertdialog] button')
}

const st = studio('acct-smoke')
let browser
try {
  const { t, a, solo } = await st.seed()
  await admin.from('payments').insert({ user_id: t.id, plan: 'teacher_mini', months: 1, amount: 3900, method: 'kaspi_gold', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 30 * 864e5).toISOString() })

  // ── 1. база ─────────────────────────────────────────────────────────────────────
  const ea = (await a.client.rpc('export_my_data')).data
  const et = (await t.client.rpc('export_my_data')).data
  check('выгрузка ученицы: слова и дни занятий — свои', ea?.cards?.length >= 5 && ea.activity_log.length > 0 && ea.activity_log.every((r) => r.user_id === a.id), JSON.stringify({ cards: ea?.cards?.length }))
  check('выгрузка репетитора: студия есть, чужих занятий нет', et?.student_cards?.length > 0 && et.lessons.length > 0 && et.activity_log.every((r) => r.user_id === t.id), JSON.stringify({ cards: et?.student_cards?.length, lessons: et?.lessons?.length }))
  check('оплата тарифа — в выгрузке репетитора, без «кто подтвердил»', et?.payments?.length === 1 && !('confirmed_by' in et.payments[0]))

  await sql(`update auth.sessions set created_at = now() - interval '1 hour' where user_id = '${a.id}'`)
  const stale = await a.client.rpc('delete_my_account')
  check('старая сессия (пароль не вводили) — отказ, аккаунт цел', /RECALL_REAUTH_NEEDED/.test(stale.error?.message ?? '') && (await exists(a.id)), stale.error?.message)

  await sql(`update public.profiles set is_admin = true where id = '${solo.id}'`)
  const own = await (await freshClient(solo.email)).rpc('delete_my_account')
  check('аккаунт владельца так не удаляется', /RECALL_ADMIN_KEEP/.test(own.error?.message ?? '') && (await exists(solo.id)), own.error?.message)
  await sql(`update public.profiles set is_admin = false where id = '${solo.id}'`)

  const [cardOfA] = await sql(`select id from public.student_cards where teacher_id = '${t.id}' and user_id = '${a.id}'`)

  // ── 2. ученица, 390 ─────────────────────────────────────────────────────────────
  browser = await openBrowser()
  const p = await pageFor(browser, 390, 844)
  await login(p, a.email)
  await p.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' })
  check('390: раздел «Данные» — выгрузка и удаление', (await waitText(p, 'Выгрузить мои данные')) && (await text(p)).includes('Удалим аккаунт и прогресс насовсем'))
  await p.evaluate(() => document.querySelector('#data')?.scrollIntoView({ block: 'center' }))
  await shot(p, 'data-390')
  await clickText(p, 'Выгрузить')
  const dl = await p.waitForFunction(() => window.__download, { polling: 250, timeout: 20000 }).then(() => p.evaluate(async () => ({ name: window.__download.name, body: await (await fetch(window.__download.href)).text() }))).catch(() => null)
  let file = null
  try {
    file = dl && JSON.parse(dl.body)
  } catch {
    file = null
  }
  check('«Выгрузить» — файл recall-<день>.json со словами и почтой', /^recall-\d{4}-\d\d-\d\d\.json$/.test(dl?.name ?? '') && file?.parts?.cards?.rows?.length >= 5 && file?.account?.email === a.email, dl?.name)

  check('«Удалить аккаунт» → диалог с паролем', await openDialog(p))
  check('ученице — без слов о студии', !(await text(p)).includes('Студия пропадёт') && (await text(p)).includes('Сначала можно выгрузить данные'))
  await confirmWith(p, 'wrong-password-1')
  check('неверный пароль — «Пароль неверный.», окно на месте, аккаунт цел', (await waitText(p, 'Пароль неверный.')) && !!(await p.$('[role=alertdialog]')) && (await exists(a.id)))
  check('390 с диалогом — без горизонтальной прокрутки', await noHScroll(p))
  await shot(p, 'dialog-wrong-390')
  await confirmWith(p, PASS)
  const gone = await p.waitForFunction(() => location.pathname.startsWith('/login'), { polling: 250, timeout: 30000 }).then(() => true).catch(() => false)
  const why = gone ? '' : await p.evaluate(() => `${location.pathname}: ${document.querySelector('[role=alertdialog]')?.textContent ?? 'окна нет'}`)
  check('верный пароль — экран входа «Аккаунт удалён»', gone && (await waitText(p, 'Аккаунт удалён, данные стёрты.')), why)
  await shot(p, 'deleted-login-390')
  const [left] = await sql(`select (select count(*) from auth.users where id = '${a.id}')::int u, (select count(*) from public.profiles where id = '${a.id}')::int p, (select count(*) from public.decks where owner_id = '${a.id}')::int d, (select count(*) from public.review_states where user_id = '${a.id}')::int r`)
  check('в базе нет ни аккаунта, ни профиля, ни колод, ни повторений', left.u + left.p + left.d + left.r === 0, JSON.stringify(left))
  const [card] = cardOfA ? await sql(`select user_id from public.student_cards where id = '${cardOfA.id}'`) : []
  check('карточка у репетитора осталась, без связи с аккаунтом', !!card && card.user_id === null, JSON.stringify(card))
  await p.reload({ waitUntil: 'networkidle2' })
  check('строка «Аккаунт удалён» — один раз', !(await text(p)).includes('Аккаунт удалён'))

  // ── 3. репетитор, 1280 ──────────────────────────────────────────────────────────
  const d = await pageFor(browser, 1280, 860)
  await login(d, t.email)
  await d.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' })
  await waitText(d, 'Выгрузить мои данные')
  check('1280: «Данные» в оглавлении', await d.evaluate(() => /Данные/.test(document.querySelector('[data-settings-toc]')?.textContent ?? '')))
  await d.evaluate(() => document.querySelector('#data')?.scrollIntoView({ block: 'center' }))
  await shot(d, 'data-1280')
  check('диалог репетитора — ученики и оплаченный тариф', (await openDialog(d)) && (await waitText(d, 'Студия пропадёт')) && /\d+ учени/.test(await text(d)) && (await text(d)).includes('оплачен до'))
  await shot(d, 'dialog-teacher-1280')
  await confirmWith(d, PASS)
  const tGone = await d.waitForFunction(() => location.pathname.startsWith('/login'), { polling: 250, timeout: 30000 }).then(() => true).catch(() => false)
  const [tl] = await sql(`select (select count(*) from auth.users where id = '${t.id}')::int u, (select count(*) from public.lessons where teacher_id = '${t.id}')::int l, (select count(*) from public.student_cards where teacher_id = '${t.id}')::int c, (select count(*) from public.payments where user_id is null and amount = 3900 and plan = 'teacher_mini' and starts_at > now() - interval '1 hour')::int pay`)
  const where = tGone ? '' : await d.evaluate(() => `${location.pathname}: ${document.querySelector('[role=alertdialog]')?.textContent ?? 'окна нет'}`)
  check('репетитор удалён: экран входа, ни аккаунта, ни уроков, ни карточек', tGone && tl.u + tl.l + tl.c === 0, `${JSON.stringify(tl)} ${where}`)
  check('оплата тарифа осталась в учёте, без владельца', tl.pay >= 1, JSON.stringify(tl))
} catch (e) {
  check(`прогон без сбоя (${e.message})`, false)
} finally {
  await browser?.close().catch(() => {})
  await st.cleanup()
  await sql(`delete from public.payments where user_id is null and amount = 3900 and plan = 'teacher_mini' and starts_at > now() - interval '1 hour'`).catch(() => {})
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
