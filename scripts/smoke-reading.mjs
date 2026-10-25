/**
 * Смоук чтения по макету d6 (PLAN.md Ф2.17-4д-4в):
 *  1. компьютер 1280, текст «Small habits, big changes»: сверху «‹ Тексты» и
 *     «Слушать текст»; справа панель-подсказка «Нажми на любое слово…»;
 *  2. нажатие на слово — перевод в панели справа, а не шторкой; текст не
 *     сдвинулся; слово в рамке; «В мои слова» есть;
 *  3. «habits» словарь не знает — транскрипция и часть речи от «habit»;
 *     «В мои слова» — карточка «habit» с её транскрипцией, слово пунктиром;
 *  4. «×» в панели — снова подсказка и «Сохранено из этого текста»;
 *  5. «Слушать текст» → «Стоп» и обратно;
 *  6. телефон 390: нажатие на слово — перевод шторкой снизу.
 * Ответы AI и словаря подменяются в браузере (перевод «привычка»): смоук не
 * тратит энергию и не зависит от ключа AI и сети. Аккаунт создаётся и удаляется сам
 * (тестовая база, `npm run dev:test`). Без экрана d6 — ✗ (проверено на коде
 * до 4д-4в).
 */
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунт — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const EMAIL = `reading-smoke-${Date.now()}@recall.test`
const PASSWORD = 'ReadingSmoke!2026'
const PATH = '/study?view=reader&text=b1-habits'
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra && !ok ? ` — ${extra}` : ''}`)
}
const waitFor = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 200 }, arg).then(() => true, () => false)

async function openPage(browser, width) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport(width < 600 ? { width, height: 844, isMobile: true, hasTouch: true } : { width, height: 800 })
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('recall.onboarded', '1')
      localStorage.setItem('recall.lang', 'en')
    } catch {
      /* about:blank */
    }
    // AI не зовём: перевод в контексте — готовым ответом. Словарь — тоже
    // подменой, как настоящий: «habit» знает, формы «habits» — нет (404)
    const orig = window.fetch
    const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
    const HABIT = [{ word: 'habit', phonetic: '/ˈhæbɪt/', phonetics: [], meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A regular practice.', example: 'Smoking is a bad habit.' }] }] }]
    window.fetch = (input, init) => {
      const url = String(input?.url ?? input)
      if (url.includes('/api/gemini')) return json({ text: '{"base":"habit","translation":"привычка","note":""}' })
      if (url.includes('dictionaryapi.dev')) return url.endsWith('/habit') ? json(HABIT) : json({ title: 'No Definitions Found' }, 404)
      return orig(input, init)
    }
  })
  await page.goto(APP_URL + '/login', { waitUntil: 'networkidle2' })
  await page.waitForSelector('#f-password', { timeout: 15000 })
  await page.evaluate(() => [...document.querySelectorAll('button[type="button"]')].find((b) => b.textContent.trim() === 'Войти')?.click())
  await page.type('#f-email', EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 })
  await page.goto(APP_URL + PATH, { waitUntil: 'networkidle2' })
  await waitFor(page, () => document.body.innerText.includes('Small habits'), null, 15000)
  return page
}

/** Нажать слово текста и вернуть, где была первая строка текста до нажатия. */
const tapWord = (page, word) =>
  page.evaluate((w) => {
    const spans = [...document.querySelectorAll('main span.cursor-pointer')]
    const before = spans[0]?.getBoundingClientRect().left ?? null
    spans.find((s) => s.textContent.replace(/[^A-Za-z]/g, '') === w)?.click()
    return before
  }, word)

let userId = null
let browser = null
try {
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(error.message)
  userId = data.user.id

  const PORT = 9500 + Math.floor(Math.random() * 300)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('smoke-reading')}`, '--no-first-run', 'about:blank'], {
    detached: true,
    stdio: 'ignore',
  }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  // ── 1–4. компьютер ─────────────────────────────────────────────────────────
  const desk = await openPage(browser, 1280)
  const top = await desk.evaluate(() => ({
    back: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Тексты'),
    listen: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Слушать текст')),
    hint: document.querySelector('aside[aria-label="Перевод"]')?.textContent.includes('Нажми на любое слово') ?? false,
  }))
  check('компьютер: «‹ Тексты», «Слушать текст» и панель-подсказка справа (d6-1)', Object.values(top).every(Boolean), JSON.stringify(top))

  const before = await tapWord(desk, 'habits')
  const panel = await waitFor(desk, () => {
    const a = document.querySelector('aside[aria-label="Перевод"]')
    return !!a && a.textContent.includes('привычка') && a.textContent.includes('В мои слова')
  })
  const after = await desk.evaluate(() => ({
    sheet: !!document.querySelector('[role="dialog"]'),
    left: document.querySelector('main span.cursor-pointer')?.getBoundingClientRect().left ?? null,
    ring: [...document.querySelectorAll('main span.cursor-pointer')].some((s) => s.className.includes('ring-2')),
  }))
  check('нажатие на слово — перевод в панели справа, без шторки (d6-2)', panel && !after.sheet, JSON.stringify({ panel, sheet: after.sheet }))
  check('текст не сдвинулся, слово в рамке', before !== null && after.left === before && after.ring, JSON.stringify({ before, after: after.left, ring: after.ring }))

  // словарь не знает «habits» — транскрипция и часть речи по начальной форме
  const facts = await waitFor(desk, () => {
    const t = document.querySelector('aside[aria-label="Перевод"]')?.textContent ?? ''
    return t.includes('ˈhæbɪt') && t.includes('существительное')
  })
  check('слово в другой форме: транскрипция и часть речи начальной («habits» → habit)', facts)

  // «В мои слова» → карточка начальной формы с её транскрипцией; слово — пунктиром
  await desk.evaluate(() => [...document.querySelectorAll('aside[aria-label="Перевод"] button')].find((b) => b.textContent.includes('В мои слова'))?.click())
  const addedOk = await waitFor(desk, () => document.querySelector('aside[aria-label="Перевод"]')?.textContent.includes('Добавлено') ?? false)
  const { data: decks } = await admin.from('decks').select('id').eq('owner_id', userId)
  const { data: cards } = await admin.from('cards').select('front, ipa').in('deck_id', (decks ?? []).map((d) => d.id))
  const card = cards?.find((c) => c.front === 'habit')
  const dotted = await desk.evaluate(() =>
    [...document.querySelectorAll('main span.cursor-pointer')].some((s) => s.textContent.replace(/[^A-Za-z]/g, '') === 'habit' && s.className.includes('decoration-dotted')),
  )
  check('«В мои слова»: карточка «habit» с её транскрипцией, слово в тексте — пунктиром', addedOk && card?.ipa === 'ˈhæbɪt' && dotted, JSON.stringify({ addedOk, card, dotted }))

  await desk.click('button[aria-label="Закрыть перевод"]')
  const hint = await waitFor(desk, () => {
    const t = document.querySelector('aside[aria-label="Перевод"]')?.textContent ?? ''
    return t.includes('Нажми на любое слово') && t.includes('Сохранено из этого текста') && t.includes('привычка')
  })
  check('«×» — снова подсказка, сохранённое слово — в «Сохранено из этого текста»', hint)

  await desk.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Слушать текст'))?.click())
  const stop = await waitFor(desk, () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Стоп'), null, 3000)
  await desk.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Стоп')?.click())
  const back = await waitFor(desk, () => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Слушать текст')), null, 3000)
  check('«Слушать текст» → «Стоп» → снова «Слушать текст»', stop && back, JSON.stringify({ stop, back }))

  // ── 5. телефон ─────────────────────────────────────────────────────────────
  const phone = await openPage(browser, 390)
  await tapWord(phone, 'habits')
  const sheet = await waitFor(phone, () => {
    const d = document.querySelector('[role="dialog"]')
    return !!d && d.textContent.includes('привычка')
  })
  const noAside = await phone.evaluate(() => !document.querySelector('aside[aria-label="Перевод"]'))
  check('телефон: перевод шторкой снизу, панели сбоку нет', sheet && noAside, JSON.stringify({ sheet, noAside }))
} catch (e) {
  check('смоук дошёл до конца', false, e instanceof Error ? e.message : String(e))
} finally {
  await browser?.close().catch(() => {})
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
}

const passed = results.filter(Boolean).length
console.log(`\nИтог: ${passed}/${results.length}`)
process.exitCode = passed === results.length ? 0 : 1
