/**
 * Смоук Захода 6: динамика + отчёт родителям, с генерацией НАСТОЯЩЕГО PDF.
 *  1. service_role: учитель + ученица с данными (активность в двух окнах,
 *     слова с расписаниями — одно «выучено» недавно, ошибки грамматики).
 *  2. Headless Edge: вход учителем → карточка ученицы → «Диагностическая
 *     карта» → блок «Динамика за месяц» виден → «🖨 Отчёт для родителей» →
 *     комментарий → page.pdf() → проверка, что PDF не пустой и содержит лист.
 * Запуск: node scripts/smoke-report-pdf.mjs (dev-сервер на 5173).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const T_EMAIL = 'report-teacher@recall.test'
const S_EMAIL = 'report-student@recall.test'
const PASSWORD = 'ReportSmoke!2026'
const PDF_PATH = `${tmpdir()}\\recall-report-smoke.pdf`

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
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function makeUser(email, role, name) {
  await admin.from('allowed_emails').upsert({ email, note: 'report-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === email)?.id
  } else if (error) throw new Error(error.message)
  await admin.from('profiles').update({ role, display_name: name }).eq('id', id)
  return id
}

const dayStr = (nAgo) => {
  const d = new Date(Date.now() - nAgo * 86_400_000)
  return d.toISOString().slice(0, 10)
}
const iso = (nAgo) => new Date(Date.now() - nAgo * 86_400_000).toISOString()

let tId, sId
try {
  tId = await makeUser(T_EMAIL, 'teacher', 'Смоук-Учитель')
  sId = await makeUser(S_EMAIL, 'learner', 'Смоук-Ученица')
  await admin
    .from('teacher_students')
    .upsert({ teacher_id: tId, student_id: sId }, { onConflict: 'teacher_id,student_id' })

  // данные ученицы: активность в двух окнах
  await admin.from('activity_log').insert(
    [1, 3, 5, 35, 40].map((n) => ({
      user_id: sId,
      day: dayStr(n),
      type: 'flashcards',
      items_done: 5,
    })),
  )
  // слова: 2 недавние карточки, одна из них «выучена» месяц-в-окне
  const { data: deck } = await admin
    .from('decks')
    .select('id')
    .eq('owner_id', sId)
    .eq('lang', 'en')
    .limit(1)
    .single()
  const { data: cards } = await admin
    .from('cards')
    .insert([
      { deck_id: deck.id, front: 'harvest', back: 'урожай', source: 'manual' },
      { deck_id: deck.id, front: 'brave', back: 'храбрый', source: 'manual' },
    ])
    .select()
  await admin.from('review_states').insert({
    user_id: sId,
    card_id: cards[0].id,
    state: 'review',
    due: iso(-25), // след. повтор через 25 дней → интервал ≥21 → «выучено»
    last_review: iso(2),
    reps: 6,
    lapses: 0,
    stability: 30,
    difficulty: 5,
  })
  // ошибки грамматики: 2 новых, 1 старая
  await admin.from('grammar_mistakes').insert([
    { user_id: sId, lang: 'en', topic_id: 3, ex: 1, created_at: iso(2) },
    { user_id: sId, lang: 'en', topic_id: 3, ex: 2, created_at: iso(10) },
    { user_id: sId, lang: 'en', topic_id: 7, ex: 1, created_at: iso(40) },
  ])
  console.log('Данные ученицы готовы.')

  // --- браузер ---
  const PORT = 9337
  spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${tmpdir()}\\recall-report-smoke-${Date.now()}`,
      '--no-first-run',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
      .catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1000, height: 900 })
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('recall.onboarded', '1')
      } catch {}
    })

    // вход учителем
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 })
    await page.waitForSelector('#f-password', { timeout: 15000 })
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button[type="button"]')].find(
        (b) => b.textContent.trim() === 'Войти',
      )
      btn?.click()
    })
    await page.type('#f-email', T_EMAIL)
    await page.type('#f-password', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })

    await page.goto(BASE + '/teacher', { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 1500))

    // раскрыть диагностику
    const opened = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        b.textContent.includes('Диагностическая карта'),
      )
      btn?.click()
      return !!btn
    })
    check('кнопка «Диагностическая карта» найдена', opened)
    await page.waitForFunction(
      () => document.body.textContent.includes('Динамика за месяц'),
      { timeout: 15000 },
    )
    const trendOk = await page.evaluate(
      () =>
        document.body.textContent.includes('Дней с занятиями') &&
        document.body.textContent.includes('Новых ошибок грамматики'),
    )
    check('блок «Динамика за месяц» отрисован', trendOk)

    // открыть отчёт, вписать комментарий
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        b.textContent.includes('Отчёт для родителей'),
      )
      btn?.click()
    })
    await page.waitForSelector('.print-sheet textarea', { timeout: 10000 })
    await page.type('.print-sheet textarea', 'Занимаемся стабильно, виден прогресс в лексике.')
    const sheetOk = await page.evaluate(
      () =>
        document.querySelector('.print-sheet') !== null &&
        document.body.textContent.includes('Отчёт о занятиях') &&
        document.body.textContent.includes('Смоук-Ученица'),
    )
    check('лист отчёта открыт (имя и шапка на месте)', sheetOk)

    // настоящий PDF: print media применит @media print (#root скрыт)
    await page.emulateMediaType('print')
    await page.pdf({ path: PDF_PATH, format: 'A4', printBackground: true })
    const size = statSync(PDF_PATH).size
    check('PDF сгенерирован и не пустой (>10КБ)', size > 10_000, `${Math.round(size / 1024)}КБ`)
  } finally {
    await browser.close().catch(() => {})
  }
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of [tId, sId]) {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  try {
    await admin.from('allowed_emails').delete().in('email', [T_EMAIL, S_EMAIL])
  } catch {
    /* некритично */
  }
  console.log('Тестовые аккаунты удалены. PDF:', PDF_PATH)
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
