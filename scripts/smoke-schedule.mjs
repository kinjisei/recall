/**
 * Расписание учителя в браузере (PLAN.md Ф2.7; макеты t2–t5, t7-4, t9-3, d1,
 * d2). Сам заводит учителя (Mini) и ученика в приложении, AI не трогает.
 *
 *   0. пустое расписание → «Добавить первого ученика» → шторка урока уже с
 *      ним → серия «каждый <сегодня> и <послезавтра> в 10:00» (база: серия);
 *   1. группа «IELTS вечер» из двух учеников, серия в 17:00 — повторяющиеся
 *      уроки у трёх карточек, включая группу;
 *   2. пробный: «Новый ученик» прямо в шторке, урок вчера в 12:00 →
 *      будильник → «Пробный урок прошёл · остаётся заниматься?» → «Да» →
 *      «+8» → карточка «занимается», оплачено 8, пробный не списан;
 *   3. перенос одного урока серии на 11:00 → «Сообщи ученику» (WhatsApp на
 *      номер, текст «… 10:00 → … 11:00»); серия не порвалась;
 *   4. «Изменить» урока раньше перенесённого → «Этот и все следующие» →
 *      предупреждение «впереди 1 урок, перенесённых отдельно»;
 *   5. отмена с поздним списанием: «Станет 3 урока» → отменён, списан,
 *      остаток 3 → «Вернуть» → остаток 4 → снова отмена; кнопка — сплошной
 *      красный, один урок — без диалога (есть «Вернуть»);
 *   5в. серия Даны «этот и все следующие» → диалог по центру «Отменить
 *      уроки?» (Ф2.17-4б-3): Escape закрывает только его, «Оставить» — уроки
 *      на месте, «Отменить уроки» — урок отменён, уроки после удалены;
 *      пробный — «не списывается», без выбора и без диалога, в базе не списан;
 *   6. неделя видна целиком: список и колонки (7 дней), шапка дня ведёт в день;
 *   7. без тарифа: строка «только для просмотра», действия выключены;
 *   8. компьютер 1280: по умолчанию неделя колонками, «Новый урок» — панелью.
 *
 * Системное окно браузера (window.confirm и т.п.) на любом шаге — красная
 * строка: подтверждения — только нашим диалогом.
 *
 * Запуск: npm run dev:test, затем node scripts/smoke-schedule.mjs
 *         [--shots <папка>] — скриншоты 390 и 1280; [--theme light] — в светлой
 *         теме (как переключатель владельца, `recall.theme`).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'
import { settledScreenshot } from './_shots.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунты и уроки — только тестовая база (npm run dev:test).')
  process.exit(1)
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'ScheduleSmoke!2026'
const TEACHER = 'schedule-smoke-teacher@recall.test'
const STUDENT = 'schedule-smoke-student@recall.test'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
const themeAt = process.argv.indexOf('--theme')
const THEME = themeAt > 0 ? process.argv[themeAt + 1] : 'dark'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

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
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-schedule' })
  // с чистого листа: уроки прошлого прогона мешали бы. Ищем запросом, а не
  // listUsers: в тестовой базе аккаунтов больше одной страницы
  const old = await sql(`select id from auth.users where lower(email) = '${email}'`)
  for (const u of old) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { display_name: name } })
  if (error) throw new Error(`${email}: ${error.message}`)
  await admin.from('profiles').update({ display_name: name }).eq('id', data.user.id)
  return data.user.id
}

async function openAs(b, email, width = 390) {
  const ctx = await b.createBrowserContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  ошибка страницы:', e.message))
  // подтверждения — только нашим диалогом по центру; системное окно — ошибка
  page.on('dialog', (d) => {
    check(`системного окна браузера нет (было: «${d.message()}»)`, false)
    void d.dismiss()
  })
  await page.setViewport({ width, height: width > 600 ? 860 : 844 })
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate((th) => {
    localStorage.setItem('recall.onboarded', '1')
    localStorage.setItem('recall.theme', th)
  }, THEME)
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
/** Неделя колонками дорисовалась: 7 шапок дней. Уроки приходят с базы — после
 *  networkidle2 бывает ещё секунда-три (замер 19.10.2026), поэтому ждём, а не считаем сразу. */
const weekHeads = (page) =>
  page
    .waitForFunction(() => document.querySelectorAll('button[aria-label$="Открыть день"]').length === 7, { polling: 250, timeout: 10000 })
    .then(() => true, () => false)
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout }, re.source).then(() => true, () => false)
/** Нажать кнопку или ссылку с подписью; последняя в документе — шторка поверх экрана. */
async function click(page, label, timeout = 15000) {
  const ok = await page
    .waitForFunction((l) => [...document.querySelectorAll('button, a, [role="switch"]')].some((x) => x.textContent.trim().includes(l) && !x.disabled), { polling: 250, timeout }, label)
    .then(() => true, () => false)
  if (ok) await page.evaluate((l) => [...document.querySelectorAll('button, a, [role="switch"]')].reverse().find((x) => x.textContent.trim().includes(l) && !x.disabled)?.click(), label)
  await sleep(500)
  return ok
}
/** Текст нашего диалога по центру (useConfirm) или null, если его нет. */
const askText = (page) => page.evaluate(() => document.querySelector('[role="alertdialog"]')?.textContent ?? null)
/** Нажать кнопку в диалоге по центру — не в шторке под ним с той же подписью. */
async function inAsk(page, label) {
  await page.evaluate((l) => [...document.querySelectorAll('[role="alertdialog"] button')].find((x) => x.textContent.trim() === l)?.click(), label)
  await sleep(500)
}
/** Главная кнопка шторки отмены — сплошной красный (t5-2): фон как у bg-danger. */
const solidRed = (page, label) =>
  page.evaluate((l) => {
    const btn = [...document.querySelectorAll('[role="dialog"] button')].reverse().find((x) => x.textContent.trim() === l)
    const probe = document.createElement('div')
    probe.className = 'bg-danger'
    document.body.append(probe)
    const want = getComputedStyle(probe).backgroundColor
    probe.remove()
    return !!btn && getComputedStyle(btn).backgroundColor === want
  }, label)
const clickSel = async (page, sel) => {
  const ok = await page.waitForSelector(sel, { visible: true, timeout: 10000 }).then(() => true, () => false)
  if (ok) await page.evaluate((s) => [...document.querySelectorAll(s)].pop()?.click(), sel)
  await sleep(400)
  return ok
}
/** Колесо времени: Home и стрелки вниз до нужного числа. */
async function wheelTo(page, label, n) {
  await page.focus(`[role="spinbutton"][aria-label="${label}"]`)
  await page.keyboard.press('Home')
  for (let i = 0; i < n; i++) await page.keyboard.press('ArrowDown')
  await sleep(300)
}
/** Поле «Время» в шторке → колёса → часы и минуты. */
async function setTime(page, hh, mm = 0) {
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button[aria-expanded]')].find((x) => x.textContent.includes('Время'))?.click())
  await page.waitForSelector('[role="spinbutton"][aria-label="Часы"]', { timeout: 5000 })
  await wheelTo(page, 'Часы', hh)
  await wheelTo(page, 'Минуты', mm)
}
async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await settledScreenshot(page, { path: `${SHOTS}/${name}.png`, fullPage: false })
}

const ids = []
let b = null
try {
  const tId = await makeUser(TEACHER, 'Мадина Смоук')
  const sId = await makeUser(STUDENT, 'Айгерим Нурланова')
  ids.push(tId, sId)
  const tc = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  must(await tc.auth.signInWithPassword({ email: TEACHER, password: PASS }), 'вход учителя')
  must(await tc.rpc('become_teacher'), 'режим преподавателя')
  await admin.from('profiles').update({ plan: 'teacher_mini', plan_expires_at: new Date(Date.now() + 20 * 864e5).toISOString() }).eq('id', tId)
  const [{ today }] = await sql(`select (now() at time zone 'Asia/Almaty')::date::text as today`)
  const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
  const almatyTime = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
  const schedule = async () => must(await tc.rpc('get_schedule', { p_from: new Date(Date.now() - 3 * 864e5).toISOString(), p_to: new Date(Date.now() + 90 * 864e5).toISOString() }), 'get_schedule')
  const cardsNow = async () => must(await tc.rpc('get_my_student_cards'), 'карточки')
  const balance = async (card) => (must(await tc.rpc('get_lesson_balances'), 'остатки').find((r) => r.card_id === card) ?? { paid: 0, balance: 0 })

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('schedule')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }
  const te = await openAs(b, TEACHER)

  // ── 0. пустое расписание → первый ученик → первый урок ──────────────────────────
  await go(te, '/schedule')
  check('пустое: «Пока нет уроков» и «Добавить первого ученика»', await waitText(te, /Пока нет уроков/) && /Добавить первого ученика/.test(await text(te)))
  await shot(te, 'empty-390')
  await click(te, 'Добавить первого ученика')
  await te.waitForSelector('input[placeholder="Имя и фамилия"]', { timeout: 10000 })
  await te.type('input[placeholder="Имя и фамилия"]', 'Тимур Ким')
  await te.type('input[placeholder^="+7 700"]', '+7 701 123 45 67')
  await click(te, 'Занимается')
  await click(te, 'Добавить')
  // «Новый урок» есть и на кнопке экрана — ждём саму карточку в форме, но не дольше 3 с: «сразу»
  check('после карточки — сразу шторка урока с ней', await waitText(te, /Новый урок[\s\S]*Тимур Ким[\s\S]*Сменить/, 3000))
  await clickSel(te, '[role="dialog"] [role="switch"]')
  // второй день серии — послезавтра (первый — день урока, сегодня, отмечен сам)
  const wd2 = (new Date(`${day(2)}T00:00:00Z`).getUTCDay() + 6) % 7
  await te.evaluate((i) => document.querySelectorAll('[role="dialog"] [aria-label="Дни недели"] button')[i]?.click(), wd2)
  await sleep(300)
  await setTime(te, 10)
  await shot(te, 'new-lesson-wheel-390')
  check('сводка серии: «Каждый/ую …, 10:00–11:00 · с …, без даты окончания»', /Кажд\S+ \S+ и \S+, 10:00–11:00 · с .+, без даты окончания/.test(await te.$eval('[data-lesson-summary]', (e) => e.textContent)))
  await click(te, 'Создать урок')
  check('тост «Уроки созданы»', await waitText(te, /Уроки созданы/))
  const timur = (await cardsNow()).find((c) => c.name === 'Тимур Ким')
  const series1 = must(await tc.rpc('get_my_series'), 'серии')
  check('база: серия Тимура, два дня недели, 10:00', series1.length === 1 && series1[0].weekdays.length === 2 && series1[0].start_time.startsWith('10:00') && series1[0].card_ids[0] === timur?.id, JSON.stringify(series1))

  // ── 1. группа из двух учеников ────────────────────────────────────────────────
  await admin.from('teacher_students').insert({ teacher_id: tId, student_id: sId })
  must(await tc.rpc('create_student_card', { p_name: 'Дана Омарова', p_status: 'active' }), 'карточка Даны')
  await te.reload({ waitUntil: 'networkidle2' })
  await click(te, 'Новый урок')
  await click(te, 'Группа')
  await te.type('input[placeholder="Например, IELTS вечер"]', 'IELTS вечер')
  await click(te, 'Дана Омарова')
  await click(te, 'Айгерим Нурланова')
  await setTime(te, 17)
  await clickSel(te, '[role="dialog"] [role="switch"]')
  await shot(te, 'new-group-390')
  await click(te, 'Создать урок')
  check('тост после группы', await waitText(te, /Уроки созданы/))
  const group = must(await tc.rpc('get_my_series'), 'серии').find((s) => s.kind === 'group')
  check('база: группа «IELTS вечер» — серия из двух учеников', group?.title === 'IELTS вечер' && group.card_ids.length === 2, JSON.stringify(group))

  // ── 2. пробный: новый ученик в шторке, урок вчера, «остаётся?» → «Да» → +8 ──────
  await click(te, 'Новый урок')
  await click(te, 'Пробный')
  await click(te, 'Новый ученик')
  await te.type('input[placeholder="Имя и фамилия"]', 'Аружан Сейтова')
  await te.type('input[placeholder="Телефон или ник в Telegram"]', '@aruzhan_s')
  await click(te, 'Добавить ученика')
  await te.evaluate(() => [...document.querySelectorAll('[role="dialog"] button[aria-expanded]')].find((x) => x.textContent.includes('Дата'))?.click())
  await sleep(300)
  if (day(-1).slice(5, 7) !== today.slice(5, 7)) await te.click('[aria-label="Предыдущий месяц"]')
  await clickSel(te, `[aria-label="${Number(day(-1).slice(8))} ${MONTHS[Number(day(-1).slice(5, 7)) - 1]}"]`)
  await setTime(te, 12)
  check('сводка пробного: «пробный, не списывается»', /пробный, не списывается/.test(await te.$eval('[data-lesson-summary]', (e) => e.textContent)))
  await click(te, 'Создать урок')
  check('тост «Урок создан»', await waitText(te, /Урок создан/))
  await sql(`select public.schedule_tick(now())`)
  await go(te, '/schedule')
  check('вопрос после пробного: «Аружан Сейтова остаётся заниматься?»', await waitText(te, /Пробный урок прошёл[\s\S]*Аружан Сейтова остаётся заниматься\?/))
  await shot(te, 'trial-question-390')
  await click(te, 'Да')
  check('«Да» → «теперь занимается · Отметить оплату?»', await waitText(te, /Аружан теперь занимается/))
  await shot(te, 'trial-paid-390')
  await click(te, '+8')
  await click(te, 'Отметить')
  check('тост «Отмечено: +8»', await waitText(te, /Отмечено: \+8/))
  const aruzhan = (await cardsNow()).find((c) => c.name === 'Аружан Сейтова')
  const trialRow = (await schedule()).find((r) => r.card_id === aruzhan?.id)
  check('база: карточка «занимается», оплачено 8, пробный урок не списан', aruzhan?.status === 'active' && (await balance(aruzhan.id)).paid === 8 && trialRow?.charge === 'not_charged', JSON.stringify({ status: aruzhan?.status, charge: trialRow?.charge }))

  // ── 3. перенос одного урока серии ──────────────────────────────────────────────
  const timurAhead = () =>
    schedule().then((rows) => rows.filter((r) => r.card_id === timur.id && r.status === 'planned' && Date.parse(r.starts_at) > Date.now()).sort((x, y) => x.starts_at.localeCompare(y.starts_at)))
  let ahead = await timurAhead()
  const [first, second, third] = ahead
  const dayOf = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date(iso))
  await go(te, `/schedule?view=day&day=${dayOf(second.starts_at)}&lesson=${second.lesson_id}`)
  check('шторка урока по адресу: «Перенести», «Изменить», «Отменить урок»', await waitText(te, /Перенести[\s\S]*Изменить[\s\S]*Отменить урок/))
  await shot(te, 'lesson-sheet-390')
  await click(te, 'Перенести')
  await setTime(te, 11)
  await shot(te, 'move-390')
  await click(te, 'Перенести')
  check('«Сообщи ученику»: «Урок перенесён», Тимур без приложения', await waitText(te, /Урок перенесён[\s\S]*Тимур Ким — без приложения, отправь сообщение сам/))
  const tell = await te.$eval('[data-tell-message]', (e) => e.textContent)
  const wa = await te.evaluate(() => document.querySelector('[role="dialog"] a[data-share="whatsapp"]')?.href ?? '')
  check('текст «Тимур, урок перенесён: … 10:00 → … 11:00»', /^Тимур, урок перенесён: .+, 10:00 → .+, 11:00$/.test(tell), tell)
  check('WhatsApp — на номер из карточки', wa.startsWith('https://wa.me/77011234567?text='), wa.slice(0, 60))
  await shot(te, 'tell-390')
  await click(te, 'Готово')
  ahead = await timurAhead()
  const movedRow = ahead.find((r) => r.lesson_id === second.lesson_id)
  check('база: урок в 11:00, «перенесён с», серия та же', almatyTime(movedRow?.starts_at) === '11:00' && !!movedRow?.moved_from && movedRow?.series_id === second.series_id, JSON.stringify(movedRow))
  check('остальные уроки серии — в 10:00', ahead.filter((r) => r.lesson_id !== second.lesson_id).every((r) => almatyTime(r.starts_at) === '10:00'))

  // ── 4. «этот и все следующие» предупреждает о перенесённом впереди ──────────────
  await go(te, `/schedule?view=day&day=${dayOf(first.starts_at)}&lesson=${first.lesson_id}`)
  await click(te, 'Изменить')
  await click(te, 'Этот и все следующие')
  check('предупреждение: «Впереди 1 урок, перенесённых отдельно»', await waitText(te, /Впереди 1 урок, перенесённых отдельно/))
  await shot(te, 'edit-following-390')
  await te.keyboard.press('Escape')
  await sleep(400)

  // ── 5. отмена с поздним списанием и «Вернуть» ───────────────────────────────────
  must(await tc.rpc('add_paid_lessons', { p_card: timur.id, p_count: 4 }), 'оплата Тимура')
  const cancelThird = async (name) => {
    await go(te, `/schedule?view=day&day=${dayOf(third.starts_at)}&lesson=${third.lesson_id}`)
    await click(te, 'Отменить урок')
    await click(te, 'Списать — поздняя отмена')
    if (name) await shot(te, name)
    const hint = /Станет 3 урока/.test(await text(te))
    if (name) check('«Отменить урок» — сплошной красный (t5-2)', await solidRed(te, 'Отменить урок'))
    await click(te, 'Отменить урок')
    return hint
  }
  // тост живёт 6 секунд: сперва «Вернуть» сразу, потом отмена насовсем и сверка с базой
  check('выбор показывает остаток: «Станет 3 урока»', await cancelThird('cancel-390'))
  check('тост «Урок отменён · Вернуть»', await waitText(te, /Урок отменён[\s\S]*Вернуть/))
  check('один урок — без диалога: вернуть можно тостом', (await askText(te)) === null)
  await click(te, 'Готово')
  await click(te, 'Вернуть', 3000)
  await sleep(1500)
  let row = (await schedule()).find((r) => r.lesson_id === third.lesson_id)
  check('«Вернуть» вернул урок, остаток 4', row?.status === 'planned' && (await balance(timur.id)).balance === 4, JSON.stringify({ s: row?.status }))
  await cancelThird()
  await waitText(te, /Урок отменён/)
  row = (await schedule()).find((r) => r.lesson_id === third.lesson_id)
  check('база: отменён, поздняя отмена, остаток 3', row?.status === 'cancelled' && row?.charge === 'late_cancel' && (await balance(timur.id)).balance === 3, JSON.stringify({ s: row?.status, c: row?.charge }))
  await click(te, 'Готово')

  // ── 5в. серия «этот и все следующие» — диалог по центру; пробный — без него ──────
  // своя серия у Даны: уроки Тимура нужны паузе (6б) и «только просмотру» (7)
  const isoDay = (d) => ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
  const dana = (await cardsNow()).find((c) => c.name === 'Дана Омарова')
  const danaSeries = must(await tc.rpc('create_series', {
    p_kind: 'individual', p_weekdays: [...new Set([isoDay(day(1)), isoDay(day(3))])], p_time: '15:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: day(1), p_cards: [dana.id],
  }), 'серия Даны')
  const danaPlanned = async () => (await schedule()).filter((r) => r.series_id === danaSeries && r.status === 'planned').sort((x, y) => x.starts_at.localeCompare(y.starts_at))
  const danaRows = await danaPlanned()
  const target = danaRows[1]
  await go(te, `/schedule?view=day&day=${dayOf(target.starts_at)}&lesson=${target.lesson_id}`)
  await click(te, 'Отменить урок')
  await click(te, 'Этот и все следующие')
  check('«Этот и все следующие»: предупреждение и «Отменить уроки» сплошным красным', /Уроки после этого удалятся/.test(await text(te)) && (await solidRed(te, 'Отменить уроки')))
  await shot(te, 'cancel-following-390')
  await click(te, 'Отменить уроки')
  const asked = await askText(te)
  check('серия спрашивает диалогом по центру: «Отменить уроки?» и что удалится', !!asked && /Отменить уроки\?/.test(asked) && /удалятся/.test(asked), asked ?? 'диалога нет')
  await shot(te, 'cancel-following-confirm-390')
  await te.keyboard.press('Escape')
  await sleep(600)
  check('Escape закрывает только диалог — шторка отмены остаётся', (await askText(te)) === null && /Что изменить/.test(await text(te)))
  await click(te, 'Отменить уроки')
  await inAsk(te, 'Оставить')
  check('«Оставить» — диалог закрыт, уроки серии на месте', (await askText(te)) === null && (await danaPlanned()).length === danaRows.length)
  await click(te, 'Отменить уроки')
  await inAsk(te, 'Отменить уроки')
  check('тост «Уроки отменены»', await waitText(te, /Уроки отменены/))
  const afterSeries = await danaPlanned()
  const targetNow = (await schedule()).find((r) => r.lesson_id === target.lesson_id)
  check('база: урок отменён, уроки серии после него удалены', targetNow?.status === 'cancelled' && afterSeries.length === 1 && afterSeries[0].lesson_id === danaRows[0].lesson_id, JSON.stringify({ s: targetNow?.status, left: afterSeries.length, was: danaRows.length }))
  await click(te, 'Готово', 3000)

  const erlan = must(await tc.rpc('create_student_card', { p_name: 'Ерлан Сапаров', p_status: 'trial' }), 'карточка пробного')
  // 14:00 по Алматы послезавтра — мимо уроков Тимура (10:00) и группы (17:00)
  const trialLesson = must(await tc.rpc('create_lesson', { p_kind: 'trial', p_starts_at: new Date(Date.parse(`${day(2)}T09:00:00Z`)).toISOString(), p_minutes: 45, p_cards: [erlan] }), 'пробный урок')
  await go(te, `/schedule?view=day&day=${day(2)}&lesson=${trialLesson}`)
  await click(te, 'Отменить урок')
  const trialSheet = await text(te)
  check('пробный: «не списывается — и при поздней отмене», выбора «Списать» нет', /Пробный урок не списывается — и при поздней отмене/.test(trialSheet) && !/Списать — поздняя отмена/.test(trialSheet))
  await click(te, 'Отменить урок')
  check('пробный отменён без диалога', (await waitText(te, /Урок отменён/)) && (await askText(te)) === null)
  const trialCancelled = (await schedule()).find((r) => r.lesson_id === trialLesson)
  check('база: пробный отменён и не списан', trialCancelled?.status === 'cancelled' && trialCancelled?.charge === 'not_charged', JSON.stringify({ s: trialCancelled?.status, c: trialCancelled?.charge }))
  await click(te, 'Готово', 3000)

  // ── 5б. таблица или список — у дня тоже (правка владельца 05.10.2026, Ф2.10) ───
  await go(te, '/schedule')
  const layoutNow = (p) => p.$eval('[data-schedule-layout]', (e) => e.getAttribute('data-schedule-layout')).catch(() => null)
  check('телефон: день по умолчанию списком — уроки строками, без ленты часов', (await layoutNow(te)) === 'list' && !(await te.$('ol[aria-label="Уроки дня"]')))
  await shot(te, 'day-list-390')
  await clickSel(te, 'button[aria-label="Таблицей по часам"]')
  await sleep(500)
  check('«Таблицей по часам» в углу — день лентой часов', (await layoutNow(te)) === 'cols' && !!(await te.$('ol[aria-label="Уроки дня"]')) && new URL(te.url()).searchParams.get('layout') === 'cols')
  await clickSel(te, 'button[aria-label="Списком"]')
  await sleep(500)
  check('«Списком» — снова строки', (await layoutNow(te)) === 'list' && !(await te.$('ol[aria-label="Уроки дня"]')))

  // ── 6. неделя целиком ───────────────────────────────────────────────────────────
  await go(te, '/schedule?view=week')
  const weekText = await text(te)
  check('неделя списком: все 7 дней', ['пн,', 'вт,', 'ср,', 'чт,', 'пт,', 'сб,', 'вс,'].every((d) => weekText.includes(d)))
  await shot(te, 'week-list-390')
  await go(te, '/schedule?view=week&layout=cols')
  check('неделя колонками: 7 шапок дней', await weekHeads(te))
  await shot(te, 'week-cols-390')
  await clickSel(te, 'button[aria-label$="Открыть день"]')
  check('шапка дня открывает день', new URL(te.url()).searchParams.get('view') === 'day')

  // ── 6б. пауза предупреждает, сколько уроков уйдёт (журнал п.65, 1) ─────────────
  const timurPlanned = async () => (await timurAhead()).length
  const before = await timurPlanned()
  await go(te, `/teacher?student=${timur.id}`)
  await te.evaluate(() => document.querySelector('[aria-label="Действия с учеником"]')?.click())
  await sleep(500)
  await click(te, 'На паузу')
  check('пауза: «Поставить на паузу?» и число уроков впереди', await waitText(te, new RegExp(`Поставить на паузу\\?[\\s\\S]*впереди ${before} урок`)), `уроков впереди: ${before}`)
  await shot(te, 'pause-warning-390')
  await click(te, 'Поставить на паузу')
  await waitText(te, /пауза/i)
  check('база: уроки ушли из расписания', (await timurPlanned()) === 0)
  await te.evaluate(() => document.querySelector('[aria-label="Действия с учеником"]')?.click())
  await sleep(500)
  await click(te, 'Снять с паузы')
  await sleep(1500)
  check('сняли с паузы — уроки серии вернулись', (await timurPlanned()) > 0)

  // ── 7. без тарифа: только просмотр ──────────────────────────────────────────────
  await sql(`update public.teacher_signups set created_at = now() - interval '25 days' where user_id = '${tId}'`)
  await sql(`update public.profiles set plan_expires_at = now() - interval '1 hour' where id = '${tId}'`)
  await sql(`select public.recompute_teacher_trial('${tId}')`)
  // после паузы и возврата уроки серии созданы заново — с новыми номерами
  const [fresh] = await timurAhead()
  await go(te, `/schedule?view=day&day=${dayOf(fresh.starts_at)}&lesson=${fresh.lesson_id}`)
  check('строка t9-3 «расписание только для просмотра»', await waitText(te, /расписание только для просмотра/))
  check('в шторке: «продли тариф», действия выключены', (await waitText(te, /продли тариф/)) && (await te.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent.includes('Перенести'))?.disabled)) === true)
  await shot(te, 'read-only-390')
  await admin.from('profiles').update({ plan_expires_at: new Date(Date.now() + 20 * 864e5).toISOString() }).eq('id', tId)

  // ── 8. компьютер 1280 ───────────────────────────────────────────────────────────
  const desk = await openAs(b, TEACHER, 1280)
  await go(desk, '/schedule')
  check('компьютер: по умолчанию неделя колонками', await desk.waitForSelector('[data-schedule-view="week"]', { timeout: 10000 }).then(() => true, () => false) && (await weekHeads(desk)))
  await shot(desk, 'week-1280')
  await go(desk, '/schedule?view=day')
  check('компьютер: день по умолчанию таблицей (лента часов), «Списком» рядом', !!(await desk.waitForSelector('ol[aria-label="Уроки дня"]', { timeout: 10000 }).catch(() => null)) && !!(await desk.$('button[aria-label="Списком"]')))
  await go(desk, '/schedule')
  await click(desk, 'Новый урок')
  const panel = await desk.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].pop()?.getBoundingClientRect()
    return d ? { left: d.left, width: d.width } : null
  })
  check('«Новый урок» — панелью справа', !!panel && panel.left > 600, JSON.stringify(panel))
  await shot(desk, 'new-lesson-panel-1280')
} catch (e) {
  check('смоук дошёл до конца', false, e instanceof Error ? e.message : String(e))
} finally {
  await b?.close().catch(() => {})
  for (const id of ids) await deleteTestUser(admin, sql, id).catch((e) => console.log(`  ⚠ ${e.message}`))
}

const passed = results.filter(Boolean).length
console.log(`\nИтог: ${passed}/${results.length}`)
process.exitCode = passed === results.length ? 0 : 1
