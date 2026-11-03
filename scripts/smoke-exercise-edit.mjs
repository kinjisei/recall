/**
 * Смоук правки упражнений руками (PLAN.md Ф2.25-3, макет d17) — шаг «Текст»
 * мастера: «Изменить · Убрать», ошибка у поля, «+ Упражнение → Напишу сам»,
 * «Отмена», переключение с несохранённой правкой — с вопросом, «Сохранить» с
 * правкой без «Готово» — тоже; «Сохранить» кладёт в базу поправленные
 * упражнения (их и получит ученик); на телефоне «Готово · Отмена» — в
 * конце формы, рамка цела.
 *
 * Библиотека (3б, d17-4): «Выдан» со статусом, правка и «Убрать» сразу в
 * базе с новой версией; ученик: черновик старой версии сброшен с «Учитель
 * обновил задание», сдача старой версии — отказ и задание заново с текста;
 * сданный материал — плашка, «🔒 правка закрыта», «Сделать копию и править»
 * (копия без выдач правится); ученик сдал, пока учитель правил, — плашка, а
 * не сырая ошибка, и правка открывается в копии.
 *
 * Текст готов заранее — черновиком мастера (`material-flow`), AI не зовётся:
 * смоук не тратит ни генераций, ни энергии. Краснеет на коде до Ф2.25-3:
 * у упражнения нет «Изменить» (3а) и нет его в библиотеке (3б).
 *
 * Запуск: node scripts/smoke-exercise-edit.mjs (нужен `npm run dev:test` —
 * 5174, тестовая база; аккаунты заводятся и удаляются).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'ExEdit!2026'
const TEACHER = 'exedit-teacher@recall.test'
const STUDENT = 'exedit-student@recall.test'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}

async function makeUser(email, name, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'exedit' })
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

// текст и упражнения кадров d17
const BODY =
  'Last summer Dana flew from Almaty to Istanbul. She came to the airport early, but the screen said: “Delay — 3 hours”. Dana was not happy. She bought a coffee and waited near the gate.\n\n' +
  'The plane left very late, and in Istanbul Dana had only forty minutes for her next flight. She ran through the airport with her boarding pass in her hand. But the gate was already closed. She missed her flight!\n\n' +
  'A woman at the desk was very kind. She gave Dana a ticket for the evening flight. Then Dana went to get her luggage, but her bag was not there.'
const EXERCISES = [
  { kind: 'comprehension', type: 'mcq', prompt: 'Why did Dana wait near the gate for three hours?', options: ['Her flight had a delay.', 'She came late.', 'She wanted a coffee.'], answer: 0 },
  { kind: 'comprehension', type: 'mcq', prompt: 'What did the woman at the desk give Dana?', options: ['A ticket for the evening flight.', 'A new boarding pass.', 'Her luggage.'], answer: 0 },
  { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana came to the airport late.', options: ['True', 'False'], answer: 1 },
  {
    kind: 'vocab',
    type: 'match',
    format: 'translation',
    prompt: 'Соедини слово и перевод',
    pairs: [
      { left: 'delay', right: 'задержка' },
      { left: 'gate', right: 'выход на посадку' },
      { left: 'boarding pass', right: 'посадочный талон' },
      { left: 'luggage', right: 'багаж' },
      { left: 'miss a flight', right: 'опоздать на рейс' },
    ],
  },
  { kind: 'grammar', type: 'fill', prompt: 'She ___ (buy) a coffee and waited near the gate.', answer: 'bought' },
]

const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
const text = (page) => page.evaluate(() => document.body.innerText)
const has = (page, sel) => page.$(sel).then((h) => h !== null)
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout }, re.source).then(() => true, () => false)
/** Нажать видимую кнопку по aria-label или тексту (начало совпадает). */
async function press(page, label, scope = 'body') {
  const ok = await page.evaluate(
    (l, sc) => {
      const b = [...document.querySelectorAll(`${sc} button`)].find((x) => x.offsetParent !== null && !x.disabled && ((x.getAttribute('aria-label') ?? '').startsWith(l) || x.textContent.trim().startsWith(l)))
      b?.click()
      return Boolean(b)
    },
    label,
    scope,
  )
  await sleep(400)
  return ok
}
/** Набрать в поле (события input у React), прежнее — прочь. */
async function typeInto(page, sel, value) {
  await page.focus(sel)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  if (value) await page.type(sel, value)
  await sleep(200)
}
const formText = (page) => page.$eval('[data-exercise-edit]', (el) => el.innerText).catch(() => '')
async function login(page, email) {
  await go(page, '/login')
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  await sleep(1200)
}
const material = async (id) => (await admin.from('materials').select('title, exercises, exercises_version').eq('id', id).single()).data
const status = async (id) => (await admin.from('material_assignments').select('status').eq('id', id).single()).data?.status
const waitGone = (page, sel, timeout = 8000) => page.waitForFunction((s) => !document.querySelector(s), { polling: 200, timeout }, sel).then(() => true, () => false)

let browser = null
let tId = null
let sId = null
try {
  tId = await makeUser(TEACHER, 'Учитель Правка', 'teacher')
  sId = await makeUser(STUDENT, 'Ученица Правка')
  const link = await admin.from('teacher_students').upsert({ teacher_id: tId, student_id: sId, seat: true }, { onConflict: 'teacher_id,student_id' })
  if (link.error) throw new Error(`привязка: ${link.error.message}`)

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('smoke-exercise-edit')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await go(page, '/login')
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', TEACHER)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  await sleep(1200)

  // текст готов — черновиком мастера, как после перезагрузки
  const req = { lang: 'en', level: 'A2', topic: 'Travel', format: 'рассказ', lengthRange: '100-140', vocabulary: '', grammar: '', studentIds: [sId] }
  const plan = { comments: 'План', vocabulary: ['delay', 'gate'], grammar_focus: 'Past Simple', exercise_plan: [{ format: 'mcq', kind: 'comprehension', type: 'mcq', count: 2, note: '' }] }
  const flow = { steps: [{ name: 'form' }, { name: 'plan', req, plan }, { name: 'preview', req, plan, content: { title: 'Exedit airport', body: BODY, exercises: EXERCISES } }], at: 2 }
  await page.evaluate((key, v) => localStorage.setItem(key, JSON.stringify({ v, at: Date.now() })), `recall.draft.${tId}.material-flow`, flow)
  await go(page, '/tasks?tab=materials')
  check('шаг «Текст»: «Упражнения (5) · до 9 баллов»', await waitText(page, /Упражнения \(5\)[\s\S]*до 9 баллов/))

  // (1) d17-1: убрал верный вариант → «Готово» → ошибка у вариантов, форма открыта
  check('«Изменить» открывает форму на месте упражнения', (await press(page, 'Изменить упражнение 2')) && (await formText(page)).includes('Выбери ответ · правка'))
  await press(page, 'Убрать: A ticket for the evening flight.')
  await press(page, 'Готово', '[data-exercise-edit]')
  const err = await formText(page)
  check('без верного варианта — «Отметь верный вариант» у вариантов, форма открыта', err.includes('Отметь верный вариант') && (await has(page, '[data-exercise-edit]')), err.slice(0, 200))
  await press(page, 'Верный: A new boarding pass.')
  check('отметил верный — ошибка ушла на ходу', !(await formText(page)).includes('Отметь верный вариант'))
  await press(page, 'Готово', '[data-exercise-edit]')
  const t1 = await text(page)
  check('«Готово» — форма закрыта, у упражнения 2 новый ответ', !(await has(page, '[data-exercise-edit]')) && t1.includes('Ответ: A new boarding pass.'))

  // (2) пары: слово не из текста — причина у пар; слово из текста — сохраняется
  await press(page, 'Изменить упражнение 4')
  await press(page, 'пара', '[data-exercise-edit]')
  await typeInto(page, 'textarea[aria-label="слово 6"]', 'passport')
  await typeInto(page, 'textarea[aria-label="перевод 6"]', 'паспорт')
  await press(page, 'Готово', '[data-exercise-edit]')
  check('пара со словом не из текста — «Слова «passport» нет в тексте»', (await formText(page)).includes('Слова «passport» нет в тексте'))
  await typeInto(page, 'textarea[aria-label="слово 6"]', 'flight')
  await typeInto(page, 'textarea[aria-label="перевод 6"]', 'рейс')
  await press(page, 'Готово', '[data-exercise-edit]')
  check('пара из текста сохранена: «6 пар», «до 10 баллов»', !(await has(page, '[data-exercise-edit]')) && (await waitText(page, /6 пар[\s\S]*|до 10 баллов/, 3000)) && /до 10 баллов/.test(await text(page)) && /6 пар/.test(await text(page)))

  // (3) «Отмена» — упражнение как было
  await press(page, 'Изменить упражнение 1')
  await typeInto(page, '[data-exercise-edit] textarea[name="prompt"]', 'Changed question?')
  await press(page, 'Отмена', '[data-exercise-edit]')
  check('«Отмена» — упражнение 1 прежнее', (await text(page)).includes('Why did Dana wait near the gate') && !(await text(page)).includes('Changed question?'))

  // (4) несохранённая правка + «Изменить» у другого — вопрос, «Продолжить правку» оставляет форму
  await press(page, 'Изменить упражнение 1')
  await typeInto(page, '[data-exercise-edit] textarea[name="prompt"]', 'Why was Dana unhappy?')
  await press(page, 'Изменить упражнение 3')
  const asked = await page.waitForSelector('[role="alertdialog"]', { timeout: 3000 }).then(() => true, () => false)
  const askText = asked ? await page.$eval('[role="alertdialog"]', (el) => el.innerText) : ''
  await press(page, 'Продолжить правку', '[role="alertdialog"]')
  check('другое «Изменить» при несохранённой правке — вопрос, правка остаётся', asked && askText.includes('Бросить правку упражнения 1') && (await formText(page)).includes('1'), askText.slice(0, 80))
  await press(page, 'Готово', '[data-exercise-edit]')
  check('правка вопроса сохранена', (await text(page)).includes('Why was Dana unhappy?'))

  // (5) «Убрать» — с вопросом; открытая новая форма при этом остаётся
  await press(page, 'Упражнение', '[data-add-exercise]')
  await page.click('[data-pick="Собери предложение"]')
  await press(page, 'Напишу сам')
  await press(page, 'Убрать упражнение 5')
  await page.waitForSelector('[role="alertdialog"]', { timeout: 3000 }).catch(() => {})
  await press(page, 'Убрать', '[role="alertdialog"]')
  check('«Убрать» — упражнений 4', await waitText(page, /Упражнения \(4\)/, 3000))
  check('открытая новая форма после «Убрать» осталась (номер 5)', (await formText(page)).startsWith('5') && (await formText(page)).includes('Собери предложение · новое'), (await formText(page)).slice(0, 60))
  await press(page, 'Отмена', '[data-exercise-edit]')

  // (6) «+ Упражнение → Напишу сам» (d17-3, d17-3б)
  await press(page, 'Упражнение', '[data-add-exercise]')
  await page.click('[data-pick="Выбери правильную форму"]')
  await sleep(300)
  const chosen = await text(page)
  await press(page, 'Напишу сам')
  check('«Выбрано: Грамматика · Выбери правильную форму» → пустая форма «· новое»', chosen.includes('Выбрано: Грамматика · Выбери правильную форму') && (await formText(page)).includes('Выбери правильную форму · новое'))
  check('AI-кнопок нет (Ф2.25-4): ни «Заменить», ни «Составит AI»', !/Заменить|Составит AI/.test(await text(page)))
  await press(page, 'Готово', '[data-exercise-edit]')
  const empty = await formText(page)
  check('пустая форма: причины у предложения и форм', empty.includes('Впиши предложение') && empty.includes('Заполни все формы'), empty.slice(0, 200))
  await typeInto(page, '[data-exercise-edit] textarea[name="prompt"]', 'Dana ___ to Istanbul last summer.')
  for (const [i, w] of ['flew', 'fly', 'flown'].entries()) await typeInto(page, `textarea[aria-label="форма ${i + 1}"]`, w)
  await press(page, 'Верный: flew')
  await press(page, 'Готово', '[data-exercise-edit]')
  check('новое упражнение — пятым: «Упражнения (5)»', !(await has(page, '[data-exercise-edit]')) && (await waitText(page, /Упражнения \(5\)/, 3000)))

  // (7) телефон: «Готово · Отмена» — в конце формы, после вариантов, не закреплены
  // (решение владельца 04.11: закреплённая полоса закрывала последний вариант и резала рамку)
  // только ширина: смена isMobile в puppeteer перезагружает страницу
  await page.setViewport({ width: 390, height: 844 })
  await page.waitForSelector('[data-exercise-list]', { timeout: 15000 }).catch(() => {})
  await sleep(600)
  await press(page, 'Изменить упражнение 4')
  await page.evaluate(() => {
    const r = document.querySelector('[data-exercise-edit]')?.getBoundingClientRect()
    if (r) window.scrollBy(0, r.top - 300)
  })
  await sleep(400)
  const pin = await page.evaluate(() => {
    const f = document.querySelector('[data-edit-footer]')?.getBoundingClientRect()
    const card = document.querySelector('[data-exercise-edit]')?.getBoundingClientRect()
    const last = [...document.querySelectorAll('[data-exercise-edit] textarea')].at(-1)?.getBoundingClientRect()
    return f && card && last && { footerTop: Math.round(f.top), lastBottom: Math.round(last.bottom), gap: Math.round(card.bottom - f.bottom), vh: innerHeight, cardBottom: Math.round(card.bottom) }
  })
  check('телефон: «Готово · Отмена» после полей, у низа формы, а не поверх неё', !!pin && pin.cardBottom > pin.vh && pin.footerTop > pin.lastBottom && pin.gap >= 4 && pin.gap <= 20, JSON.stringify(pin))
  // рамка формы цела: подвал кончается выше её нижней линии — раньше закреплённая
  // полоса со своим фоном доходила до края и закрашивала её (замечание владельца 04.11);
  // форма покороче (True / False) — целиком на экране
  await press(page, 'Отмена', '[data-exercise-edit]')
  await press(page, 'Изменить упражнение 3')
  await page.evaluate(() => {
    const r = document.querySelector('[data-exercise-edit]')?.getBoundingClientRect()
    if (r) window.scrollBy(0, r.top - 120)
  })
  await sleep(400)
  const frame = await page.evaluate(() => {
    const f = document.querySelector('[data-edit-footer]')?.getBoundingClientRect()
    const card = document.querySelector('[data-exercise-edit]')?.getBoundingClientRect()
    return f && card && { gap: Math.round(card.bottom - f.bottom), left: Math.round(f.left - card.left), right: Math.round(card.right - f.right), fits: card.bottom < innerHeight - 88 }
  })
  check('телефон: подвал формы внутри рамки — нижняя линия не закрашена', !!frame && frame.fits && frame.gap >= 4 && frame.left >= 4 && frame.right >= 4, JSON.stringify(frame))
  await press(page, 'Отмена', '[data-exercise-edit]')
  await page.setViewport({ width: 1280, height: 900 })
  await page.waitForSelector('[data-exercise-list]', { timeout: 15000 }).catch(() => {})
  await sleep(600)

  // (8) правка без «Готово» — «Сохранить» спрашивает, а не теряет её молча
  await press(page, 'Изменить упражнение 3')
  await typeInto(page, '[data-exercise-edit] textarea[name="prompt"]', 'Dana came to the airport on time.')
  await press(page, 'Сохранить и выдать')
  const warned = await page.waitForSelector('[role="alertdialog"]', { timeout: 3000 }).then(() => true, () => false)
  const warnText = warned ? await page.$eval('[role="alertdialog"]', (el) => el.innerText) : ''
  await press(page, 'Вернуться к правке', '[role="alertdialog"]')
  check('правка без «Готово» — «Упражнение 3 ещё на правке», «Вернуться к правке» оставляет форму', warnText.includes('Упражнение 3 ещё на правке') && (await has(page, '[data-exercise-edit]')), warnText.slice(0, 80))
  await press(page, 'Отмена', '[data-exercise-edit]')

  // (9) «Сохранить и выдать» — в базе поправленные упражнения, ученице выдано
  await press(page, 'Сохранить и выдать')
  await page.waitForFunction(() => !/Новый материал/.test(document.body.innerText), { polling: 250, timeout: 15000 }).catch(() => {})
  const { data: mats } = await admin.from('materials').select('id, exercises').eq('teacher_id', tId)
  const ex = mats?.[0]?.exercises ?? []
  const { count } = await admin.from('material_assignments').select('id', { count: 'exact', head: true }).eq('material_id', mats?.[0]?.id ?? '')
  check(
    'в базе — поправленные: 5 упражнений, верный «A new boarding pass.», 6 пар, своё «Выбери форму», вопрос 1 новый',
    ex.length === 5 && ex[1]?.options?.[ex[1].answer] === 'A new boarding pass.' && ex[3]?.pairs?.length === 6 && ex[4]?.format === 'form' && ex[0]?.prompt === 'Why was Dana unhappy?',
    JSON.stringify(ex).slice(0, 300),
  )
  check('выдано ученице', count === 1)
  const left = await page.evaluate((uid) => Object.keys(localStorage).filter((k) => k.startsWith(`recall.draft.${uid}.material-`)).length, tId)
  check('после сохранения черновиков мастера и формы нет', left === 0, `осталось ${left}`)

  // ===== 3б: библиотека (d17-4) и ученик =====
  const m1 = mats?.[0]?.id
  const a1 = (await admin.from('material_assignments').select('id').eq('material_id', m1).single()).data?.id

  // (10) до сдачи: «Выдан» со статусом, правка и «Убрать» — сразу в базе, версия растёт
  await go(page, `/tasks?tab=materials&mat=${m1}`)
  check('библиотека: «Выдан» — Ученица Правка · «ещё не сдано», замка нет', (await waitText(page, /Выдан[\s\S]*Ученица Правка[\s\S]*ещё не сдано/)) && !(await has(page, '[data-material-lock]')))
  check('до сдачи у упражнений — «Изменить»', await press(page, 'Изменить упражнение 1'))
  await typeInto(page, '[data-exercise-edit] textarea[name="prompt"]', 'Why did Dana feel unhappy?')
  await press(page, 'Готово', '[data-exercise-edit]')
  await waitGone(page, '[data-exercise-edit]')
  let row = await material(m1)
  check('«Готово» в библиотеке — сразу в базе, версия 2', row.exercises[0]?.prompt === 'Why did Dana feel unhappy?' && row.exercises_version === 2, JSON.stringify({ v: row.exercises_version, p: row.exercises[0]?.prompt }))
  await press(page, 'Убрать упражнение 5')
  await page.waitForSelector('[role="alertdialog"]', { timeout: 3000 }).catch(() => {})
  await press(page, 'Убрать', '[role="alertdialog"]')
  await waitText(page, /Упражнения · 4/, 5000)
  row = await material(m1)
  check('«Убрать» в библиотеке — 4 упражнения, версия 3', row.exercises.length === 4 && row.exercises_version === 3, `${row.exercises.length} · v${row.exercises_version}`)

  // (11) ученик: черновик старой версии — сброшен, «Учитель обновил задание», с текста
  const spage = await (await browser.createBrowserContext()).newPage()
  await spage.setViewport({ width: 1280, height: 900 })
  await login(spage, STUDENT)
  const stale = { answers: { 0: { index: 0, given: 'x', auto_ok: false }, 1: { index: 1, given: 'y', auto_ok: false } }, index: 2, version: 2 }
  await spage.evaluate((key, v) => localStorage.setItem(key, JSON.stringify({ v, at: Date.now() })), `recall.draft.${sId}.assignment:${a1}`, stale)
  await go(spage, `/assignments?a=${a1}&stage=exercises`)
  check('ученик: черновик старой версии — «Учитель обновил задание», задание с текста', (await waitText(spage, /Учитель обновил задание — прежние ответы сброшены/)) && spage.url().includes('stage=read'), spage.url())
  await press(spage, 'К упражнениям')
  const fresh = await text(spage)
  check('упражнения — с первого, без «Черновик восстановлен»', fresh.includes('Why did Dana feel unhappy?') && !fresh.includes('Черновик восстановлен'), fresh.slice(0, 200))

  // (12) сдача старой версии: учитель поправил, пока ученик решал — отказ, задание заново
  const m2 = (await admin.from('materials').insert({ teacher_id: tId, lang: 'en', level: 'A2', topic: 'Travel', format: 'рассказ', length_range: '100-140', title: 'Exedit lock', body: BODY, exercises: [EXERCISES[0]] }).select('id').single()).data?.id
  const a2 = (await admin.from('material_assignments').insert({ material_id: m2, student_id: sId }).select('id').single()).data?.id
  await go(spage, `/assignments?a=${a2}&stage=exercises`)
  await waitText(spage, /Why did Dana wait near the gate/)
  await go(page, `/tasks?tab=materials&mat=${m2}`)
  await press(page, 'Изменить упражнение 1')
  await typeInto(page, '[data-exercise-edit] textarea[name="prompt"]', 'Why did Dana wait so long?')
  await press(page, 'Готово', '[data-exercise-edit]')
  await waitGone(page, '[data-exercise-edit]')
  await spage.keyboard.press('1')
  await sleep(500)
  await press(spage, 'Завершить')
  check('сдача старой версии — «Учитель обновил задание», задание с текста, работа не сдана', (await waitText(spage, /Учитель обновил задание — прежние ответы сброшены/)) && (await status(a2)) === 'assigned')
  await press(spage, 'К упражнениям')
  check('ученик видит поправленный вопрос', await waitText(spage, /Why did Dana wait so long\?/, 5000))
  await spage.keyboard.press('1')
  await sleep(500)
  await press(spage, 'Завершить')
  check('новая версия сдаётся', (await waitText(spage, /Работа отправлена преподавателю/)) && (await status(a2)) === 'submitted')

  // (13) сданный материал: плашка, «правка закрыта», копия без выдач — правится
  await go(page, `/tasks?tab=materials&mat=${m2}`)
  const lockText = await page.waitForSelector('[data-material-lock]', { timeout: 8000 }).then((h) => h.evaluate((el) => el.innerText), () => '')
  check('сданный: «Работу уже сдали: Ученица Правка — правка изменила бы её проверку»', lockText.includes('Работу уже сдали: Ученица Правка — правка изменила бы её проверку'), lockText.slice(0, 120))
  check('у упражнений «правка закрыта», «Изменить» нет', (await text(page)).includes('правка закрыта') && !(await has(page, 'button[aria-label="Изменить упражнение 1"]')))
  check('«Выдан» — «сдано · ждёт проверки»', (await text(page)).includes('сдано · ждёт проверки'))
  await press(page, 'Сделать копию и править')
  check('копия открылась и правится', (await page.waitForFunction((id) => !location.search.includes(id), { timeout: 8000 }, m2).then(() => true, () => false)) && (await page.waitForSelector('button[aria-label="Изменить упражнение 1"]', { timeout: 8000 }).then(() => true, () => false)) && !(await has(page, '[data-material-lock]')))
  const copyId = new URL(page.url()).searchParams.get('mat')
  const { data: same } = await admin.from('materials').select('id').eq('teacher_id', tId).eq('title', 'Exedit lock')
  const { count: copyIssued } = await admin.from('material_assignments').select('id', { count: 'exact', head: true }).eq('material_id', copyId)
  check('копия — тот же заголовок, без выдач', same?.length === 2 && copyIssued === 0, `${same?.length} · ${copyIssued}`)

  // (14) ученик сдал, пока учитель правил: плашка, а не сырая ошибка; правка — в копии
  await go(page, `/tasks?tab=materials&mat=${m1}`)
  await press(page, 'Изменить упражнение 2')
  await typeInto(page, '[data-exercise-edit] textarea[name="prompt"]', 'What did Dana get at the desk?')
  const sc = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  await sc.auth.signInWithPassword({ email: STUDENT, password: PASS })
  const sub = await sc.rpc('submit_material', { p_id: a1, p_answers: [], p_auto_score: 0, p_auto_total: 0 })
  check('ученик сдал материал 1 (без версии — как старое приложение)', !sub.error, sub.error?.message)
  await press(page, 'Готово', '[data-exercise-edit]')
  const raced = await page.waitForSelector('[data-material-lock]', { timeout: 8000 }).then((h) => h.evaluate((el) => el.innerText), () => '')
  check('«Готово» после сдачи — плашка «правка не сохранилась — откроется в копии», без сырой ошибки', raced.includes('Твоя правка не сохранилась — она откроется в копии') && !/RECALL_|Не получилось/.test(await text(page)), raced.slice(0, 160))
  await press(page, 'Сделать копию и править')
  const carried = await page.waitForSelector('[data-exercise-edit] textarea[name="prompt"]', { timeout: 8000 }).then((h) => h.evaluate((el) => el.value), () => '')
  check('в копии форма открыта с той же правкой', carried === 'What did Dana get at the desk?', carried)
  await press(page, 'Готово', '[data-exercise-edit]')
  await waitGone(page, '[data-exercise-edit]')
  const copy1 = await material(new URL(page.url()).searchParams.get('mat'))
  check('правка сохранена в копии, оригинал прежний', copy1?.exercises[1]?.prompt === 'What did Dana get at the desk?' && (await material(m1)).exercises[1]?.prompt !== 'What did Dana get at the desk?')
} catch (e) {
  check(`без сбоя: ${e.message}`, false)
} finally {
  await browser?.close().catch(() => {})
  for (const id of [tId, sId]) if (id) await deleteTestUser(admin, null, id)
  await admin.from('allowed_emails').delete().in('email', [TEACHER, STUDENT])
  console.log('Тестовые аккаунты удалены.')
}
const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
