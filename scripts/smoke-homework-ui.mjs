/**
 * Смоук карточки ученика: домашка глазами преподавателя.
 *
 * Серверные правила проверяет smoke-homework (он быстрый и без браузера). Здесь
 * проверяется ровно то, чего он не видит: что карточка перестроена вокруг
 * домашки, что её можно собрать шторкой, и что закрытый сервером пункт
 * подписан честно — «засчитано по занятиям», а не «проверено».
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-homework-ui.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const T_EMAIL = 'hwui-teacher@recall.test'
const S_EMAIL = 'hwui-student@recall.test'
const PASSWORD = 'HwUi!Smoke2026'
const STUDENT_NAME = 'Ерболат Смоуков'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const seen = (page, t) => page.evaluate((x) => (document.body.innerText || '').includes(x), t)
const waitText = (page, t, ms = 15000) =>
  page
    .waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms, polling: 250 }, t)
    .then(() => true)
    .catch(() => false)
const tap = async (page, text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role=button]')].find(
      (e) => (e.textContent || '').trim().includes(t) && !e.disabled,
    )
    if (el) el.click()
    return !!el
  }, text)
  await sleep(800)
  return ok
}

async function makeUser(email, role, name) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  for (const u of list.users.filter((u) => u.email === email)) await admin.auth.admin.deleteUser(u.id)
  const { data } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  await admin.from('profiles').update({ role, display_name: name }).eq('id', data.user.id)
  return data.user.id
}

let tId, sId, browser
try {
  tId = await makeUser(T_EMAIL, 'teacher', 'Смоук-Учитель')
  sId = await makeUser(S_EMAIL, 'learner', STUDENT_NAME)
  await admin.from('teacher_students').insert({ teacher_id: tId, student_id: sId })
  check('учитель и ученик заведены', !!tId && !!sId)

  const port = 9700 + Math.floor(Math.random() * 200)
  spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu',
     `--user-data-dir=${profileDir('hwui')}`, 'about:blank'],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 40 && !browser; i++) {
    try {
      browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` })
    } catch {
      await sleep(500)
    }
  }
  const page = await browser.newPage()
  await page.setViewport({ width: 420, height: 900 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('recall.onboarded', '1')
    } catch {}
  })

  // вход преподавателем
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 })
  await tap(page, 'Войти')
  await page.type('#f-email', T_EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000, polling: 250 })

  // ---- 1. карточка построена вокруг домашки ---------------------------------
  await page.goto(`${BASE}/teacher?student=${sId}`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('карточка открылась', await waitText(page, STUDENT_NAME))
  check('пустая домашка объясняет себя', await seen(page, 'Домашки нет'))
  check('главная кнопка на месте', await seen(page, 'Собрать домашку'))
  check('плашки с числами показаны', await seen(page, 'буксуют слов') && (await seen(page, 'слабых тем')))

  // ⚠️ Старые разделы должны быть СПРЯТАНЫ под «Ещё»: ради этого всё и делалось.
  // Если они снова окажутся на виду, экран вернётся к пяти раскрывашкам подряд.
  check('разделы убраны под «Ещё»', !(await seen(page, 'Диагностическая карта')))
  check('кнопка «Ещё» есть', await seen(page, 'Ещё:'))

  // ---- 2. разделы адресуемые ------------------------------------------------
  await page.goto(`${BASE}/teacher?student=${sId}&sec=diag`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('?sec=diag открывает диагностику сразу', await waitText(page, 'Диагностическая карта'))

  // ---- 3. сборка домашки шторкой --------------------------------------------
  await page.goto(`${BASE}/teacher?student=${sId}`, { waitUntil: 'networkidle2', timeout: 30000 })
  await waitText(page, 'Собрать домашку')
  await tap(page, 'Собрать домашку')
  check('шторка сборки открылась', await waitText(page, 'Сдать до'))
  // ⚠️ Значения полей ввода в innerText НЕ попадают — заготовку надо читать из
  // самих input, иначе проверка ищет текст, которого на странице нет по природе.
  const drafted = await page.$$eval('input[aria-label="Что сделать"]', (els) =>
    els.map((e) => e.value),
  )
  check(
    'заготовка недели предлагает баланс',
    drafted.length === 3 && drafted.some((t) => /слов/i.test(t)) && drafted.some((t) => /текст/i.test(t)),
    drafted.join(' | '),
  )

  const sent = await tap(page, 'Выдать домашку')
  check('домашка выдана', sent && (await waitText(page, 'Домашка на неделю')))
  check('видно счёт', await seen(page, '0 из 3'))

  const { count } = await admin
    .from('homework')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', sId)
  check('домашка появилась в базе', count === 1, `строк: ${count}`)

  // ---- 4. закрытый сервером пункт подписан честно ---------------------------
  const { data: deck } = await admin
    .from('decks').select('id').eq('owner_id', sId).eq('lang', 'en').limit(1).single()
  const { data: cards } = await admin
    .from('cards')
    .insert(Array.from({ length: 20 }, (_, i) => ({ deck_id: deck.id, front: `w${i}`, back: `с${i}`, source: 'teacher' })))
    .select('id')
  const now = new Date().toISOString()
  await admin.from('review_states').insert(
    cards.map((c) => ({ user_id: sId, card_id: c.id, state: 'review', due: now, last_review: now, reps: 1, stability: 2, difficulty: 5 })),
  )
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 })
  check('пункт закрылся по занятиям', await waitText(page, 'засчитано по занятиям'))
  const overclaims = await seen(page, 'проверено')
  check(
    'формулировка честная — не «проверено»',
    !overclaims,
    overclaims ? 'на экране обещано больше, чем мы можем измерить' : '',
  )

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  if (browser) await browser.close().catch(() => {})
  for (const id of [tId, sId]) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  console.log('Тестовые аккаунты удалены.')
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exit(ok === results.length ? 0 : 1)
}
