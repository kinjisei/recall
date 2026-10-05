/**
 * Путь нового репетитора — первые 15 минут (PLAN.md Ф2.11). Как у людей:
 *
 *   1. лендинг /teachers → «Начать» ведёт на /login?role=teacher, метка
 *      запомнена; регистрация формой → «Проверь почту»; почту подтверждаем
 *      через админку (вместо письма) → вход;
 *   2. онбординг репетитора — один экран: язык и «Как узнал», без вопросов
 *      ученика (находка 1); ES выбран → в студию, режим включён, язык ES;
 *   3. пустое расписание → «Добавить первого ученика» → карточка → первый урок;
 *   4. карточка → приглашение с кодом; ученик привязывается по коду;
 *   5. карточка ученика: «Ещё» называет все разделы (находка 5); «Тест уровня»
 *      открывается одной строкой, без второй раскрывашки (находка 2);
 *      «Программа»: «К форме» не выбрасывает составленную AI программу;
 *   6. «Материалы» (черновик мастера прежнего вида, без генераций AI):
 *      «К плану» и «К форме» не теряют готовое, «вперёд» без новой генерации
 *      (находка 3); после «Сохранить» и «назад» — список, а не снова
 *      «Сохранить»; «Энергия студии» — во «Заданиях», не над учениками (4);
 *   7. «Я преподаватель» на первом шаге онбординга без ссылки с лендинга;
 *   8. тот же репетитор на новом устройстве — экран репетитора, а не ученика.
 *
 * Запуск: npm run dev:test, затем node scripts/smoke-teacher-path.mjs
 *         [--shots <папка>] [--theme light] [--width 1280]
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const arg = (name, dflt) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : dflt)
const SHOTS = arg('--shots', null)
const THEME = arg('--theme', 'dark')
const WIDTH = Number(arg('--width', 390))

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'PathSmoke!2026'
const TEACHER = 'path-smoke-teacher@recall.test'
const FORK = 'path-smoke-fork@recall.test'
const STUDENT = 'path-smoke-student@recall.test'
const EMAILS = [TEACHER, FORK, STUDENT]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}

async function idOf(email) {
  const rows = await sql(`select id from auth.users where email = '${email}'`)
  return rows[0]?.id ?? null
}
async function makeUser(email, name) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-teacher-path' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true })
  if (error) throw new Error(`аккаунт ${email}: ${error.message}`)
  await admin.from('profiles').update({ display_name: name }).eq('id', data.user.id)
  return data.user.id
}
async function newPage(b) {
  const ctx = await b.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport(WIDTH < 600 ? { width: WIDTH, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: WIDTH, height: 860 })
  await page.evaluateOnNewDocument((th) => {
    try {
      localStorage.setItem('recall.theme', th)
    } catch {
      /* about:blank */
    }
  }, THEME)
  return page
}
async function signIn(page, email) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
}
const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout }, re.source).then(() => true, () => false)
const waitPath = (page, path, timeout = 30000) =>
  page.waitForFunction((p) => location.pathname === p, { polling: 250, timeout }, path).then(() => true, () => false)
/** Кнопка экрана (не вкладка меню) по тексту или подписи aria-label; последняя в DOM — верхняя шторка. */
async function click(page, label, timeout = 15000) {
  const ok = await page
    .waitForFunction((l) => [...document.querySelectorAll('button, a')].some((x) => !x.closest('.vt-nav') && !x.disabled && (x.textContent.trim().includes(l) || x.getAttribute('aria-label') === l)), { polling: 250, timeout }, label)
    .then(() => true, () => false)
  if (ok) await page.evaluate((l) => [...document.querySelectorAll('button, a')].reverse().find((x) => !x.closest('.vt-nav') && !x.disabled && (x.textContent.trim().includes(l) || x.getAttribute('aria-label') === l))?.click(), label)
  await sleep(600)
  return ok
}
/**
 * Регистрация без письма. У тестовой базы встроенная почта Supabase: 2 письма
 * в час, и на адрес .test письмо всё равно не дойдёт. Запрос формы
 * перехватываем: аккаунт заводит админка — неподтверждённым, как настоящая
 * регистрация, — а форма получает тот же ответ, что от сервера.
 */
async function signupWithoutMail(page) {
  const origin = new URL(APP_URL).origin
  await page.setRequestInterception(true)
  page.on('request', async (r) => {
    if (!r.url().includes('/auth/v1/signup')) return r.continue()
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': r.headers()['access-control-request-headers'] ?? 'apikey, authorization, content-type, x-client-info, x-supabase-api-version',
    }
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors })
    const body = JSON.parse(r.postData() ?? '{}')
    const { data, error } = await admin.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: false, user_metadata: body.data ?? {} })
    const json = { ...cors, 'content-type': 'application/json' }
    if (error) return r.respond({ status: 400, headers: json, body: JSON.stringify({ code: 400, msg: error.message }) })
    return r.respond({ status: 200, headers: json, body: JSON.stringify(data.user) })
  })
}
async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/${name}-${WIDTH}-${THEME}.png`, fullPage: true })
}
/** Колесо времени: Home и стрелки вниз до нужного числа (как в smoke-schedule). */
async function setTime(page, hh) {
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button[aria-expanded]')].find((x) => x.textContent.includes('Время'))?.click())
  await page.waitForSelector('[role="spinbutton"][aria-label="Часы"]', { timeout: 5000 })
  for (const [label, n] of [['Часы', hh], ['Минуты', 0]]) {
    await page.focus(`[role="spinbutton"][aria-label="${label}"]`)
    await page.keyboard.press('Home')
    for (let i = 0; i < n; i++) await page.keyboard.press('ArrowDown')
    await sleep(300)
  }
}
async function putDraft(page, owner, scope, value) {
  await page.evaluate((k, v) => localStorage.setItem(k, JSON.stringify({ v, at: Date.now() })), `recall.draft.${owner}.${scope}`, value)
}

const ids = []
let b = null
try {
  for (const e of EMAILS) {
    const old = await idOf(e)
    if (old) await deleteTestUser(admin, sql, old)
  }
  await admin.from('allowed_emails').upsert({ email: TEACHER, note: 'smoke-teacher-path' })

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('teacher-path')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }

  // ── 1. лендинг → регистрация → почта → вход ────────────────────────────────────
  const te = await newPage(b)
  await signupWithoutMail(te)
  await go(te, '/teachers')
  await shot(te, '01-landing')
  await te.evaluate(() => [...document.querySelectorAll('a')].find((a) => (a.getAttribute('href') ?? '').startsWith('/login?role=teacher'))?.click())
  check('кнопка лендинга → /login?role=teacher', await waitPath(te, '/login') && (await te.evaluate(() => location.search)).includes('role=teacher'))
  check('метка «репетитор» запомнена', (await te.evaluate(() => localStorage.getItem('recall.pending_role'))) === 'teacher')
  await te.type('input[placeholder="Аня"]', 'Мадина')
  await te.type('input[placeholder="Иванова"]', 'Смоук')
  await te.type('#f-email', TEACHER)
  await te.type('#f-password', PASS)
  check('регистрация говорит с репетитором: «можно вести учеников»', /можно вести учеников/.test(await text(te)))
  await shot(te, '02-signup')
  await te.click('button[type="submit"]')
  check('регистрация → «Проверь почту»', await waitText(te, /Проверь почту/))
  const tId = await idOf(TEACHER)
  if (!tId) throw new Error('аккаунт репетитора не создан')
  ids.push(tId)
  await admin.auth.admin.updateUserById(tId, { email_confirm: true })
  await go(te, '/login')
  await signIn(te, TEACHER)

  // ── 2. онбординг репетитора ──────────────────────────────────────────────────────
  check('после входа — онбординг', await waitPath(te, '/onboarding'))
  check('экран репетитора: «Какой язык преподаёшь?»', await waitText(te, /Какой язык преподаёшь\?/))
  let txt = await text(te)
  check('вопросов ученика нет (язык учёбы, уровень, план)', !/Что будем учить|Определим уровень|С чего начнём|Зачем тебе язык/.test(txt), txt.slice(0, 200))
  check('«Назад» нет — путь выбран ссылкой с лендинга', !/^Назад$/m.test(txt))
  await click(te, 'Испанский')
  check('ES выбран', await te.evaluate(() => [...document.querySelectorAll('[role="radio"]')].find((x) => x.textContent.includes('Испанский'))?.getAttribute('aria-checked') === 'true'))
  await click(te, 'От коллеги')
  await shot(te, '03-onboarding-teacher')
  await click(te, 'В студию')
  check('«В студию» → расписание', await waitPath(te, '/schedule'))
  check('язык студии — ES', (await te.evaluate(() => localStorage.getItem('recall.lang'))) === 'es')
  const { data: prof } = await admin.from('profiles').select('role').eq('id', tId).single()
  check('режим репетитора включён', prof?.role === 'teacher', JSON.stringify(prof))

  // ── 3. пустое расписание → первый ученик → первый урок ─────────────────────────
  check('пустое расписание ведёт к первому ученику', await waitText(te, /Пока нет уроков/) && /Добавить первого ученика/.test(await text(te)))
  await shot(te, '04-schedule-empty')
  await click(te, 'Добавить первого ученика')
  await te.waitForSelector('input[placeholder="Имя и фамилия"]', { timeout: 10000 })
  await te.type('input[placeholder="Имя и фамилия"]', 'Тимур Ким')
  await te.type('input[placeholder^="+7 700"]', '+7 701 123 45 67')
  await click(te, 'Занимается')
  await click(te, 'Добавить')
  check('после карточки — сразу шторка урока с ней', await waitText(te, /Новый урок[\s\S]*Тимур Ким/))
  await te.evaluate(() => document.querySelector('[role="dialog"] [role="switch"]')?.click())
  await sleep(300)
  await setTime(te, 10)
  await shot(te, '05-first-lesson')
  await click(te, 'Создать урок')
  check('первый урок создан', await waitText(te, /Уроки созданы|Урок создан/))
  await shot(te, '06-schedule-lesson')

  // ── 4. приглашение ─────────────────────────────────────────────────────────────
  const [card] = await sql(`select id from public.student_cards where teacher_id = '${tId}'`)
  await go(te, `/teacher?student=${card.id}`)
  check('карточка: приглашение с кодом', await te.waitForSelector('[data-invite-code]', { visible: true, timeout: 15000 }).then(() => true, () => false))
  // код заводится при первом показе приглашения — берём тот, что видит учитель
  const code = await te.$eval('[data-invite-code]', (el) => el.getAttribute('data-invite-code'))
  if (WIDTH < 1024) {
    const head = await text(te)
    check('карточка на телефоне — только «‹ Ученики», без шапки страницы (t6-2)', !/Обновить|Как это работает/.test(head), head.slice(0, 120))
  }
  await shot(te, '07-card-invite')
  const sId = await makeUser(STUDENT, 'Тимур Ким')
  ids.push(sId)
  const sc = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  await sc.auth.signInWithPassword({ email: STUDENT, password: PASS })
  const join = await sc.rpc('join_teacher', { code })
  check('ученик привязался по коду из приглашения', !join.error, join.error?.message)

  // ── 5. карточка ученика: «Ещё», тест уровня, программа ─────────────────────────
  // черновик — испанской программы: язык по умолчанию — выбранный в онбординге (ES)
  await putDraft(te, tId, `program:${sId}:es`, {
    level: 'B1', weeks: 4, goal: '', feedback: '',
    preview: { summary: 'Программа от AI: смоук', weeks: [{ title: 'Неделя 1', focus: 'Present Simple', items: [{ type: 'custom', title: 'Пункт смоука', note: 'пояснение' }] }] },
  })
  await go(te, `/teacher?student=${card.id}`)
  const more = 'Ещё: тест уровня, диагностика, план дня, программа, слова, квесты'
  check('«Ещё» называет все 6 разделов', await waitText(te, new RegExp(more)), (await text(te)).match(/Ещё:[^\n]*/)?.[0])
  await click(te, 'Ещё:')
  await click(te, 'Тест уровня')
  check('тест уровня открылся сразу: «Назначить · Английский»', await waitText(te, /Назначить · Английский/, 8000))
  const toggles = await te.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.textContent.trim().startsWith('Тест уровня')).length)
  check('одна строка «Тест уровня», второй раскрывашки нет', toggles === 1, `строк: ${toggles}`)
  await shot(te, '08-placement')
  await click(te, 'Программа обучения')
  check('программа: составленная AI видна', await waitText(te, /Программа от AI: смоук/))
  await click(te, 'К форме')
  check('«К форме» → форма и «Вернуться к программе»', await waitText(te, /Вернуться к программе/) && !/Программа от AI: смоук/.test(await text(te)))
  await shot(te, '09-program-form')
  await click(te, 'Вернуться к программе')
  check('…программа на месте, без новой генерации', await waitText(te, /Программа от AI: смоук/))

  // ── 6. материалы: «назад» без потерь ──────────────────────────────────────────
  const req = { lang: 'es', level: 'A2', topic: 'Поход в горы', format: 'рассказ', lengthRange: '100-250', vocabulary: '', grammar: '', studentId: null }
  const plan = { comments: 'План смоука: текст про горы', vocabulary: ['montaña'], grammar_focus: '', exercise_plan: [{ kind: 'comprehension', count: 1, note: 'вопрос' }] }
  const content = { title: 'Texto de humo', body: 'Fuimos a la montaña el sábado.', exercises: [{ kind: 'comprehension', type: 'mcq', prompt: '¿Adónde fuimos?', options: ['a la montaña', 'al mar'], answer: 0 }] }
  await putDraft(te, tId, 'material-flow', { name: 'preview', req, plan, content }) // вид до Ф2.11
  await go(te, '/tasks?tab=materials')
  check('черновик прежнего вида: предпросмотр', await waitText(te, /Texto de humo/))
  const backs = () => te.evaluate(() => [...document.querySelectorAll('button[aria-label]')].map((x) => x.getAttribute('aria-label')).filter((l) => ['Задания', 'К форме', 'К плану', 'К материалам'].includes(l)).join(','))
  check('предпросмотр: одна шапка «назад» — своя', (await backs()) === 'К плану', await backs())
  await click(te, 'К плану')
  check('«К плану» → план и «Вернуться к готовому тексту»', await waitText(te, /План смоука[\s\S]*Вернуться к готовому тексту/))
  check('…генерация — «Новый текст», а не «Генерировать ✓»', /Новый текст/.test(await text(te)) && !/Генерировать ✓/.test(await text(te)))
  check('…одна шапка «назад» — «К форме»', (await backs()) === 'К форме', await backs())
  await shot(te, '10-material-plan-back')
  await click(te, 'Вернуться к готовому тексту')
  check('…тот же текст, без новой генерации', await waitText(te, /Texto de humo/))
  await click(te, 'К плану')
  await click(te, 'К форме')
  check('«К форме» → форма и «Вернуться к плану»', await waitText(te, /Новый материал[\s\S]*Вернуться к плану/))
  check('…главная кнопка — «Новый план»', /Новый план →/.test(await text(te)))
  check('…у формы шапка раздела «Задания»', (await backs()) === 'Задания', await backs())
  const esChip = await te.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Испанский')?.className.includes('bg-accent-soft'))
  check('…язык материала по умолчанию — испанский, как в онбординге', esChip)
  await shot(te, '11-material-form-back')
  await click(te, 'Вернуться к плану')
  await click(te, 'Вернуться к готовому тексту')
  check('вперёд дважды — тот же текст', await waitText(te, /Texto de humo/))
  await click(te, 'Сохранить')
  const opened = await te.waitForFunction(() => location.search.includes('mat='), { polling: 250, timeout: 15000 }).then(() => true, () => false)
  check('«Сохранить» → материал открыт', opened && (await waitText(te, /Texto de humo/)))
  await sleep(1500)
  await te.goBack({ waitUntil: 'networkidle2' })
  await sleep(800)
  txt = await text(te)
  check('«назад» из материала — список, а не снова «Сохранить»', /Создать материал/.test(txt) && !/Предпросмотр/.test(txt), txt.slice(0, 160))
  const [{ n }] = await sql(`select count(*)::int as n from public.materials where teacher_id = '${tId}'`)
  check('материал один, дубля нет', n === 1, `материалов: ${n}`)
  await go(te, '/tasks')
  check('«Энергия студии» — во «Заданиях»', await waitText(te, /[Ээ]нерги/))
  await go(te, '/teacher')
  await waitText(te, /Тимур Ким/)
  check('…а над учениками её нет', !/Энергия студии/.test(await text(te)))

  // ── 7. «Я преподаватель» на первом шаге ────────────────────────────────────────
  const fId = await makeUser(FORK, 'Бота Смоук')
  ids.push(fId)
  const fk = await newPage(b)
  await go(fk, '/login')
  await signIn(fk, FORK)
  check('без ссылки с лендинга — онбординг ученика', (await waitPath(fk, '/onboarding')) && (await waitText(fk, /Что будем учить\?/)))
  await shot(fk, '12-onboarding-student-step1')
  await click(fk, 'Я преподаватель')
  check('«Я преподаватель» → экран репетитора с «Назад»', await waitText(fk, /Какой язык преподаёшь\?[\s\S]*Назад/))
  await click(fk, 'Назад')
  check('«Назад» → снова «Что будем учить?»', await waitText(fk, /Что будем учить\?/))
  await click(fk, 'Я преподаватель')
  await click(fk, 'В студию')
  check('→ расписание', await waitPath(fk, '/schedule'))
  const { data: fprof } = await admin.from('profiles').select('role').eq('id', fId).single()
  check('режим включён кнопкой онбординга', fprof?.role === 'teacher', JSON.stringify(fprof))

  // ── 8. тот же репетитор на новом устройстве ───────────────────────────────────
  const nd = await newPage(b)
  await go(nd, '/login')
  await signIn(nd, TEACHER)
  // онбординг на новом устройстве — только если своих занятий нет; с ними — сразу расписание
  await nd.waitForFunction(() => ['/onboarding', '/schedule'].includes(location.pathname), { polling: 250, timeout: 30000 }).catch(() => {})
  const where = await nd.evaluate(() => location.pathname)
  const teacherScreen = where === '/schedule' || (await waitText(nd, /Какой язык преподаёшь\?/))
  check('новое устройство: не вопросы ученика', teacherScreen && !/Что будем учить/.test(await text(nd)), where)
} catch (e) {
  check('смоук дошёл до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
} finally {
  await b?.close().catch(() => {})
  for (const id of ids) await deleteTestUser(admin, sql, id)
  await admin.from('allowed_emails').delete().in('email', EMAILS)
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
