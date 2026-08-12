/**
 * Смоук офлайна: при недоступной базе «Учёба» честно говорит о связи.
 *
 * Зачем. Раньше строки заданий, квестов и программы просто исчезали — человек
 * решал, что преподаватель ничего не назначал (находка ревью 1Г). Живая проба
 * вскрыла и худшее: при недоступном сервере запросы не отвечают вовсе, и хаб
 * навсегда застывал на серых скелетонах.
 *
 * Метод: блокируем ТОЛЬКО запросы к supabase.co — само приложение при этом
 * работает, как при потере связи у пользователя. Сначала проверяем, что в
 * ОНЛАЙНЕ плашки нет: без этого проверка ничего не значила бы.
 *
 * Запуск: node scripts/smoke-offline.mjs (нужен dev-сервер на 5173).
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
const EMAIL = 'offline-check@recall.test', PASS = 'Offline!2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'offline-check' })
const { data: cu } = await admin.auth.admin.createUser({ email: EMAIL, password: PASS, email_confirm: true })
let id = cu?.user?.id
if (!id) {
  const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
  id = l.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id
}
await admin.from('activity_log').upsert(
  { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
  { onConflict: 'user_id,type,day' },
)

const PORT = 9400 + Math.floor(Math.random() * 500)
spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
  `--user-data-dir=${profileDir('off')}`, 'about:blank'],
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
await page.type('#f-email', EMAIL)
await page.type('#f-password', PASS)
await page.click('button[type="submit"]')
await sleep(4000)

// сначала убеждаемся, что ОНЛАЙН плашки нет — иначе проверка ничего не значит
await page.goto('http://localhost:5173/study', { waitUntil: 'networkidle2' })
await sleep(4000)
const online = await page.evaluate(() => document.body.innerText)


// теперь рвём связь ТОЛЬКО с базой — само приложение продолжает работать
await page.setRequestInterception(true)
page.on('request', (r) => (r.url().includes('supabase.co') ? r.abort() : r.continue()))
await page.goto('http://localhost:5173/study', { waitUntil: 'domcontentloaded' })
await sleep(16000)
const txt = await page.evaluate(() => document.body.innerText)
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
// Контроль: в онлайне плашки быть НЕ должно. Без него проверка ничего не
// стоила бы — плашка, висящая всегда, тоже прошла бы «офлайн»-условие.
check('онлайн: плашки про связь нет', !/пропала связь/i.test(online))
check('офлайн: сказали про связь', /связ|интернет/i.test(txt))
check('офлайн: есть кнопка повтора', /Повторить/i.test(txt))
check('офлайн: экран не завис на скелетонах', txt.includes('Учёба') && txt.length > 60)

await b.close()
await admin.auth.admin.deleteUser(id).catch(() => {})
await admin.from('allowed_emails').delete().eq('email', EMAIL)
console.log('Тестовый аккаунт удалён.')

const ok = results.filter(Boolean).length
console.log(`
Итог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
