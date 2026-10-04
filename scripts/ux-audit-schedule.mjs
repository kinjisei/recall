/**
 * UX-аудит расписания учителя (PLAN.md Ф2.7: «ux-audit (тач-цели, контраст)
 * чистый»). Та же проверка страницы, что у ux-audit.mjs (_ux-audit-page.mjs),
 * но экраны учителя: день, неделя списком и колонками, шторки урока, «Новый
 * урок» с открытым календарём и колёсами, «Перенести», «Отменить», «Сообщи
 * ученику», учёт уроков (карточка, «Отметить оплату», история, «Напомнить»
 * об оплате) — на 390 и 1280. В шторке проверяется только шторка: экран под
 * затемнением человек не трогает.
 *
 * Запуск: npm run dev:test, затем node scripts/ux-audit-schedule.mjs [--theme light]
 * Отчёт — ux-audit-schedule-report[-light].md; выход 1, если есть замечания.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'
import { auditPage } from './_ux-audit-page.mjs'

if (process.argv.includes('--prod')) {
  console.error('Аудит заводит аккаунт и уроки — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const THEME = process.argv[process.argv.indexOf('--theme') + 1] === 'light' ? 'light' : 'dark'
const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const EMAIL = 'ux-audit-schedule@recall.test'
const PASS = 'UxSchedule!2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const must = (r, w) => {
  if (r.error) throw new Error(`${w}: ${r.error.message}`)
  return r.data
}

/** Учитель Mini с тремя учениками, серией, группой, прошедшим пробным и оплатой. */
async function seed() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'ux-audit-schedule (временный)' })
  for (const u of await sql(`select id from auth.users where lower(email) = '${EMAIL}'`)) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true, user_metadata: { display_name: 'Мадина' } })
  if (error) throw new Error(error.message)
  const id = data.user.id
  const t = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  must(await t.auth.signInWithPassword({ email: EMAIL, password: PASS }), 'вход')
  must(await t.rpc('become_teacher'), 'режим преподавателя')
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '20 days' where id = '${id}'`)
  const card = async (name, status = 'active', contact = '') => must(await t.rpc('create_student_card', { p_name: name, p_status: status, p_contact: contact }), name)
  const timur = await card('Тимур Ким', 'active', '+7 701 123 45 67')
  const dana = await card('Дана Омарова')
  const nur = await card('Нұрсұлтан Ахметов', 'trial')
  const [{ today, wd }] = await sql(`select (now() at time zone 'Asia/Almaty')::date::text as today, extract(isodow from (now() at time zone 'Asia/Almaty'))::int as wd`)
  const at = (shift, hhmm) => new Date(Date.parse(`${today}T${hhmm}:00+05:00`) + shift * 864e5).toISOString()
  must(await t.rpc('set_default_lesson_link', { p_link: 'meet.google.com/kzr-mdsn-tqp' }), 'ссылка')
  must(await t.rpc('create_series', { p_kind: 'individual', p_weekdays: [wd, (wd % 7) + 1], p_time: '10:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: today, p_cards: [timur] }), 'серия')
  must(await t.rpc('create_series', { p_kind: 'group', p_title: 'IELTS вечер', p_weekdays: [wd], p_time: '23:00', p_minutes: 30, p_every_weeks: 1, p_starts_on: today, p_cards: [dana, timur] }), 'группа')
  must(await t.rpc('create_lesson', { p_kind: 'trial', p_starts_at: at(-1, '14:30'), p_minutes: 60, p_cards: [nur] }), 'пробный')
  const past = must(await t.rpc('create_lesson', { p_kind: 'individual', p_starts_at: at(-1, '09:00'), p_minutes: 60, p_cards: [dana] }), 'прошедший')
  must(await t.rpc('add_paid_lessons', { p_card: timur, p_count: 4 }), 'оплата')
  await sql(`select public.schedule_tick(now())`)
  const rows = must(await t.rpc('get_schedule', { p_from: new Date().toISOString(), p_to: at(14, '00:00') }), 'уроки')
  const next = rows.filter((r) => r.card_id === timur && r.kind === 'individual').sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  return { id, timur, next: next?.lesson_id, nextDay: next && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date(next.starts_at)), past, yesterday: at(-1, '12:00').slice(0, 10) }
}

/** Клик по кнопке с подписью — последней в документе (шторка поверх экрана). */
const click = (page, label) =>
  page.evaluate((l) => [...document.querySelectorAll('button, a')].reverse().find((x) => x.textContent.trim().includes(l))?.click(), label).then(() => sleep(600))
const field = (page, label) =>
  page.evaluate((l) => [...document.querySelectorAll('[role="dialog"] button[aria-expanded]')].find((x) => x.textContent.includes(l))?.click(), label).then(() => sleep(500))

let userId = null
let browser = null
const results = []
try {
  const s = await seed()
  userId = s.id
  const PORT = 9600 + Math.floor(Math.random() * 300)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('ux-audit-schedule')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  for (const width of [390, 1280]) {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    await page.setViewport(width < 600 ? { width, height: 844, isMobile: true, hasTouch: true } : { width, height: 860 })
    await page.evaluateOnNewDocument((theme) => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.theme', theme)
      } catch {
        /* about:blank до перехода — хранилища нет, флаги поставит следующая страница */
      }
    }, THEME)
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
    await click(page, 'Войти')
    await page.type('#f-email', EMAIL)
    await page.type('#f-password', PASS)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname !== '/login', { timeout: 30000, polling: 250 })
    const lesson = `/schedule?view=day&day=${s.nextDay}&lesson=${s.next}`
    const screens = [
      ['День', '/schedule?view=day'],
      ['Неделя списком', '/schedule?view=week&layout=list'],
      ['Неделя колонками', '/schedule?view=week&layout=cols'],
      ['Шторка урока', lesson, null, true],
      ['Прошедший урок: отметки', `/schedule?view=day&day=${s.yesterday}&lesson=${s.past}`, null, true],
      ['Новый урок · календарь', '/schedule', async (p) => (await click(p, 'Новый урок'), await field(p, 'Дата')), true],
      ['Новый урок · колёса', '/schedule', async (p) => (await click(p, 'Новый урок'), await field(p, 'Время')), true],
      ['Новый урок · группа и повтор', '/schedule', async (p) => (await click(p, 'Новый урок'), await click(p, 'Группа'), await p.evaluate(() => document.querySelector('[role="dialog"] [role="switch"]')?.click()), await sleep(400)), true],
      ['Перенести', lesson, (p) => click(p, 'Перенести'), true],
      ['Отменить урок', lesson, (p) => click(p, 'Отменить урок'), true],
      ['Напомнить об уроке', lesson, (p) => click(p, 'Напомнить об уроке'), true],
      // учёт уроков (Ф2.8): карточка, оплата, история, «Напомнить» об оплате
      ['Карточка: блок «Уроки»', `/teacher?student=${s.timur}`],
      ['Отметить оплату', `/teacher?student=${s.timur}`, (p) => click(p, 'Отметить оплату'), true],
      ['История уроков и оплат', `/teacher?student=${s.timur}`, (p) => click(p, 'История уроков и оплат'), true],
      ['Напомнить об оплате', `/teacher?student=${s.timur}&remind=1`, null, true],
    ]
    for (const [name, path, act, dialog] of screens) {
      await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
      await sleep(1200)
      if (act) await act(page)
      await sleep(700) // шторка въезжает — дождаться полной непрозрачности
      const issues = await page.evaluate(auditPage, dialog ? '[role="dialog"]' : undefined)
      results.push({ screen: `${name} · ${width}`, path, issues })
      console.log(`${name} · ${width}: ${issues.length} замечаний`)
    }
    await ctx.close()
  }
} finally {
  await browser?.close().catch(() => {})
  if (userId) await deleteTestUser(admin, sql, userId)
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
}

const total = results.reduce((n, r) => n + r.issues.length, 0)
let md = `# UX-аудит расписания — ${new Date().toISOString().slice(0, 10)}, тема: ${THEME}\n\nВсего замечаний: **${total}**\n`
for (const r of results) {
  md += `\n## ${r.screen} (${r.path}) — ${r.issues.length}\n`
  for (const i of r.issues) md += `- [${i.type}] ${i.detail}\n`
}
const file = THEME === 'light' ? 'ux-audit-schedule-report-light.md' : 'ux-audit-schedule-report.md'
writeFileSync(new URL(`../${file}`, import.meta.url), md, 'utf8')
console.log(`\nИтого: ${total} замечаний (тема: ${THEME}). Отчёт: ${file}`)
process.exitCode = total ? 1 : 0
