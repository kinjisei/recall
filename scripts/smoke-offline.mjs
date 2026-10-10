/**
 * Смоук «нет связи с базой» (PLAN.md Ф1.13; начало — ревью 1Г, «Учёба»).
 *
 * Зачем. Без связи экраны молчали или врали: Главная — «Серия дней подряд 0»,
 * «Прогресс» — «0 дней», «Квесты» — «Квестов пока нет», «Диалог» — пустой чат
 * вместо прошлой переписки, «Настройки» — пустая форма профиля (сохрани её —
 * и настоящий уровень затёрт), студия — учителю «Включи режим преподавателя»,
 * а после ночи без сети — форма регистрации вместо приложения. Человек не
 * понимал, что случилось, и решал, что данные пропали.
 *
 * Метод: блокируем ТОЛЬКО запросы к supabase.co — само приложение работает,
 * как при потере связи у пользователя (замер Ф1.13: при полностью выключенной
 * сети экраны ведут себя так же). На каждом экране:
 *   • онлайн плашки нет — контроль, без него проверка ничего не значила бы;
 *   • без связи — слова о связи и кнопка «Повторить», серых заглушек нет;
 *   • нет той выдумки, которая была у экрана до Ф1.13.
 *
 * Запуск: node scripts/smoke-offline.mjs (нужен `npm run dev:test` — 5174,
 * тестовая база; два временных аккаунта заводятся и удаляются).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'Offline!2026'
const STUDENT = 'offline-check@recall.test'
const TEACHER = 'offline-teacher@recall.test'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CONN = /пропала связь|нет связи|интернет|соединени/i

/** Экраны ученика и выдумка, которой у каждого больше быть не должно. */
const SCREENS = [
  { path: '/', lie: /Серия дней подряд/, lieName: 'серии «0»' },
  { path: '/study' },
  { path: '/progress', lie: /\b0 (день|дня|дней)\b/, lieName: '«0 дней»' },
  { path: '/quests', lie: /Квестов пока нет/, lieName: '«Квестов пока нет»' },
  { path: '/settings', lie: /Как тебя зовут/, lieName: 'пустой формы профиля' },
  { path: '/conversation', lie: /Напиши что-нибудь/, lieName: 'пустого чата' },
  { path: '/writing' },
  { path: '/assignments' },
  { path: '/program' },
]

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}

async function makeUser(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'offline-check' })
  const { data: cu } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true })
  let id = cu?.user?.id
  if (!id) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = l.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
    await admin.auth.admin.updateUserById(id, { password: PASS })
  }
  if (role) await admin.from('profiles').update({ role }).eq('id', id)
  // хоть один день занятий — чтобы онлайн Главная показывала серию (контроль)
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  return id
}

/** Отдельное окно (своё хранилище) с входом и выключателем связи с базой. */
async function openAs(b, email) {
  const ctx = await b.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 390, height: 844 })
  const net = { blocked: false }
  await page.setRequestInterception(true)
  page.on('request', (r) => (net.blocked && r.url().includes('supabase.co') ? r.abort() : r.continue()))
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  await sleep(2000)
  return { page, net }
}

const probe = (page) =>
  page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    return {
      text: document.body.innerText,
      pulses: [...document.querySelectorAll('.animate-pulse')].filter(vis).length,
      retry: [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Повторить'),
    }
  })

/** Переход внутри приложения, без перезагрузки — как нажать ссылку. */
const spa = (page, path) =>
  page.evaluate((p) => {
    history.pushState({}, '', p)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)

/** Открыть экран и дождаться плашки о связи (до 20 с: повторы клиента + предел 12 с). */
async function visit(page, path, wantPlaque) {
  await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded' })
  const until = Date.now() + (wantPlaque ? 20000 : 8000)
  let p = await probe(page)
  while (Date.now() < until && (wantPlaque ? !(p.retry && CONN.test(p.text)) : p.pulses > 0)) {
    await sleep(500)
    p = await probe(page)
  }
  await sleep(800) // дать дорисоваться тому, что пришло вместе с плашкой
  return probe(page)
}

const PORT = 9400 + Math.floor(Math.random() * 500)
let b = null
const ids = []
try {
  ids.push(await makeUser(STUDENT), await makeUser(TEACHER, 'teacher'))
  await admin.from('teacher_students').insert({ teacher_id: ids[1], student_id: ids[0], seat: true })
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
    `--user-data-dir=${profileDir('off')}`, 'about:blank'],
    { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }

  // --- ученик ----------------------------------------------------------------------
  const student = await openAs(b, STUDENT)
  for (const s of SCREENS) {
    student.net.blocked = false
    const on = await visit(student.page, s.path, false)
    const plaqueOnline = on.retry || /пропала связь|не загрузил/i.test(on.text)
    student.net.blocked = true
    const off = await visit(student.page, s.path, true)
    const lies = s.lie ? s.lie.test(off.text) : false
    const ok = !plaqueOnline && CONN.test(off.text) && off.retry && off.pulses === 0 && !lies
    check(
      `${s.path}: онлайн без плашки; без связи — о связи, «Повторить», без заглушек${s.lie ? `, без ${s.lieName}` : ''}`,
      ok,
      [plaqueOnline && 'онлайн плашка', !CONN.test(off.text) && 'нет слов о связи', !off.retry && 'нет «Повторить»',
        off.pulses > 0 && `заглушек: ${off.pulses}`, lies && `видно ${s.lieName}`].filter(Boolean).join('; ') +
        ` | «${off.text.replace(/\s+/g, ' ').slice(0, 120)}»`,
    )
  }

  // --- студия учителя ------------------------------------------------------------------
  const teacher = await openAs(b, TEACHER)
  const tOn = await visit(teacher.page, '/teacher', false)
  // Связь пропала посреди работы: студия открыта, учитель открывает карточку
  // ученика. Раньше блок домашки писал «Домашки нет» с кнопкой «Собрать» —
  // и учитель собрал бы новую поверх существующей.
  const card = `/teacher?student=${ids[0]}`
  const hwShown = () => /Пока не задана|Домашка на неделю|Не удалось прочитать домашку/.test(document.body.innerText)
  await spa(teacher.page, card)
  const cardOn = await teacher.page.waitForFunction(hwShown, { polling: 250, timeout: 20000 }).then(() => true, () => false)
  check('карточка ученика онлайн: блок домашки на месте (контроль)', cardOn && /Пока не задана/.test((await probe(teacher.page)).text))
  await spa(teacher.page, '/teacher')
  await sleep(1000)
  teacher.net.blocked = true
  await spa(teacher.page, card)
  await teacher.page.waitForFunction(hwShown, { polling: 250, timeout: 25000 }).catch(() => {})
  await sleep(1500)
  const cardOff = await probe(teacher.page)
  check(
    'карточка без связи: домашка — «Повторить», а не «Пока не задана» с «Собрать»',
    /Не удалось прочитать домашку/.test(cardOff.text) && cardOff.retry && !/Пока не задана/.test(cardOff.text),
    cardOff.text.replace(/s+/g, ' ').slice(0, 160),
  )
  const tOff = await visit(teacher.page, '/teacher', true)
  check('студия: онлайн открывается у учителя (контроль)', !/Включи режим преподавателя/.test(tOn.text), tOn.text.slice(0, 120))
  check(
    'студия без связи: о связи и «Повторить», а не «Включи режим преподавателя»',
    CONN.test(tOff.text) && tOff.retry && !/Включи режим преподавателя/.test(tOff.text),
    tOff.text.replace(/\s+/g, ' ').slice(0, 120),
  )

  // --- истёкший вход без сети (утро после ночи без интернета) ----------------------------
  student.net.blocked = false
  await student.page.goto(`${APP_URL}/`, { waitUntil: 'networkidle2' })
  await student.page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('sb-') || !k.endsWith('-auth-token')) continue
      const s = JSON.parse(localStorage.getItem(k))
      s.expires_at = Math.floor(Date.now() / 1000) - 60
      localStorage.setItem(k, JSON.stringify(s))
    }
  })
  student.net.blocked = true
  await student.page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded' })
  await sleep(9000)
  const slow = await probe(student.page)
  check('истёкший вход: пока проверяем — подсказка про плохую связь', /плохая связь/.test(slow.text), slow.text.slice(0, 100))
  const gate = await student.page
    .waitForFunction(() => /не получилось проверить вход/.test(document.body.innerText), { polling: 500, timeout: 60000 })
    .then(() => true, () => false)
  const where = await student.page.evaluate(() => location.pathname)
  const g = await probe(student.page)
  check('истёкший вход без сети: «нет связи» и «Повторить», а не форма входа', gate && where !== '/login' && g.retry, `${where} | ${g.text.slice(0, 100)}`)
  // связь вернулась — клиент сам обновляет вход, приложение открывается без нажатий
  student.net.blocked = false
  const back = await student.page
    .waitForFunction(() => document.body.innerText.includes('Начать занятие'), { polling: 500, timeout: 75000 })
    .then(() => true, () => false)
  check('связь вернулась: приложение открылось само, вход на месте', back, (await probe(student.page)).text.slice(0, 100))
} finally {
  await b?.close().catch(() => {})
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [STUDENT, TEACHER])
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
