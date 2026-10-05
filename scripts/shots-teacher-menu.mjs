/**
 * Снимки меню учителя для приёмки владельцем (PLAN.md Ф2.10, макет t1):
 * расписание с меню и счётчиком, «Задания» (хаб со сданными работами и
 * раздел материалов), «Ученики», «Моя учёба» — 390 в тёмной и светлой теме и
 * 1280 в тёмной. Ученик сдаёт письмо и задание — данные кладутся в тестовую
 * базу напрямую, AI не вызывается.
 *
 * Запуск: npm run dev:test, затем node scripts/shots-teacher-menu.mjs [папка]
 * (по умолчанию shots-teacher-menu/ в корне — она в .gitignore). Аккаунты удаляются сами.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Снимки заводят аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'shots-teacher-menu'
const T_EMAIL = 'shots-tm-t@recall.test'
const S_EMAIL = 'shots-tm-s@recall.test'
const PASS = 'ShotsTm!2026'
const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const must = (r, label) => {
  if (r.error) throw new Error(`${label}: ${r.error.message}`)
  return r.data
}

async function makeUser(email, name) {
  await admin.from('allowed_emails').upsert({ email, note: 'shots-teacher-menu (временный)' })
  for (const u of await sql(`select id from auth.users where lower(email) = '${email}'`)) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { display_name: name } })
  if (error) throw new Error(error.message)
  await admin.from('profiles').update({ display_name: name, level: 'B1' }).eq('id', data.user.id)
  return data.user.id
}

async function seed() {
  const t = await makeUser(T_EMAIL, 'Мадина Сейткали')
  const s = await makeUser(S_EMAIL, 'Әсел Жұмабаева')
  await sql(`update public.profiles set role = 'teacher', plan = 'teacher_mini', plan_expires_at = now() + interval '20 days' where id = '${t}'`)
  must(await admin.from('teacher_students').upsert({ teacher_id: t, student_id: s, seat: true }, { onConflict: 'teacher_id,student_id' }), 'привязка')
  const task = must(await admin.from('writing_tasks').insert({ teacher_id: t, lang: 'en', mode: 'ielts', level: 'B2', prompt: 'Some people think cities should ban cars. Discuss.', settings: { ieltsTask: 'task2', targetBand: 6.5 } }).select('id').single(), 'письмо')
  must(await admin.from('writing_task_assignments').insert({ task_id: task.id, student_id: s, status: 'submitted', submitted_at: new Date(Date.now() - 2 * 3600_000).toISOString(), essay: 'Cars make cities loud.', ai_review: { band: 6, errors: [], strengths: ['clear'] } }), 'сданное письмо')
  const mat = must(await admin.from('materials').insert({ teacher_id: t, lang: 'en', level: 'A2', topic: 'Morning', format: 'рассказ', length_range: '50-100', title: 'My morning', body: 'I get up at seven.', exercises: [{ kind: 'comprehension', type: 'mcq', prompt: 'When?', options: ['six', 'seven'], answer: 1 }] }).select('id').single(), 'материал')
  must(await admin.from('material_assignments').insert({ material_id: mat.id, student_id: s, status: 'submitted', submitted_at: new Date(Date.now() - 26 * 3600_000).toISOString(), answers: [{ index: 0, given: 'six', auto_ok: false }], auto_score: 0, auto_total: 1 }), 'сданное задание')
  return [t, s]
}

let ids = []
let browser = null
try {
  ids = await seed()
  mkdirSync(DIR, { recursive: true })
  const PORT = 9700 + Math.floor(Math.random() * 200)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('shots-teacher-menu')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')
  for (const [width, theme] of [[390, 'dark'], [390, 'light'], [1280, 'dark']]) {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    await page.setViewport(width < 600 ? { width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height: 860 })
    await page.evaluateOnNewDocument((th) => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.theme', th)
      } catch {
        /* about:blank — хранилища нет */
      }
    }, theme)
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Войти')?.click())
    await sleep(600)
    await page.type('#f-email', T_EMAIL)
    await page.type('#f-password', PASS)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname === '/schedule', { timeout: 30000, polling: 250 })
    for (const [name, path] of [['1-schedule', '/schedule'], ['2-tasks', '/tasks'], ['3-materials', '/tasks?tab=materials'], ['4-students', '/teacher'], ['5-learn', '/learn']]) {
      await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
      await sleep(2500)
      const file = `${DIR}/${name}-${width}-${theme}.png`
      await page.screenshot({ path: file, fullPage: width < 600 })
      console.log(`снимок ${file}`)
    }
    await ctx.close()
  }
} finally {
  await browser?.close().catch(() => {})
  for (const id of ids) await deleteTestUser(admin, sql, id)
  for (const e of [T_EMAIL, S_EMAIL]) await admin.from('allowed_emails').delete().eq('email', e)
}
