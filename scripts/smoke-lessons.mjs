/**
 * «Мои уроки», карточка на Главной, Настройки и «Сообщи ученику» в браузере
 * (PLAN.md Ф2.9; макеты u1, u2, u4; журнал п.32, 33, 38, 42, 68):
 *
 *   1. Главная ученика: урок через 5 минут — «Урок через 5 мин», «Войти в
 *      урок» со ссылкой преподавателя, «Начать занятие» — «после урока»
 *      (u1-2); остатка на Главной нет (п.33);
 *   2. «Мои уроки»: ближайшие по времени, группа — названием, «Отменён»,
 *      «Перенесён с …», «Войти в урок» — только у сегодняшнего; «Прошедшие»
 *      свёрнуты, раскрываются; тихая строка «Оплачено ещё N …»; ?lesson= —
 *      урок подсвечен; на компьютере (1280) — тот же список колонкой;
 *   3. ноль оплаченных — «Оплаченные уроки закончились», без минуса и кнопок;
 *      учитель оплат не отмечал — строки нет;
 *   4. самоучка: на Главной карточки нет, «Мои уроки» — «Уроков пока нет»,
 *      в Настройках раздела «Уведомления» нет;
 *   5. Настройки ученика: «Напоминать о скором уроке» — выключил, в базе
 *      false, включил обратно; «О переносе и отмене урока сообщим всегда»;
 *   6. учитель, «Напомнить об уроке» в групповом: написать самому — ученику
 *      без приложения и ученику с выключенными уведомлениями; ученика с
 *      уведомлениями в списке нет (п.68);
 *   7. iPhone во вкладке Safari (push там нет — подменяем возможности браузера
 *      до загрузки): на Главной инструкция «На экран «Домой»» в два шага,
 *      «Не сейчас» — убрана и не возвращается после перезагрузки (u3-4);
 *   8. UX-аудит новых экранов (контраст, тач-цели ≥44, подписи) — 0 замечаний.
 * Push по-настоящему — smoke-push-live.mjs (через туннель).
 *
 * Запуск: npm run dev:test, затем node scripts/smoke-lessons.mjs [--theme light] [--shots папка]
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'
import { auditPage } from './_ux-audit-page.mjs'
import { settledScreenshot } from './_shots.mjs'

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PASS = 'LessonsSmoke!2026'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
const THEME = process.argv[process.argv.indexOf('--theme') + 1] === 'light' ? 'light' : 'dark'
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
const LINK = 'https://meet.google.com/kzr-mdsn-tqp'

async function makeUser(tag, name) {
  const email = `lessons-smoke-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-lessons (временный)' })
  for (const u of await sql(`select id from auth.users where lower(email) = '${email}'`)) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { display_name: name } })
  if (error) throw new Error(error.message)
  made.push(data.user.id)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  must(await client.auth.signInWithPassword({ email, password: PASS }), `вход ${tag}`)
  return { id: data.user.id, email, client }
}

async function openAs(b, email, width = 390, beforeLoad = null) {
  const ctx = await b.createBrowserContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  ошибка страницы:', e.message))
  await page.setViewport(width < 600 ? { width, height: 844, isMobile: true, hasTouch: true } : { width, height: 860 })
  await page.evaluateOnNewDocument((theme) => {
    try {
      localStorage.setItem('recall.onboarded', '1')
      localStorage.setItem('recall.theme', theme)
    } catch {
      /* about:blank — хранилища нет */
    }
  }, THEME)
  if (beforeLoad) await page.evaluateOnNewDocument(beforeLoad)
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  const entered = await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 }).then(() => true, () => false)
  if (!entered) throw new Error(`вход ${email} не прошёл: ${(await text(page)).replace(/\s+/g, ' ').slice(0, 160)}`)
  await sleep(800)
  return page
}
const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout }, re.source).then(() => true, () => false)
async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await settledScreenshot(page, { path: `${SHOTS}/${name}-${THEME}.png`, fullPage: true })
}
/** UX-аудит части экрана (контраст, тач-цели, подписи) — 0 замечаний. */
async function audit(page, name, sel) {
  await sleep(500) // шторки и появление — до полной непрозрачности
  const issues = await page.evaluate(auditPage, sel)
  check(`UX (${THEME}): ${name} — 0 замечаний`, issues.length === 0, JSON.stringify(issues.slice(0, 4)))
}

let b = null
try {
  // ── данные ─────────────────────────────────────────────────────────────────────
  const t = await makeUser('t', 'Мадина Сейткали')
  must(await t.client.rpc('become_teacher'), 'режим преподавателя')
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '20 days' where id = '${t.id}'`)
  must(await t.client.rpc('set_default_lesson_link', { p_link: LINK }), 'ссылка по умолчанию')
  const a = await makeUser('a', 'Айгерим Нурланова')
  const z = await makeUser('z', 'Арман Без уроков-оплат')
  const solo = await makeUser('solo', 'Самоучка')
  const p = await makeUser('p', 'Тимур С уведомлениями')
  await admin.from('teacher_students').insert([a, z, p].map((s) => ({ teacher_id: t.id, student_id: s.id })))
  const cards = must(await t.client.rpc('get_my_student_cards'), 'карточки')
  const cardOf = (u) => cards.find((c) => c.user_id === u.id).id
  const [ca, cz, cp] = [cardOf(a), cardOf(z), cardOf(p)]
  const cn = must(await t.client.rpc('create_student_card', { p_name: 'Даулет Без приложения', p_status: 'active', p_contact: '+7 701 765 43 21' }), 'без приложения')
  // у Тимура уведомления включены — подписка записана, как после «Включить»
  must(await p.client.rpc('save_push_subscription', { p_endpoint: `https://fcm.googleapis.com/fcm/send/smoke-${randomBytes(8).toString('hex')}`, p_p256dh: randomBytes(65).toString('base64url'), p_auth: randomBytes(16).toString('base64url') }), 'подписка Тимура')

  const [{ now }] = await sql('select now() as now')
  const at = (min) => new Date(Date.parse(now) + min * 60_000).toISOString()
  const soon = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: at(5), p_minutes: 60, p_cards: [ca] }), 'урок через 5 мин')
  const club = must(await t.client.rpc('create_lesson', { p_kind: 'group', p_starts_at: at(2 * 1440), p_minutes: 60, p_cards: [ca, cz, cp, cn], p_title: 'Разговорный клуб' }), 'клуб')
  const cancelled = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: at(3 * 1440), p_minutes: 60, p_cards: [ca] }), 'отменят')
  must(await t.client.rpc('cancel_lesson', { p_lesson: cancelled, p_charge: false }), 'отмена')
  const moved = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: at(4 * 1440), p_minutes: 60, p_cards: [ca] }), 'перенесут')
  must(await t.client.rpc('update_lesson', { p_lesson: moved, p_kind: 'individual', p_starts_at: at(4 * 1440 + 60), p_minutes: 60, p_cards: [ca] }), 'перенос')
  const past = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: at(-2 * 1440), p_minutes: 60, p_cards: [ca] }), 'прошедший')
  must(await t.client.rpc('mark_lesson_participant', { p_lesson: past, p_card: ca, p_outcome: 'present' }), 'был')
  must(await t.client.rpc('add_paid_lessons', { p_card: ca, p_count: 4 }), '+4 Айгерим') // 4 − 1 списан = 3
  must(await t.client.rpc('add_paid_lessons', { p_card: cz, p_count: 1 }), '+1 Арман')
  const zpast = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: at(-3 * 1440), p_minutes: 60, p_cards: [cz] }), 'прошедший Армана')
  must(await t.client.rpc('mark_lesson_participant', { p_lesson: zpast, p_card: cz, p_outcome: 'present' }), 'был Арман') // 1 − 1 = 0

  const PORT = 9500 + Math.floor(Math.random() * 400)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('lessons')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }

  // ── 1. Главная ученика ───────────────────────────────────────────────────────────
  const sa = await openAs(b, a.email)
  await go(sa, '/')
  check('Главная: «Урок через 5 мин» (или 4) и «Сегодня, …»', await waitText(sa, /Урок через [45] мин[\s\S]*Сегодня, \d\d:\d\d–\d\d:\d\d/))
  const join = await sa.$eval('[data-next-lesson] a[target="_blank"]', (e) => ({ text: e.textContent.trim(), href: e.href })).catch(() => null)
  check('«Войти в урок» — ссылка преподавателя', join?.text === 'Войти в урок' && join.href === LINK, JSON.stringify(join))
  check('«Начать занятие» — второстепенное, «после урока» (u1-2)', /Начать занятие\s*~15 минут · после урока/.test(await text(sa)))
  check('на Главной остатка оплаченных уроков нет (п.33)', !/Оплачено ещё|Оплаченные уроки/.test(await text(sa)))
  await shot(sa, 'home-soon-390')
  await audit(sa, 'карточка «Ближайший урок»', '[data-next-lesson]')

  // ── 2. «Мои уроки» ────────────────────────────────────────────────────────────────
  await sa.evaluate(() => [...document.querySelectorAll('[data-next-lesson] a')].find((x) => x.textContent.includes('Все уроки'))?.click())
  // заголовок раздела набран капсом через CSS — innerText отдаёт «БЛИЖАЙШИЕ»
  check('«Все уроки» → «Мои уроки»', await waitText(sa, /Мои уроки[\s\S]*БЛИЖАЙШИЕ/) && (await sa.evaluate(() => location.pathname)) === '/lessons')
  const rows = await sa.$$eval('[data-my-lesson]', (els) => els.map((e) => ({ id: e.getAttribute('data-my-lesson'), text: e.innerText.replace(/\s+/g, ' ') })))
  check('ближайшие по времени: сегодняшний, клуб, отменённый, перенесённый', rows.map((r) => r.id).join() === [soon, club, cancelled, moved].join(), JSON.stringify(rows.map((r) => r.id)))
  check('группа — названием, без других участников', /Разговорный клуб/.test(rows[1]?.text ?? '') && !/Арман|Тимур|Даулет/.test(await text(sa)))
  check('пометки «Отменён» и «Перенесён с …»', /Отменён/.test(rows[2]?.text ?? '') && /Перенесён с \S+, \d+ \S+, \d\d:\d\d/.test(rows[3]?.text ?? ''), `${rows[2]?.text} | ${rows[3]?.text}`)
  const joins = await sa.$$eval('[data-my-lesson] a[target="_blank"]', (els) => els.length)
  check('«Войти в урок» — только у сегодняшнего', joins === 1 && /Войти в урок/.test(rows[0]?.text ?? ''))
  const quiet = await sa.$eval('[data-balance-line]', (e) => e.innerText.trim()).catch(() => '')
  check('тихая строка «Оплачено ещё 3 урока»', quiet === 'Оплачено ещё 3 урока', quiet)
  check('«Прошедшие · 1» свёрнуты', /Прошедшие\s*1/.test(await text(sa)) && !(await sa.$(`[data-my-lesson="${past}"]`)))
  await sa.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].find((x) => x.textContent.includes('Прошедшие'))?.click())
  check('«Прошедшие» раскрываются', await sa.waitForSelector(`[data-my-lesson="${past}"]`, { timeout: 5000 }).then(() => true, () => false))
  await shot(sa, 'my-lessons-390')
  await audit(sa, '«Мои уроки» · 390', 'main')
  await go(sa, `/lessons?lesson=${moved}`)
  await sleep(800)
  check('?lesson= (из уведомления) — урок подсвечен', await sa.$eval(`[data-my-lesson="${moved}"]`, (e) => e.className.includes('ring-')).catch(() => false))
  const desk = await openAs(b, a.email, 1280)
  await go(desk, '/lessons')
  const wide = await desk.$eval('[data-my-lesson]', (e) => e.closest('ul').getBoundingClientRect().width).catch(() => 0)
  check('компьютер (1280): список колонкой, не на всю ширину', wide > 300 && wide <= 700, String(wide))
  await shot(desk, 'my-lessons-1280')
  await audit(desk, '«Мои уроки» · 1280', 'main')

  // ── 3. ноль и «учёт не ведётся» ─────────────────────────────────────────────────────
  const sz = await openAs(b, z.email)
  await go(sz, '/lessons')
  await waitText(sz, /Мои уроки/)
  const zline = await sz.$eval('[data-balance-line]', (e) => e.innerText.trim()).catch(() => '')
  check('ноль — «Оплаченные уроки закончились», без минуса и кнопок', zline === 'Оплаченные уроки закончились' && !/−|-\d|Оплатить/.test(await text(sz)), zline)
  await shot(sz, 'my-lessons-zero-390')
  await audit(sz, '«Мои уроки»: оплаченные закончились', 'main')
  const sp = await openAs(b, p.email)
  await go(sp, '/lessons')
  await waitText(sp, /Разговорный клуб/)
  check('учитель оплат не отмечал — строки остатка нет', !(await sp.$('[data-balance-line]')))

  // ── 4. самоучка ──────────────────────────────────────────────────────────────────
  const ss = await openAs(b, solo.email)
  await go(ss, '/')
  await waitText(ss, /Начать занятие/)
  check('самоучка: на Главной карточки урока нет', !(await ss.$('[data-next-lesson]')))
  await go(ss, '/lessons')
  check('самоучка: «Уроков пока нет — их добавляет преподаватель»', await waitText(ss, /Уроков пока нет[\s\S]*добавляет преподаватель/))
  await go(ss, '/settings')
  await waitText(ss, /Настройки/)
  await sleep(1500)
  check('самоучка: в Настройках раздела «Уведомления» нет', !(await ss.$('[data-lesson-reminders]')))

  // ── 5. Настройки ученика ───────────────────────────────────────────────────────────
  await go(sa, '/settings')
  check('Настройки: «Напоминать о скором уроке · за час до начала», «сообщим всегда»', await waitText(sa, /Напоминать о скором уроке\s*за час до начала[\s\S]*О переносе и отмене урока сообщим всегда/))
  await sa.click('[data-lesson-reminders] [role="switch"]')
  await sleep(1500)
  const [off] = await sql(`select lesson_reminders from public.notification_prefs where user_id = '${a.id}'`)
  check('выключил — в базе false', off?.lesson_reminders === false, JSON.stringify(off))
  await shot(sa, 'settings-390')
  await audit(sa, 'Настройки: «Уведомления»', '[data-lesson-reminders]')
  await sa.click('[data-lesson-reminders] [role="switch"]')
  await sleep(1500)
  const [on] = await sql(`select lesson_reminders from public.notification_prefs where user_id = '${a.id}'`)
  check('включил обратно — true', on?.lesson_reminders === true)

  // ── 6. учитель: кому написать самому ─────────────────────────────────────────────────
  const te = await openAs(b, t.email)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date(at(2 * 1440)))
  await go(te, `/schedule?view=day&day=${day}&lesson=${club}`)
  await waitText(te, /Напомнить об уроке/)
  await te.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent.includes('Напомнить об уроке'))?.click())
  check('«Напомнить»: Даулет — без приложения, Айгерим и Арман — уведомления выключены',
    await waitText(te, /Даулет Без приложения — без приложения/) && /Айгерим Нурланова — уведомления в Recall выключены, напиши сам/.test(await text(te)) && /Арман Без уроков-оплат — уведомления в Recall выключены/.test(await text(te)))
  check('Тимура с уведомлениями в списке нет — Recall напишет сам', !/Тимур С уведомлениями/.test(await te.$eval('[role="dialog"]', (e) => e.innerText).catch(() => '')))
  await shot(te, 'teacher-tell-390')
  await audit(te, '«Напомнить об уроке» учителя', '[role="dialog"]')

  // ── 7. iPhone во вкладке Safari ──────────────────────────────────────────────────────
  const ios = await openAs(b, a.email, 390, () => {
    delete window.PushManager
    Object.defineProperty(Navigator.prototype, 'standalone', { get: () => false, configurable: true })
  })
  await go(ios, '/')
  check('iPhone во вкладке: «добавь Recall на экран «Домой»» в два шага', await waitText(ios, /добавь Recall на экран «Домой»[\s\S]*Поделиться[\s\S]*На экран «Домой»/))
  await shot(ios, 'ios-install-390')
  await audit(ios, 'инструкция для iPhone', '[data-ios-install]')
  await ios.evaluate(() => [...document.querySelectorAll('[data-ios-install] button')].find((x) => x.textContent.trim() === 'Не сейчас')?.click())
  await sleep(500)
  const hidden = !(await ios.$('[data-ios-install]'))
  await go(ios, '/')
  await waitText(ios, /Начать занятие/)
  await sleep(2500)
  check('«Не сейчас» — убрана и после перезагрузки не возвращается', hidden && !(await ios.$('[data-ios-install]')))
} catch (e) {
  check('смоук дошёл до конца', false, String(e?.message ?? e).split('\n')[0])
} finally {
  await b?.close().catch(() => {})
  for (const id of made) await deleteTestUser(admin, sql, id).catch((e) => console.log(`  ⚠ ${e.message}`))
  await admin.from('allowed_emails').delete().like('email', 'lessons-smoke-%@recall.test')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
