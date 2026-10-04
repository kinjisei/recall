/**
 * Карточки учеников в браузере (PLAN.md Ф2.5; макеты t6, d3). Сам заводит
 * учителя (Mini, 5 мест) с одним учеником в приложении и второго ученика без
 * привязки, AI не трогает.
 *
 *   1. список: ученик в приложении со строкой «кем заняться», тихая строка
 *      «В приложении 1 из 5 мест тарифа»;
 *   2. «+ Ученик» → шторка → карточка без приложения открылась сама:
 *      «без приложения», приглашение с кодом, WhatsApp — на номер ученика;
 *   3. меню «⋯»: «В архив» → тост «Вернуть» → статус вернулся; «Изменить
 *      данные» → заметка видна в карточке;
 *   4. ученик открывает ссылку-приглашение → на Главной код уже в поле →
 *      «Привязать» → у учителя та же карточка «в приложении», мест 2 из 5,
 *      под шапкой — студия (домашка);
 *   4б. новичок по ссылке: «Тебя пригласил преподаватель» → вход → онбординг
 *      → на последнем шаге код уже в поле → привязан к своей карточке;
 *   5. компьютер 1280: список и карточка рядом; ничего не выбрано — подсказка.
 *
 * Запуск: npm run dev:test, затем node scripts/smoke-student-cards.mjs
 *         [--shots <папка>] — сохранить скриншоты 390 и 1280.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'CardsSmoke!2026'
const TEACHER = 'cards-smoke-teacher@recall.test'
const LINKED = 'cards-smoke-linked@recall.test'
const NEWBIE = 'cards-smoke-newbie@recall.test'
const ONBOARD = 'cards-smoke-onboard@recall.test'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}

async function makeUser(email, name) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-student-cards' })
  const { data: cu } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true })
  let id = cu?.user?.id
  if (!id) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = l.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
    await admin.auth.admin.updateUserById(id, { password: PASS })
  }
  await admin.from('profiles').update({ display_name: name }).eq('id', id)
  return id
}

async function openAs(b, email, width = 390) {
  const ctx = await b.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height: width > 600 ? 800 : 844 })
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  await sleep(1200)
  return page
}
const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout }, re.source).then(() => true, () => false)
const waitSel = (page, sel, timeout = 15000) => page.waitForSelector(sel, { visible: true, timeout }).then(() => true, () => false)
async function click(page, label, timeout = 15000) {
  const ok = await page
    .waitForFunction((l) => [...document.querySelectorAll('button, a, [role="menuitem"]')].some((x) => x.textContent.trim().includes(l)), { polling: 250, timeout }, label)
    .then(() => true, () => false)
  if (!ok) return false
  await page.evaluate((l) => [...document.querySelectorAll('button, a, [role="menuitem"]')].reverse().find((x) => x.textContent.trim().includes(l))?.click(), label)
  await sleep(600)
  return true
}
async function typeInto(page, sel, value) {
  await page.focus(sel)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(sel, value)
}
async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

const PORT = 9400 + Math.floor(Math.random() * 500)
let b = null
const ids = []
try {
  const tId = await makeUser(TEACHER, 'Мадина Смоук')
  const lId = await makeUser(LINKED, 'Айгерим Нурланова')
  const nId = await makeUser(NEWBIE, 'Timur K')
  const onbId = await makeUser(ONBOARD, 'Новичок Онбординг')
  ids.push(tId, lId, nId, onbId)
  await admin.from('profiles').update({ role: 'teacher', plan: 'teacher_mini', plan_expires_at: new Date(Date.now() + 20 * 864e5).toISOString() }).eq('id', tId)
  const link = await admin.from('teacher_students').insert({ teacher_id: tId, student_id: lId })
  if (link.error) throw new Error(`привязка: ${link.error.message}`)

  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
    `--user-data-dir=${profileDir('student-cards')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }

  // ── 1. список ───────────────────────────────────────────────────────────────
  const te = await openAs(b, TEACHER)
  await go(te, '/teacher')
  check('список: ученик в приложении', await waitText(te, /Айгерим Нурланова/))
  let txt = await text(te)
  check('строка отвечает «кем заняться»: домашка и регулярность', /Домашка не выдана/.test(txt) && /занимался/.test(txt))
  check('тихая строка мест: 1 из 5', /В приложении 1 из 5 мест тарифа/.test(txt), (txt.match(/В приложении[^\n]*/) || [''])[0])
  await shot(te, 'list-390')

  // ── 2. новый ученик без приложения ─────────────────────────────────────────────
  await click(te, 'Ученик')
  check('шторка «Новый ученик»', await waitText(te, /Новый ученик/))
  await shot(te, 'new-sheet-390')
  await typeInto(te, 'input[placeholder="Имя и фамилия"]', 'Тимур Ким')
  await typeInto(te, 'input[placeholder^="+7 700"]', '+7 701 123 45 67')
  await click(te, 'Занимается')
  await click(te, 'Добавить')
  check('карточка открылась: имя и «без приложения»', await waitText(te, /без приложения/) && /Тимур Ким/.test(await text(te)))
  check('приглашение с кодом', await waitSel(te, '[data-invite-code]'))
  const code = await te.$eval('[data-invite-code]', (el) => el.getAttribute('data-invite-code'))
  check('код из 6 знаков', /^[A-Z2-9]{6}$/.test(code ?? ''), code)
  const wa = await te.evaluate(() => [...document.querySelectorAll('[data-card-invite] a')].find((a) => a.textContent.includes('WhatsApp'))?.href ?? '')
  check('WhatsApp — сразу на номер ученика, с текстом и ссылкой', wa.startsWith('https://wa.me/77011234567?text=') && decodeURIComponent(wa).includes(`join=${code}`), wa.slice(0, 80))
  check('подпись мест: займёт место, будет 2 из 5', /будет 2 из 5/.test(await text(te)))
  await shot(te, 'invite-390')

  // ── 3. меню: архив и откат, правка ─────────────────────────────────────────────
  await click(te, '⋯')
  await click(te, 'В архив')
  check('тост «в архиве» с «Вернуть»', await waitText(te, /Тимур Ким — в архиве/))
  check('в архиве — приглашения нет', await waitText(te, /Ученик в архиве/))
  await click(te, 'Вернуть')
  check('«Вернуть» вернул статус и приглашение', await waitSel(te, '[data-invite-code]'))
  await click(te, '⋯')
  await click(te, 'Изменить данные')
  await waitText(te, /Изменить данные/)
  await typeInto(te, 'textarea', 'IELTS, цель 7.0')
  await click(te, 'Сохранить')
  const noteSaved = await waitText(te, /IELTS, цель 7\.0/)
  await shot(te, 'after-edit-390')
  check('заметка сохранена и видна в карточке', noteSaved, (await text(te)).slice(0, 300).replace(/\n/g, ' | '))

  // ── 4. ученик по ссылке ─────────────────────────────────────────────────────────
  const st = await openAs(b, NEWBIE)
  await go(st, `/login?join=${code}`)
  await st.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 }).catch(() => {})
  const prefilled = await st
    .waitForFunction((c) => [...document.querySelectorAll('input')].some((i) => i.value === c), { polling: 250, timeout: 20000 }, code)
    .then(() => true, () => false)
  check('ссылка → на Главной код уже в поле', prefilled)
  await shot(st, 'student-join-390')
  await click(st, 'Привязать')
  check('ученик привязался — на Главной его преподаватель', await waitText(st, /Преподаватель:\s*Мадина Смоук/))
  const left = await st.evaluate(() => localStorage.getItem('recall.pending_join'))
  check('код из ссылки больше не подставляется', left === null, String(left))

  await te.reload({ waitUntil: 'networkidle2' })
  check('у учителя та же карточка — «в приложении»', await waitText(te, /в приложении/) && /Тимур Ким/.test(await text(te)))
  check('заметка на месте после привязки', /IELTS, цель 7\.0/.test(await text(te)))
  check('под шапкой — студия ученика (домашка)', await waitText(te, /Собрать домашку|Домашка/))
  await go(te, '/teacher')
  check('мест занято 2 из 5', await waitText(te, /В приложении 2 из 5 мест тарифа/))

  // ── 4б. новый ученик по ссылке: вход → онбординг → код уже в поле ─────────────
  const code2 = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
  const c2 = await admin.from('student_cards').insert({ teacher_id: tId, name: 'Новичок по ссылке', status: 'trial', invite_code: code2 }).select('id').single()
  if (c2.error) throw new Error(`карточка 2: ${c2.error.message}`)
  const ctx2 = await b.createBrowserContext()
  const nb = await ctx2.newPage()
  await nb.setViewport({ width: 390, height: 844 })
  await nb.goto(`${APP_URL}/login?join=${code2}`, { waitUntil: 'networkidle2' })
  check('вход по ссылке: «Тебя пригласил преподаватель»', await waitText(nb, /Тебя пригласил преподаватель/))
  await nb.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await nb.type('#f-email', ONBOARD)
  await nb.type('#f-password', PASS)
  await nb.click('button[type="submit"]')
  const toOnboarding = await nb
    .waitForFunction(() => location.pathname === '/onboarding', { polling: 250, timeout: 30000 })
    .then(() => true, () => false)
  check('новичок попал в онбординг', toOnboarding)
  await click(nb, 'Английский')
  await click(nb, 'Не знаю свой уровень')
  const pre2 = await nb
    .waitForFunction((c) => [...document.querySelectorAll('input')].some((i) => i.value === c), { polling: 250, timeout: 15000 }, code2)
    .then(() => true, () => false)
  check('онбординг: на последнем шаге код из ссылки уже в поле', pre2)
  await shot(nb, 'onboarding-join-390')
  await click(nb, 'Привязаться и начать')
  await nb.waitForFunction(() => location.pathname !== '/onboarding', { polling: 250, timeout: 20000 }).catch(() => {})
  const { data: linked2 } = await admin.from('student_cards').select('user_id, status').eq('id', c2.data.id).single()
  check('новичок привязан к своей карточке, она осталась «пробный»', linked2?.user_id === onbId && linked2?.status === 'trial', JSON.stringify(linked2))

  // ── 5. компьютер ───────────────────────────────────────────────────────────────
  await te.setViewport({ width: 1280, height: 800 })
  await go(te, '/teacher')
  check('1280: ничего не выбрано — подсказка справа', await waitText(te, /Выбери ученика слева/))
  await shot(te, 'list-1280')
  await te.evaluate(() => [...document.querySelectorAll('[data-card-row]')].find((r) => r.textContent.includes('Тимур'))?.querySelector('button')?.click())
  await sleep(800)
  const both = await te.evaluate(() => ({
    rows: document.querySelectorAll('[data-card-row]').length,
    name: document.querySelector('[data-card-name]')?.textContent ?? '',
  }))
  check('1280: список и карточка рядом', both.rows >= 2 && both.name === 'Тимур Ким', JSON.stringify(both))
  await shot(te, 'card-1280')
} catch (e) {
  check('смоук дошёл до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
} finally {
  await b?.close().catch(() => {})
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [TEACHER, LINKED, NEWBIE, ONBOARD])
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
