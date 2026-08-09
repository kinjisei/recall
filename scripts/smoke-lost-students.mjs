/**
 * Смоук сигнала о пропавших учениках.
 *
 * Зачем. Главная работа репетитора между уроками — заметить, что ученик
 * перестал заниматься. Приложение это ЗНАЛО (серия, отметка «сегодня»), но не
 * ГОВОРИЛО: надо было открыть список и высмотреть среди всех. При пяти
 * учениках упражнение на внимательность, при десяти лотерея.
 *
 * Сеет трёх учеников с разной давностью: сегодня, девять дней назад и «ни разу
 * не начинал» — и проверяет, что сводка называет ровно двух последних.
 *
 * Запуск: node scripts/smoke-lost-students.mjs (нужен dev-сервер на 5173).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const T = { email: 'lost-t@recall.test', pass: 'Lost!2026teach' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const day = (back) => {
  const d = new Date()
  d.setDate(d.getDate() - back)
  return d.toISOString().slice(0, 10)
}

async function mk(email, patch = {}) {
  await admin.from('allowed_emails').upsert({ email, note: 'lost-check' })
  const { data } = await admin.auth.admin.createUser({ email, password: T.pass, email_confirm: true })
  let id = data?.user?.id
  if (!id) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = l.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
  }
  await admin.from('profiles').update({ role: 'learner', ...patch }).eq('id', id)
  return id
}

const idT = await mk(T.email, { role: 'teacher', display_name: 'Учитель' })
await admin.from('activity_log').upsert(
  { user_id: idT, type: 'flashcards', day: day(0), items_done: 1 },
  { onConflict: 'user_id,type,day' },
)

// три ученика: занимался сегодня, пропал 9 дней назад, не начинал вовсе
// ⚠️ адрес строим из ЛАТИНСКОГО ключа: кириллица в локальной части почты
// не принимается, аккаунт молча не создавался и связь не появлялась
const plan = [
  ['Айгерим', 'aigerim', 0],
  ['Данияр', 'daniyar', 9],
  ['Асель', 'asel', null],
]
const made = []
for (const [nm, key, back] of plan) {
  const em = `lost-${key}@recall.test`
  const id = await mk(em, { display_name: nm, level: 'B1' })
  if (!id) throw new Error(`не создан ученик ${em}`)
  made.push([id, em])
  await admin.from('teacher_students').delete().eq('student_id', id)
  const { error: linkErr } = await admin.from('teacher_students').insert({ teacher_id: idT, student_id: id })
  if (linkErr) throw new Error(`связь ${em}: ${linkErr.message}`)
  if (back !== null) {
    await admin.from('activity_log').upsert(
      { user_id: id, type: 'flashcards', day: day(back), items_done: 5 },
      { onConflict: 'user_id,type,day' },
    )
  }
}

const PORT = 9400 + Math.floor(Math.random() * 500)
spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
  `--user-data-dir=${join(tmpdir(), 'lost-' + Date.now())}`, 'about:blank'],
  { detached: true, stdio: 'ignore' }).unref()
let b = null
for (let i = 0; i < 30 && !b; i++) {
  await sleep(500)
  b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
}
const page = await b.newPage()
await page.setViewport({ width: 390, height: 844 })
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
await sleep(400)
await page.type('#f-email', T.email)
await page.type('#f-password', T.pass)
await page.click('button[type="submit"]')
await sleep(4500)
await page.goto('http://localhost:5173/teacher', { waitUntil: 'networkidle2' })
await sleep(3000)

const txt = await page.evaluate(() => document.body.innerText)
console.log('--- экран ---')
console.log(txt.split('\n').filter(Boolean).slice(0, 22).join(' | '))
console.log('--- конец ---')
const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}
check('сводка о пропавших показана', /Пропали из занятий: 2/.test(txt), (txt.match(/Пропали из занятий: \d+/) || [''])[0])
check('назван пропавший 9 дней назад', /Данияр — не заходил 9 дней/.test(txt))
check('назван не начинавший', /Асель — ещё не начинал/.test(txt))
check('занимавшийся сегодня в сводку НЕ попал', !/Айгерим —/.test(txt.split('Неделя без занятий')[0] ?? ''))
check('в строке ученика виден срок', /занимался сегодня/.test(txt))

await b.close()
await admin.auth.admin.deleteUser(idT).catch(() => {})
await admin.from('allowed_emails').delete().eq('email', T.email)
for (const [id, em] of made) {
  await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', em)
}
const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
