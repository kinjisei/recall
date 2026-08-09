/**
 * Смоук обратной связи.
 *
 * Зачем. Сообщить нам что-либо человек не мог вообще — ни ученик, ни
 * репетитор. Это первая версия канала, и молча сломаться он не должен:
 * отзыв, который «отправился» и не дошёл, хуже отсутствия кнопки.
 *
 * Проверяет весь путь: кнопка в меню → шторка → отправка → запись в базе →
 * чтение владельцем через admin_feedback.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-feedback.mjs`.
 * Аккаунт создаётся и удаляется сам (service_role из .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const EMAIL = 'feedback-smoke@recall.test'
const PASSWORD = 'FbSmoke!2026'
const MARK = 'проба смоука ' + Date.now()

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
const tap = async (page, text, sel = 'button, a, [role=button], [role=menuitem]') => {
  const ok = await page.evaluate(
    (s, t) => {
      const el = [...document.querySelectorAll(s)].find((e) =>
        (e.textContent || '').trim().includes(t),
      )
      if (el) el.click()
      return !!el
    },
    sel,
    text,
  )
  await sleep(800)
  return ok
}

async function main() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'feedback-smoke (временный)' })
  const { data: cu, error: cuErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (cuErr && !/already/i.test(cuErr.message)) throw new Error(cuErr.message)
  let userId = cu?.user?.id ?? null
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!userId) throw new Error('не удалось создать тестовый аккаунт')
  await admin.from('activity_log').upsert(
    { user_id: userId, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${process.env.TEMP}\\fb-smoke-${Date.now()}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 })
      .catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  const page = await browser.newPage()
  await page.bringToFront()
  await page.setViewport({ width: 390, height: 844 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await tap(page, 'Войти')
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4500)

  // ---- 1. кнопка есть в меню под аватаром --------------------------------
  const menuOpened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.getAttribute('aria-label') || '') === 'Меню профиля',
    )
    if (b) b.click()
    return !!b
  })
  await sleep(600)
  check('меню профиля открывается', menuOpened)
  const hasEntry = await page.evaluate(() =>
    [...document.querySelectorAll('[role=menuitem]')].some((x) =>
      (x.textContent || '').includes('Оставить отзыв'),
    ),
  )
  check('в меню есть «Оставить отзыв»', hasEntry)

  // ---- 2. шторка открывается и требует содержания -------------------------
  await tap(page, 'Оставить отзыв')
  const sheet = await page.evaluate(() => ({
    title: (document.body.innerText || '').includes('Как тебе Recall?'),
    // пустой отзыв отправить нельзя
    disabled: [...document.querySelectorAll('button')].some(
      (b) => (b.textContent || '').trim() === 'Отправить' && b.disabled,
    ),
    thumbs: document.querySelectorAll('[aria-label="Нравится"], [aria-label="Не нравится"]').length,
  }))
  check('шторка открылась', sheet.title)
  check('пустой отзыв отправить нельзя', sheet.disabled)
  check('обе оценки на месте', sheet.thumbs === 2, String(sheet.thumbs))

  // ---- 3. отправляем ------------------------------------------------------
  await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Не нравится"]')
    if (b) b.click()
  })
  await page.type('#fb-text', MARK)
  await page.type('#fb-contact', '@smoke')
  await sleep(300)
  await tap(page, 'Отправить')
  // ⚠️ ждём подтверждение, а не «полторы секунды»: отправка идёт по сети, и
  // фиксированная пауза давала мигающую проверку на медленном ответе
  const thanks = await page
    .waitForFunction(() => (document.body.innerText || '').includes('Спасибо, дошло'), {
      timeout: 10000,
      polling: 200,
    })
    .then(() => true)
    .catch(() => false)
  check('показано подтверждение', thanks)

  // ---- 4. запись реально в базе ------------------------------------------
  const { data: rows } = await admin
    .from('events')
    .select('name, props, user_id')
    .eq('name', 'feedback')
    .eq('user_id', userId)
  const row = (rows ?? [])[0]
  check('отзыв записан в базу', !!row, `строк: ${(rows ?? []).length}`)
  check('текст сохранён целиком', row?.props?.text === MARK, String(row?.props?.text).slice(0, 40))
  check('оценка сохранена', row?.props?.rating === 'down', String(row?.props?.rating))
  check('контакт сохранён', row?.props?.contact === '@smoke', String(row?.props?.contact))
  check('видно, с какого экрана', row?.props?.where === 'menu', String(row?.props?.where))

  // ---- 5. владелец читает через RPC --------------------------------------
  const { error: rpcErr } = await admin.rpc('admin_feedback', { p_days: 1, p_limit: 5 })
  if (rpcErr && /Could not find the function|PGRST202/i.test(rpcErr.message)) {
    console.log('\n⏭ admin_feedback ещё не залита — блок отзывов в /admin покажет это текстом.')
  } else {
    // под service_role auth.uid() пуст, поэтому ждём именно отказ по правам:
    // это доказывает, что функция есть и проверку админа делает
    check(
      'посторонний отзывы не читает',
      /RECALL_NOT_ADMIN/.test(rpcErr?.message ?? ''),
      rpcErr?.message ?? 'без ошибки',
    )

    // И главное: НАСТОЯЩИЙ владелец отзыв действительно видит. Без этой
    // проверки было бы доказано только, что функция отказывает чужим, — а то,
    // ради чего её заливали, осталось бы непроверенным.
    const adminEmail = 'fb-admin-smoke@recall.test'
    await admin.from('allowed_emails').upsert({ email: adminEmail, note: 'feedback-smoke (временный)' })
    const { data: au } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: PASSWORD,
      email_confirm: true,
    })
    let adminId = au?.user?.id ?? null
    if (!adminId) {
      const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
      adminId = l.users.find((u) => (u.email ?? '').toLowerCase() === adminEmail)?.id ?? null
    }
    // is_admin ставится ТОЛЬКО так: колонка закрыта грантами от пользователя
    await admin.from('profiles').update({ is_admin: true }).eq('id', adminId)

    const asAdmin = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await asAdmin.auth.signInWithPassword({ email: adminEmail, password: PASSWORD })
    const { data: fb, error: fbErr } = await asAdmin.rpc('admin_feedback', { p_days: 1, p_limit: 50 })
    const list = Array.isArray(fb) ? fb : []
    check('владелец читает отзывы', !fbErr, fbErr?.message ?? `записей: ${list.length}`)
    check(
      'наш отзыв виден владельцу целиком',
      list.some((r) => r.text === MARK && r.rating === 'down' && r.contact === '@smoke'),
      list[0] ? JSON.stringify(list[0]).slice(0, 80) : 'пусто',
    )

    await admin.auth.admin.deleteUser(adminId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', adminEmail)
  }

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')

  await browser.close()
  await admin.from('events').delete().eq('user_id', userId)
  await admin.auth.admin.deleteUser(userId).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
  console.log('Тестовый аккаунт и его события удалены.')

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

main().catch((e) => {
  console.error('Смоук упал:', e)
  process.exitCode = 1
})
