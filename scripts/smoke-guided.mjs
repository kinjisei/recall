/**
 * Смоук ведомой сессии «Начать занятие».
 *
 * Зачем. Сессия хранит шаг в sessionStorage, а переключается он только когда
 * раунд доведён до конца. Бросил на середине — шаг оставался прежним, и КАЖДЫЙ
 * вход в «Практику» снова кидал в повторение; нижней навигации в раунде нет,
 * выйти можно только кареткой. Человек, решивший заняться другим, упирался в
 * это бесконечно, а симптом выглядел плавающим: закрыл вкладку — sessionStorage
 * очистился, и «сегодня уже не воспроизводится».
 *
 * Проверяем ровно то, что чинили: увести должно РОВНО ОДИН РАЗ — и в
 * «Практике» (шаг flashcards), и в «Учёбе» (шаг reader). Это один класс, и
 * разъехаться они не должны.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-guided.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const EMAIL = 'guided-smoke@recall.test'
const PASSWORD = 'Guided!2026'

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
const tap = async (page, text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role=button]')].find((e) =>
      (e.textContent || '').trim().includes(t),
    )
    if (el) el.click()
    return !!el
  }, text)
  await sleep(900)
  return ok
}
/** Мы сейчас в раунде повторения? Заголовок экрана — самый честный признак. */
const inReview = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('h1')].some((h) => (h.textContent || '').trim() === 'Повторение'),
  )

async function main() {
  let browser = null
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'guided-smoke (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let userId = cu?.user?.id ?? null
  if (!userId) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = l.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!userId) throw new Error('не создан аккаунт')

  // ⚠️ Слова обязательны: без них сессия ЗАКОННО пропускает повторение и уводит
  // на чтение (skipReviewIfNoWords). Без этой строки смоук проверял бы не то.
  const { data: deck } = await admin
    .from('decks')
    .select('id')
    .eq('owner_id', userId)
    .eq('lang', 'en')
    .limit(1)
    .single()
  await admin.from('cards').insert([
    { deck_id: deck.id, front: 'whisper', back: 'шептать', source: 'manual' },
    { deck_id: deck.id, front: 'harvest', back: 'урожай', source: 'manual' },
  ])
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
      `--user-data-dir=${process.env.TEMP}\\guided-${Date.now()}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 })
      .catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  const page = await browser.newPage()
  await page.bringToFront()
  await page.setViewport({ width: 420, height: 900 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await tap(page, 'Войти')
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4500)

  // ---- 1. «Начать занятие» действительно уводит в повторение ---------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await page
    .waitForFunction(() => /Начать занятие/.test(document.body.innerText || ''), {
      timeout: 15000,
      polling: 300,
    })
    .catch(() => {})
  const started = await tap(page, 'Начать занятие')
  const gotReview = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('h1')].some(
          (h) => (h.textContent || '').trim() === 'Повторение',
        ),
      { timeout: 15000, polling: 300 },
    )
    .then(() => true)
    .catch(() => false)
  check('«Начать занятие» уводит в повторение', started && gotReview)

  // ---- 2. вышли кареткой — и «Практика» больше НЕ перехватывает ------------
  // Каретка ведёт в хаб «Практики» (setMode('hub')).
  const leftRound = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.getAttribute('aria-label') || '') === 'Назад',
    )
    if (b) b.click()
    return !!b
  })
  await sleep(1200)
  check('из раунда можно выйти кареткой', leftRound && !(await inReview(page)))

  // уходим на Главную и возвращаемся — именно здесь ловушка и захлопывалась
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  const hijacked = await inReview(page)
  check(
    'повторный вход в «Практику» НЕ уводит в повторение',
    !hijacked,
    hijacked ? 'снова перехватило' : (await page.evaluate(() => location.search)) || 'хаб',
  )
  // ⚠️ Не по слову «Повторение»: так называется и заголовок самого раунда,
  // из-за чего проверка оставалась зелёной даже когда перехват срабатывал
  // (поймано мутационным прогоном). Спрашиваем то, что есть ТОЛЬКО в хабе:
  // карточки свёрнутых разделов.
  const groupCards = await page.evaluate(
    () =>
      [...document.querySelectorAll('button')].filter((b) =>
        ['Слова', 'Грамматика', 'Речь', 'Повторение'].includes((b.textContent || '').trim()),
      ).length,
  )
  check('в «Практике» видны карточки разделов, а не раунд', groupCards >= 3, `карточек: ${groupCards}`)

  // ---- 3. тот же класс в «Учёбе»: шаг reader тоже уводит один раз ----------
  // Эмулируем продвинувшуюся сессию: шаг reader, право на автопереход есть.
  await page.evaluate(() => {
    sessionStorage.setItem('recall.guided', 'reader')
    sessionStorage.removeItem('recall.guided.opened')
  })
  await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
  const openedReader = await page
    .waitForFunction(() => /view=reader/.test(location.search), { timeout: 15000, polling: 300 })
    .then(() => true)
    .catch(() => false)
  check('«Учёба» открывает чтение на шаге reader', openedReader)

  // возвращаемся к хабу «Учёбы» и заходим снова
  await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  const readerAgain = await page.evaluate(() => /view=reader/.test(location.search))
  check('повторный вход в «Учёбу» НЕ уводит в чтение', !readerAgain)

  // ---- 4. новая сессия снова имеет право увести ----------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await page
    .waitForFunction(() => /Начать занятие/.test(document.body.innerText || ''), {
      timeout: 15000,
      polling: 300,
    })
    .catch(() => {})
  await tap(page, 'Начать занятие')
  const againToReview = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('h1')].some(
          (h) => (h.textContent || '').trim() === 'Повторение',
        ),
      { timeout: 15000, polling: 300 },
    )
    .then(() => true)
    .catch(() => false)
  check('новая сессия снова уводит в повторение', againToReview)

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')

  await browser.close()
  await admin.auth.admin.deleteUser(userId).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
  console.log('Тестовый аккаунт удалён (колоды и карточки ушли каскадом).')

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

main()
  .catch((e) => {
    console.error('Смоук упал:', e)
    process.exitCode = 1
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 500))
