/**
 * Смоук черновиков (PLAN.md Ф1.14): набрал → перезагрузил → текст на месте.
 *
 * Зачем. Новая версия PWA включается сразу и перезагружает страницу (журнал
 * п.58), а ни один экран не хранил набранное: сочинение, ответы домашки,
 * отчёт родителям пропадали. Здесь — каждое такое место: ученик (сочинение,
 * быстрая проверка, ответы домашки, свой текст, «Диалог», квест, отзыв) и
 * учитель (сборка домашки, отчёт, программа, заявка на материал, правки к
 * плану и к тексту, разбор работы, письменное задание, разбор сочинения).
 * Плюс: после отправки черновика нет; «Очистить» стирает; после выхода из
 * аккаунта черновиков на устройстве нет.
 *
 * Данные — сразу в базе (готовые разборы AI, квест с первой репликой):
 * смоук не тратит ни генераций, ни энергии.
 *
 * Запуск: node scripts/smoke-drafts.mjs (нужен `npm run dev:test` — 5174,
 * тестовая база; аккаунты заводятся и удаляются).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'Drafts!2026'
const TEACHER = 'drafts-teacher@recall.test'
const STUDENT = 'drafts-student@recall.test'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const NOTE = 'Черновик восстановлен'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}

// --- данные ---------------------------------------------------------------------------
async function makeUser(email, name, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'drafts' })
  const { data: cu } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true })
  let id = cu?.user?.id
  if (!id) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = l.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
    await admin.auth.admin.updateUserById(id, { password: PASS })
  }
  await admin.from('profiles').update({ display_name: name, ...(role ? { role } : {}) }).eq('id', id)
  return id
}
const must = (label, r) => {
  if (r.error) throw new Error(`${label}: ${r.error.message}`)
  return r.data
}

async function seed(t, s) {
  must('привязка', await admin.from('teacher_students').upsert({ teacher_id: t, student_id: s, seat: true }, { onConflict: 'teacher_id,student_id' }))
  const taskA = must('письмо A', await admin.from('writing_tasks').insert({
    teacher_id: t, lang: 'en', mode: 'ielts', level: 'B2', prompt: 'Drafts essay A: describe your town.', settings: { ieltsTask: 'task2', targetBand: 6.5 },
  }).select('id').single())
  const waA = must('назначение A', await admin.from('writing_task_assignments').insert({ task_id: taskA.id, student_id: s }).select('id').single())
  const taskB = must('письмо B', await admin.from('writing_tasks').insert({
    teacher_id: t, lang: 'en', mode: 'ielts', level: 'B2', prompt: 'Drafts essay B: your best trip.', settings: { ieltsTask: 'task2', targetBand: 6.5 },
  }).select('id').single())
  must('сданное B', await admin.from('writing_task_assignments').insert({
    task_id: taskB.id, student_id: s, status: 'submitted', submitted_at: new Date().toISOString(),
    essay: 'Last year I go to the sea with my family. It was great.',
    ai_review: { band: 6, errors: [{ was: 'I go', fix: 'I went', type: 'grammar' }], strengths: ['clear'] },
  }))
  const mat = (title, exercises) => ({
    teacher_id: t, lang: 'en', level: 'A2', topic: title, format: 'рассказ', length_range: '50-100',
    title, body: 'I get up at seven. I go home every day after work.', exercises,
  })
  const m1 = must('материал 1', await admin.from('materials').insert(mat('Drafts morning', [
    { kind: 'comprehension', type: 'mcq', prompt: 'When does he get up?', options: ['at six', 'at seven'], answer: 1 },
    { kind: 'grammar', type: 'fill', prompt: 'I ___ up at seven.', answer: 'get' },
  ])).select('id').single())
  const ma1 = must('задание 1', await admin.from('material_assignments').insert({ material_id: m1.id, student_id: s }).select('id').single())
  const m2 = must('материал 2', await admin.from('materials').insert(mat('Drafts review', [
    { kind: 'comprehension', type: 'mcq', prompt: 'When does he get up?', options: ['at six', 'at seven'], answer: 1 },
  ])).select('id').single())
  must('сданное 2', await admin.from('material_assignments').insert({
    material_id: m2.id, student_id: s, status: 'submitted', submitted_at: new Date().toISOString(),
    answers: [{ index: 0, given: 'at six', auto_ok: false }], auto_score: 0, auto_total: 1,
    ai_review: [{ index: 0, ok: false, comment: 'Правильно: at seven' }],
  }))
  const q = must('квест', await admin.from('grammar_quests').insert({
    teacher_id: t, student_id: s, lang: 'en', level: 'A2', topic: 'Past Simple', scenario: 'A trip to the market',
    messages: [{ role: 'assistant', content: 'Hi! Where did you go yesterday?' }],
  }).select('id').single())
  return { waA: waA.id, ma1: ma1.id, quest: q.id }
}

// --- браузер ----------------------------------------------------------------------------
async function openAs(b, email) {
  const ctx = await b.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 390, height: 844 })
  await login(page, email)
  return page
}
async function login(page, email) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  await sleep(1500)
}
const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
const has = (page, sel) => page.$(sel).then((h) => h !== null)
const waitSel = (page, sel, timeout = 15000) =>
  page.waitForSelector(sel, { visible: true, timeout }).then(() => true, () => false)
const text = (page) => page.evaluate(() => document.body.innerText)
/** Нажать кнопку по видимому тексту (начало совпадает). */
async function click(page, label, timeout = 15000) {
  const ok = await page.waitForFunction(
    (l) => [...document.querySelectorAll('button, a')].some((x) => x.textContent.trim().includes(l)),
    { polling: 250, timeout }, label,
  ).then(() => true, () => false)
  if (!ok) return false
  await page.evaluate((l) => [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim().includes(l))?.click(), label)
  await sleep(500)
  return true
}
/** Ввести текст в поле так, как это делает человек (события input у React). */
async function typeInto(page, sel, value) {
  // всё прежнее содержимое (в разборе там уже комментарий AI) — прочь
  await page.focus(sel)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(sel, value)
  await sleep(600) // черновик пишется после отрисовки
}
const valueOf = (page, sel) => page.$eval(sel, (el) => el.value).catch(() => null)

/**
 * Одно место: открыть → набрать → перезагрузить → открыть снова → текст на
 * месте и строка «Черновик восстановлен». open — путь к полю (адрес и клики).
 */
async function draftCase(page, name, { open, field, value }) {
  await open()
  if (!(await waitSel(page, field))) return check(`${name}: поле на месте`, false, (await text(page)).slice(0, 120))
  await typeInto(page, field, value)
  await page.reload({ waitUntil: 'networkidle2' })
  await open()
  await waitSel(page, field)
  const got = await valueOf(page, field)
  const note = (await text(page)).includes(NOTE)
  check(`${name}: набрал → перезагрузил → текст на месте`, got === value && note, `в поле «${got}», строка: ${note}`)
}

const PORT = 9400 + Math.floor(Math.random() * 500)
let b = null
const ids = []
try {
  const tId = await makeUser(TEACHER, 'Учитель Черновиков', 'teacher')
  const sId = await makeUser(STUDENT, 'Ученица Черновик')
  ids.push(tId, sId)
  const d = await seed(tId, sId)

  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
    `--user-data-dir=${profileDir('drafts')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }

  // --- ученик ---------------------------------------------------------------------------
  const st = await openAs(b, STUDENT)
  await draftCase(st, 'сочинение', { open: () => go(st, `/writing?w=${d.waA}`), field: 'textarea[placeholder^="Пиши на"]', value: 'My town is small and green.' })
  await draftCase(st, 'быстрая проверка', { open: () => go(st, '/writing?quick=1'), field: 'textarea[placeholder^="Yesterday"]', value: 'I goed to school.' })
  await draftCase(st, 'свой текст для чтения', { open: () => go(st, '/study?view=reader&mine=add'), field: 'textarea[aria-label="Текст"]', value: 'A short text about cats.' })
  await draftCase(st, '«Диалог»', { open: () => go(st, '/conversation'), field: 'input[aria-label="Сообщение по-английски"]', value: 'I like football' })
  await draftCase(st, 'квест', { open: () => go(st, `/quests?q=${d.quest}`), field: 'input[aria-label="Ответ по-английски"]', value: 'I went to the market' })
  await draftCase(st, 'отзыв о приложении', {
    open: async () => {
      await go(st, '/settings')
      await click(st, 'Оставить отзыв')
    },
    field: '#fb-text',
    value: 'Хочу тёмную тему в отчёте',
  })
  // после отправки черновика нет
  await click(st, 'Отправить')
  await st.waitForFunction(() => !document.querySelector('#fb-text'), { polling: 250, timeout: 10000 }).catch(() => {})
  await st.reload({ waitUntil: 'networkidle2' })
  await click(st, 'Оставить отзыв')
  await waitSel(st, '#fb-text')
  check('отзыв отправлен — черновика нет', (await valueOf(st, '#fb-text')) === '' && !(await text(st)).includes(NOTE))

  // ответы домашки: ответил на первое — после перезагрузки ответ на месте
  await go(st, `/assignments?a=${d.ma1}&stage=exercises`)
  await click(st, 'at seven')
  await st.reload({ waitUntil: 'networkidle2' })
  await st.waitForFunction(() => document.body.innerText.includes('верно:'), { polling: 250, timeout: 15000 }).catch(() => {})
  const ans = await text(st)
  check('ответы домашки: ответил → перезагрузил → ответ на месте', /верно:\s*1/.test(ans) && ans.includes(NOTE), ans.slice(0, 160))
  // «Очистить» — задание с чистого листа, и это переживает перезагрузку
  await click(st, 'Очистить')
  await st.reload({ waitUntil: 'networkidle2' })
  await st.waitForFunction(() => document.body.innerText.includes('верно:'), { polling: 250, timeout: 15000 }).catch(() => {})
  const cleared = await text(st)
  check('«Очистить» стирает черновик', /верно:\s*0/.test(cleared) && !cleared.includes(NOTE), cleared.slice(0, 160))

  // выход из аккаунта стирает черновики с устройства (общий телефон)
  await go(st, '/conversation')
  await waitSel(st, 'input[aria-label="Сообщение по-английски"]')
  await go(st, '/progress')
  await click(st, 'Выйти из аккаунта')
  await st.waitForFunction(() => location.pathname === '/login', { polling: 250, timeout: 15000 }).catch(() => {})
  const left = await st.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('recall.draft.')).length)
  check('выход из аккаунта: черновиков на устройстве нет', left === 0, `осталось ${left}`)
  await login(st, STUDENT)
  await go(st, '/conversation')
  await waitSel(st, 'input[aria-label="Сообщение по-английски"]')
  check('снова вошёл: поле «Диалога» пустое', (await valueOf(st, 'input[aria-label="Сообщение по-английски"]')) === '')

  // --- учитель --------------------------------------------------------------------------
  const te = await openAs(b, TEACHER)
  await draftCase(te, 'сборка домашки', {
    open: async () => {
      await go(te, `/teacher?student=${sId}`)
      // карточка ученика на холодном dev-сервере собирается дольше 15 с
      await te.waitForFunction(() => /Собрать домашку|Продолжить сборку/.test(document.body.innerText), { polling: 250, timeout: 45000 }).catch(() => {})
      if (!(await click(te, 'Продолжить сборку', 1000))) await click(te, 'Собрать домашку')
    },
    field: '#hw-note',
    value: 'Сначала слова, потом текст',
  })
  await go(te, `/teacher?student=${sId}`)
  check('сборка домашки: кнопка зовёт продолжить', await click(te, 'Продолжить сборку', 8000))
  await draftCase(te, 'отчёт родителям', {
    // отчёт — своя плитка карточки (Ф2.11б-2): ?sec=report открывает лист сразу
    open: () => go(te, `/teacher?student=${sId}&sec=report`),
    field: 'textarea[placeholder^="Пара живых фраз"]',
    value: 'Стала увереннее говорить',
  })
  await draftCase(te, 'программа (цель)', {
    open: () => go(te, `/teacher?student=${sId}&sec=program`),
    field: 'textarea[placeholder^="Например: подготовка к поездке"]',
    value: 'Поездка в Лондон летом',
  })
  await draftCase(te, 'заявка на материал', {
    open: async () => {
      await go(te, '/teacher?tab=materials')
      if (!(await has(te, 'input[placeholder^="Например: Путешествие"]'))) await click(te, '+ Создать материал')
    },
    field: 'input[placeholder^="Например: Путешествие"]',
    value: 'Поход в горы',
  })
  // правки к плану и к тексту — поток материала подкладываем черновиком (без генерации AI)
  const req = { lang: 'en', level: 'A2', topic: 'Поход', format: 'рассказ', lengthRange: '50-100', vocabulary: '', grammar: '', studentId: null }
  const plan = { comments: 'План', vocabulary: ['tent'], grammar_focus: null, exercise_plan: [{ kind: 'vocabulary', type: 'mcq', count: 1, note: '' }] }
  const content = { title: 'Camping', body: 'We sleep in a tent.', exercises: [{ kind: 'vocabulary', type: 'mcq', prompt: 'Where?', options: ['tent', 'car'], answer: 0 }] }
  const putFlow = (v) => te.evaluate((key, val) => localStorage.setItem(key, JSON.stringify({ v: val, at: Date.now() })), `recall.draft.${tId}.material-flow`, v)
  await putFlow({ name: 'plan', req, plan })
  await draftCase(te, 'правки к плану материала', { open: () => go(te, '/teacher?tab=materials'), field: 'textarea[placeholder^="Правки к плану"]', value: 'Добавь вопросов' })
  await putFlow({ name: 'preview', req, plan, content })
  await draftCase(te, 'правки к готовому материалу', { open: () => go(te, '/teacher?tab=materials'), field: 'textarea[placeholder^="Правки (необязательно)"]', value: 'Сделай текст проще' })
  await click(te, 'Очистить')
  await go(te, '/teacher?tab=materials')
  check('мастер материала: «Очистить» — снова список', await click(te, '+ Создать материал', 8000) && !(await text(te)).includes(NOTE))
  await click(te, 'Отмена') // форма тоже черновик: закрываем, чтобы дальше был список

  await draftCase(te, 'разбор работы ученика', {
    open: async () => {
      await go(te, '/teacher?tab=materials')
      await click(te, 'Ученица Черновик · Drafts review')
    },
    field: 'textarea[placeholder^="Комментарий для ученика: что не так"]',
    value: 'Перечитай первое предложение',
  })
  await draftCase(te, 'разбор сочинения', {
    open: async () => {
      await go(te, '/teacher?tab=writing')
      await click(te, 'Drafts essay B')
      await click(te, 'Проверить')
    },
    field: 'textarea[placeholder^="Что удалось"]',
    value: 'Хорошая структура',
  })
  await draftCase(te, 'письменное задание', {
    open: async () => {
      await go(te, '/teacher?tab=writing')
      if (!(await has(te, 'textarea[placeholder^="Вставь или сгенерируй"]'))) await click(te, '+ Новое письмо')
    },
    field: 'textarea[placeholder^="Вставь или сгенерируй"]',
    value: 'Describe your favourite season.',
  })
} finally {
  await b?.close().catch(() => {})
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [TEACHER, STUDENT])
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
