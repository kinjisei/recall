/**
 * Смоук «Письма» без преподавателя.
 *
 * Зачем. Проверка письменной работы по критериям экзамена — самое сильное, что
 * есть в продукте, и она была доступна ТОЛЬКО ученику преподавателя. Человек,
 * занимающийся сам, до неё не доходил: строка в «Учёбе» показывалась лишь при
 * назначенных заданиях, а назначить работу себе он не мог.
 *
 * Проверяет весь путь одиночки: строка видна → выбор темы → работа началась →
 * поле ввода на месте. Сам разбор AI не запускаем: он стоит энергии, а его
 * качество проверяется отдельно (ревью 2Б).
 *
 * Запуск: node scripts/smoke-own-writing.mjs (нужен dev-сервер на 5173).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const EMAIL = 'own-writing@recall.test'
const PASS = 'OwnWrite!2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}

await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'own-writing' })
const { data: cu } = await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true })
let id = cu?.user?.id
if (!id) {
  const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
  id = l.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id
}
if (!id) throw new Error('не создан аккаунт')
// одиночка: НИ ОДНОГО преподавателя
await admin.from('teacher_students').delete().eq('student_id', id)
await admin.from('profiles').update({ level: 'B1', role: 'learner' }).eq('id', id)
await admin.from('activity_log').upsert(
  { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
  { onConflict: 'user_id,type,day' },
)

const PORT = 9400 + Math.floor(Math.random() * 500)
spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
  `--user-data-dir=${profileDir('ow')}`, 'about:blank'],
  { detached: true, stdio: 'ignore' }).unref()
let b = null
for (let i = 0; i < 30 && !b; i++) {
  await sleep(500)
  b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
}
const page = await b.newPage()
await page.setViewport({ width: 390, height: 844 })
const jsErrors = []
page.on('pageerror', (e) => jsErrors.push(String(e)))

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
await sleep(400)
await page.type('#f-email', EMAIL)
await page.type('#f-password', PASS)
await page.click('button[type="submit"]')
await sleep(4500)

// 1. строка «Письмо» видна БЕЗ преподавателя
await page.goto('http://localhost:5173/study', { waitUntil: 'networkidle2' })
await sleep(3000)
const studyTxt = await page.evaluate(() => document.body.innerText)
check('строка «Письмо» видна без преподавателя', /Письмо/.test(studyTxt))

// 2. заходим и выбираем тему
await page.goto('http://localhost:5173/writing', { waitUntil: 'networkidle2' })
await sleep(2500)
const empty = await page.evaluate(() => document.body.innerText)
check('пустой экран предлагает начать', /Выбрать тему/.test(empty))

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Выбрать тему'))
  if (btn) btn.click()
})
await sleep(1500)
const picker = await page.evaluate(() => document.body.innerText)
// ⚠️ регистронезависимо: у заголовков секций стоит uppercase, и innerText
// отдаёт их уже преобразованными («ЭКЗАМЕН»)
check(
  'темы показаны и разделены на экзамен и свободные',
  /экзамен/i.test(picker) && /свободные темы/i.test(picker),
)
check('темы выше уровня не предлагаются (B1)', !/Английский как мировой язык/.test(picker))

// 3. начинаем работу.
// ⚠️ Пока RPC start_own_writing не залита в базу, дальше идти бессмысленно:
// проверки покажут «нет поля ввода» и «нет записи», как будто сломан продукт.
// Останавливаемся с внятной причиной.
const rpc = await admin.rpc('start_own_writing', {
  p_lang: 'en', p_mode: 'ielts', p_level: 'B1', p_prompt: 'проба',
})
if (/Could not find the function|PGRST202/i.test(rpc.error?.message ?? '')) {
  console.log('\n⏭ Остановлено: блок «ПИСЬМО БЕЗ ПРЕПОДАВАТЕЛЯ» из docs/schema.sql ещё не залит в Supabase.')
  await b.close()
  await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
  process.exitCode = 1
  throw new Error('схема не залита')
}
// служебная запись пробы — убираем, чтобы не мешала подсчёту ниже
await admin.from('writing_tasks').delete().eq('teacher_id', id)

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Работа из дома'))
  if (btn) btn.click()
})
await sleep(4000)
const runner = await page.evaluate(() => ({
  txt: document.body.innerText,
  hasInput: !!document.querySelector('textarea'),
}))
check('работа открылась', /working from home|Работа из дома/i.test(runner.txt), runner.txt.slice(0, 60))
check('есть поле для текста', runner.hasInput)

// 4. в базе появилось ровно одно назначение, автор — сам ученик
const { data: rows } = await admin
  .from('writing_task_assignments')
  .select('id, task_id, student_id')
  .eq('student_id', id)
check('в базе одно назначение на себя', (rows ?? []).length === 1, `${(rows ?? []).length}`)
if ((rows ?? []).length === 1) {
  const { data: task } = await admin.from('writing_tasks').select('teacher_id, mode').eq('id', rows[0].task_id).single()
  check('автор задания — сам ученик', task?.teacher_id === id)
  check('режим экзаменационный', task?.mode === 'ielts', String(task?.mode))
}

check('JS-ошибок нет', jsErrors.length === 0, jsErrors[0] ?? '')

await b.close()
await admin.auth.admin.deleteUser(id).catch(() => {})
await admin.from('allowed_emails').delete().eq('email', EMAIL)
console.log('Тестовый аккаунт удалён.')

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
