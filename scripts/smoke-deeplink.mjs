/**
 * Смоук глубокой ссылки: адрес, открытый БЕЗ входа, после логина доводит туда,
 * куда человек шёл.
 *
 * Зачем. Преподаватель присылает ученику ссылку «прочитай вот этот текст».
 * Раньше после входа она забывалась, и человек оказывался на Главной, где
 * искал нужное заново (находка ревью 1Г).
 *
 * Запуск: node scripts/smoke-deeplink.mjs (нужен dev-сервер на 5173).
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
const EMAIL = 'deeplink@recall.test', PASS = 'Deep!2026link'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'deeplink' })
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
await admin.from('profiles').update({ level: 'B1' }).eq('id', id)

const PORT = 9400 + Math.floor(Math.random() * 500)
spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
  `--user-data-dir=${join(tmpdir(), 'dl-' + Date.now())}`, 'about:blank'],
  { detached: true, stdio: 'ignore' }).unref()
let b = null
for (let i = 0; i < 30 && !b; i++) {
  await sleep(500)
  b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
}
const page = await b.newPage()
await page.setViewport({ width: 390, height: 844 })

// ссылка «прочитай вот этот текст», открытая БЕЗ входа
const target = '/study?view=reader&text=b1-habits'
await page.goto('http://localhost:5173' + target, { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
await page.goto('http://localhost:5173' + target, { waitUntil: 'networkidle2' })
await sleep(2500)
const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}
check('без входа увели на /login', page.url().includes('/login'), page.url())

await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
await sleep(500)
await page.type('#f-email', EMAIL)
await page.type('#f-password', PASS)
await page.click('button[type="submit"]')
await sleep(5000)
const url = page.url()
check('после входа вернулись к тексту', url.includes('view=reader') && url.includes('text=b1-habits'), url)

await b.close()
await admin.auth.admin.deleteUser(id).catch(() => {})
await admin.from('allowed_emails').delete().eq('email', EMAIL)
console.log('Тестовый аккаунт удалён.')

const okCount = results.filter(Boolean).length
console.log(`
Итог: ${okCount}/${results.length}`)
process.exitCode = okCount === results.length ? 0 : 1
