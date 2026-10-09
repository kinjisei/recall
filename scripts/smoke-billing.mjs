/**
 * Смоук оплаты тарифа в браузере (PLAN.md Ф2.1; макет t9-4).
 *
 * Путь, как у людей:
 *   1. репетитор (тариф Mini закончился) открывает «Как оплатить» по ссылке с
 *      тарифом: видит «Сейчас: … закончился», три тарифа, выбран Start, сумма
 *      6 500 ₸, свой код в сообщении; другой тариф меняет сумму; «Номер»
 *      копирует номер без пробелов; «Оплата отправлена» → «Спасибо!», и после
 *      перезагрузки «Спасибо» на месте (заявка в базе);
 *   2. владелец: колокольчик с заявкой, в /admin заявка в «Ждут
 *      подтверждения», подсказка «Станет: Start до …» (истёкший — от сегодня),
 *      сумма подставлена; «Подтвердить» — заявка ушла, оплата в «Последних»,
 *      в базе оплата и тариф;
 *   3. репетитор: «Сейчас: Start, действует до …», в колокольчике «Оплата
 *      получена»; на странице тарифов у тарифов «Оплатить»;
 *   4. ученик видит только Premium; гость на странице тарифов номера не видит,
 *      ему — «Войти, чтобы оплатить»;
 *   5. телефон 390 и компьютер 1280 — без горизонтальной прокрутки; кадры.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-billing.mjs [--shots <папка>]`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { addMonthsAlmaty, dayLabel } from '../src/domains/billing/model.ts'
import { settledScreenshot } from './_shots.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const PASSWORD = 'BillingSmoke!2026'
const USERS = {
  teacher: { email: 'billing-smoke-t@recall.test', name: 'Мадина Смоук' },
  owner: { email: 'billing-smoke-a@recall.test', name: 'Владелец Смоук' },
  learner: { email: 'billing-smoke-l@recall.test', name: 'Ученик Смоук' },
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

/**
 * Кадр экрана сверху и после прокрутки вниз — не fullPage: в снимке всей
 * страницы закреплённая нижняя панель ложится поверх середины экрана.
 */
async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  await settledScreenshot(page, { path: join(SHOTS, `${name}.png`) })
  const more = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 20)
  if (!more) return
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await sleep(400)
  await settledScreenshot(page, { path: join(SHOTS, `${name}-bottom.png`) })
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function makeUser({ email, name }) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-billing (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  })
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

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('billing-smoke')}`, 'about:blank'],
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

/** Своя вкладка в своём контексте: у каждого человека свой вход. */
async function pageFor(browser, width, height) {
  const ctx = await browser.createBrowserContext()
  await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {})
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  return page
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

const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, s, timeout = 12000) =>
  page
    .waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { polling: 250, timeout }, s)
    .then(() => true)
    .catch(() => false)
const clickText = (page, s, scope = 'button, a') =>
  page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((e) => (e.textContent || '').trim().startsWith(t))
      el?.click()
      return !!el
    },
    s,
    scope,
  )
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
const radios = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role=radiogroup][aria-label="Тариф"] [role=radio]')].map((r) => ({
      text: (r.textContent || '').trim(),
      on: r.getAttribute('aria-checked') === 'true',
    })),
  )

async function run(browser, ids) {
  const { teacher: tId, owner: aId, learner: lId } = ids
  // репетитор: Mini закончился 16 дней назад, пробный давно прошёл
  await admin.from('profiles').update({ role: 'teacher' }).eq('id', tId)
  const past = (days) => new Date(Date.now() - days * 86400000).toISOString()
  // тариф и пробный клиенту не пишутся (колоночные гранты) — секретным ключом можно
  await admin.from('profiles').update({ plan: 'teacher_mini', plan_expires_at: past(16), trial_until: past(30) }).eq('id', tId)
  await admin.from('profiles').update({ is_admin: true }).eq('id', aId)

  // ── 1. репетитор: «Как оплатить» ───────────────────────────────────────────
  const t = await pageFor(browser, 390, 844)
  await login(t, USERS.teacher.email)
  await t.goto(`${BASE}/pay?plan=teacher_start`, { waitUntil: 'networkidle2' })
  check('«Как оплатить тариф» открылся', await waitText(t, 'Как оплатить тариф'))
  check('«Сейчас: … закончился»', await waitText(t, 'Сейчас: Репетитор · Mini, закончился'))
  const r1 = await radios(t)
  check('три тарифа репетитора, выбран Start из ссылки', r1.length === 3 && r1[1]?.on && /Start/.test(r1[1].text), JSON.stringify(r1))
  check('у Mini пометка «сейчас у вас»', /сейчас у вас/.test(r1[0]?.text ?? ''))
  const body1 = await text(t)
  const code = body1.match(/\b(MADINA[2-9]{1,4})\b/)?.[1]
  check('сумма 6 500 ₸ и личный код в сообщении', /6\s500\s₸/.test(body1) && !!code, code ?? 'кода нет')
  check('в подсказке тот же код', body1.includes(`Впишите код ${code}`))
  await clickText(t, 'Pro', '[role=radio]')
  await sleep(300)
  check('выбрал Pro — сумма 14 990 ₸', /Сумма\s*14\s990\s₸/.test(await text(t)))
  await clickText(t, 'Start', '[role=radio]')
  await sleep(300)
  await clickText(t, 'Номер')
  await sleep(500)
  const clip = await t.evaluate(() => navigator.clipboard.readText().catch(() => null))
  const after = await text(t)
  check(
    '«Номер» копирует номер без пробелов (или честно просит скопировать руками)',
    clip === '+77762100221' || /скопируй вручную/.test(after),
    clip ?? 'буфер недоступен',
  )
  check('телефон: без горизонтальной прокрутки', await noHScroll(t))
  await shot(t, 'pay-390')

  await clickText(t, 'Оплата отправлена')
  check('«Оплата отправлена» → «Спасибо!»', await waitText(t, 'Спасибо! Включим тариф в течение дня'))
  const { data: claims } = await admin.from('payment_claims').select('id, plan, resolved_at').eq('user_id', tId)
  check('в базе открытая заявка на Start', claims?.length === 1 && claims[0].plan === 'teacher_start' && !claims[0].resolved_at)
  await shot(t, 'pay-sent-390')
  await t.reload({ waitUntil: 'networkidle2' })
  check('после перезагрузки «Спасибо» на месте', await waitText(t, 'Заявка отправлена'))
  await t.goto(`${BASE}/pay`, { waitUntil: 'networkidle2' })
  check('вернулся без ссылки на тариф — выбран тариф заявки и «Спасибо»', await waitText(t, 'Заявка отправлена'), JSON.stringify((await radios(t)).map((r) => r.on)))

  await t.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })
  await t.reload({ waitUntil: 'networkidle2' })
  await waitText(t, 'Как оплатить тариф')
  await t.screenshot({ encoding: 'base64' }) // кадр: медиа-запрос ширины
  check('компьютер: без горизонтальной прокрутки', await noHScroll(t))
  const col = await t.evaluate(() => {
    const h = [...document.querySelectorAll('h1')].find((e) => e.textContent?.includes('Как оплатить'))
    const box = h?.closest('main')?.getBoundingClientRect()
    return { nav: !!document.querySelector('nav'), main: box ? Math.round(box.width) : 0 }
  })
  check('компьютер: меню слева и колонка не шире 700', col.nav && col.main > 0 && col.main <= 700, JSON.stringify(col))
  await shot(t, 'pay-1280')

  // ── 2. владелец ────────────────────────────────────────────────────────────
  const a = await pageFor(browser, 1280, 900)
  await login(a, USERS.owner.email)
  const bell = await a.evaluate(() => document.querySelector('button[aria-label^="Уведомления"]')?.getAttribute('aria-label') ?? null)
  check('у владельца колокольчик с заявкой', !!bell, bell ?? 'колокольчика нет')
  await a.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  check('в /admin блок «Ждут подтверждения»', await waitText(a, 'Ждут подтверждения'))
  const claimId = claims?.[0]?.id
  await a.waitForSelector(`[data-claim="${claimId}"]`, { timeout: 12000 }).catch(() => {})
  const card = await a.evaluate((id) => document.querySelector(`[data-claim="${id}"]`)?.innerText ?? '', claimId)
  check('заявка: имя, тариф, код', card.includes(USERS.teacher.name) && /Start/.test(card) && card.includes(code ?? '—'), card.replace(/\n/g, ' | '))
  await a.evaluate((id) => [...document.querySelectorAll(`[data-claim="${id}"] button`)].find((b) => b.textContent?.trim() === 'Подтвердить')?.click(), claimId)
  await sleep(500)
  const expect = dayLabel(addMonthsAlmaty(new Date(), 1))
  check(`подсказка «Станет: Start до ${expect}» (истёкший — от сегодня)`, await waitText(a, `Станет: Репетитор · Start до ${expect}`))
  const amount = await a.evaluate((id) => document.querySelector(`[data-claim="${id}"] input[inputmode=numeric]`)?.value, claimId)
  check('сумма подставлена из тарифа', amount === '6500', amount)
  await shot(a, 'admin-confirm-1280')
  await a.evaluate((id) => [...document.querySelectorAll(`[data-claim="${id}"] button`)].find((b) => b.textContent?.startsWith('Подтвердить оплату'))?.click(), claimId)
  const gone = await a
    .waitForFunction((id) => !document.querySelector(`[data-claim="${id}"]`), { polling: 250, timeout: 15000 }, claimId)
    .then(() => true)
    .catch(() => false)
  const left = gone ? '' : await a.evaluate((id) => document.querySelector(`[data-claim="${id}"]`)?.innerText ?? 'нет карточки', claimId)
  check('после подтверждения заявка ушла из списка', gone, left.replace(/\n/g, ' | '))
  check('оплата в «Последних оплатах»', await waitText(a, `${USERS.teacher.name} · Репетитор · Start · 1 мес`))
  const { data: pays } = await admin.from('payments').select('plan, months, amount, method').eq('user_id', tId)
  const { data: prof } = await admin.from('profiles').select('plan, plan_expires_at').eq('id', tId).single()
  check('в базе строка оплаты: Start, 1 мес, 6 500, Kaspi Gold', pays?.length === 1 && pays[0].plan === 'teacher_start' && pays[0].amount === 6500 && pays[0].method === 'kaspi_gold')
  check('тариф включён до той же даты', prof?.plan === 'teacher_start' && dayLabel(new Date(prof.plan_expires_at)) === expect, prof?.plan_expires_at)
  await a.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await a.reload({ waitUntil: 'networkidle2' })
  await waitText(a, 'Последние оплаты')
  await a.screenshot({ encoding: 'base64' })
  check('админка на телефоне: без горизонтальной прокрутки', await noHScroll(a))
  await shot(a, 'admin-390')

  // ── 3. репетитор после подтверждения ───────────────────────────────────────
  await t.goto(`${BASE}/pay`, { waitUntil: 'networkidle2' })
  check(`«Сейчас: Start, действует до ${expect}»`, await waitText(t, `Сейчас: Репетитор · Start, действует до ${expect}`))
  check('«Спасибо» ушло — можно оплатить следующий месяц', !(await text(t)).includes('Заявка отправлена') && (await text(t)).includes('Оплата отправлена'))
  const tBell = await t
    .waitForSelector('button[aria-label^="Уведомления"]', { timeout: 12000 })
    .then(() => true)
    .catch(() => false)
  check('у репетитора появился колокольчик', tBell)
  await t.click('button[aria-label^="Уведомления"]').catch(() => {})
  check('в ленте «Оплата получена — Тариф действует до …»', (await waitText(t, 'Оплата получена')) && (await waitText(t, `Тариф действует до ${expect}`)))
  await shot(t, 'bell-1280')
  await t.goto(`${BASE}/pricing`, { waitUntil: 'networkidle2' })
  await waitText(t, 'Тарифы')
  const payLinks = await t.evaluate(() => [...document.querySelectorAll('a')].filter((e) => e.textContent?.trim() === 'Оплатить').map((e) => e.getAttribute('href')))
  check('на странице тарифов у платных тарифов «Оплатить» с тарифом', ['/pay?plan=premium', '/pay?plan=teacher_mini', '/pay?plan=teacher_start', '/pay?plan=teacher_pro'].every((h) => payLinks.includes(h)), JSON.stringify(payLinks))

  // ── 4. ученик и гость ──────────────────────────────────────────────────────
  const l = await pageFor(browser, 390, 844)
  await login(l, USERS.learner.email)
  await l.goto(`${BASE}/pay`, { waitUntil: 'networkidle2' })
  await waitText(l, 'Как оплатить тариф')
  await waitText(l, 'Перевод на Kaspi Gold')
  const lr = await radios(l)
  check('ученику — только Premium, 1 990 ₸', lr.length === 1 && /Premium/.test(lr[0].text) && /1\s990/.test(lr[0].text), JSON.stringify(lr))
  void lId

  const g = await pageFor(browser, 390, 844)
  await g.goto(`${BASE}/pricing`, { waitUntil: 'networkidle2' })
  await waitText(g, 'Тарифы')
  const gText = await text(g)
  check('гостю — «Войти, чтобы оплатить», номера на странице нет', gText.includes('Войти, чтобы оплатить') && !/776\s?210/.test(gText))
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
      await admin.from('payments').delete().in('user_id', list)
      await admin.from('events').delete().in('user_id', list).eq('name', 'payment_activated')
    }
    for (const id of list) await admin.auth.admin.deleteUser(id).catch(() => {})
    await admin.from('allowed_emails').delete().in('email', Object.values(USERS).map((u) => u.email))
    console.log('Временные аккаунты и оплаты удалены.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

await main()
