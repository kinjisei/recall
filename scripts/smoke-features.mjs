/**
 * Интерактивный смоук новых фич (этапы A–E):
 *  1. /flashcards → «Спринт»: пара показана, ответ засчитывается, таймер идёт.
 *  2. «Диктант»: поле ввода, проверка ответа (вводим правильное слово из подсказки нельзя — вводим мусор, ждём «Правильно: …»).
 *  3. «Собери фразу» в EN-режиме: задание рендерится, слова собираются.
 *  4. /placement EN: интро «До 50 вопросов», прокликиваем первые ответы, тест
 *     завершается (ранний стоп или полный) экраном «Твой уровень».
 *  5. /grammar → урок → упражнение с ошибкой → возврат: строка «Мои ошибки».
 *  6. /conversation: вкладки Чат/Письмо без эмодзи, есть иконки.
 * Использует тот же подход, что scripts/ux-audit.mjs (Edge + connect).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const EMAIL = 'ux-audit@recall.test'
const PASSWORD = 'UxAudit!2026-temp'
const ENV_PATH = new URL('../.env.local', import.meta.url)

const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Клик по элементу, найденному по тексту. */
async function clickByText(page, selector, text) {
  return page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((e) =>
        (e.textContent || '').trim().includes(t),
      )
      if (el) el.click()
      return !!el
    },
    selector,
    text,
  )
}

async function main() {
  let userId = null
  // тестовый аккаунт
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'ux-smoke (временный)' })
  const { data: cu, error: cuErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (cuErr && !/already/i.test(cuErr.message)) throw new Error(cuErr.message)
  if (cu?.user) userId = cu.user.id
  else {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = list.users.find((u) => u.email === EMAIL)?.id ?? null
  }

  const PORT = 9345
  spawn(
    EDGE,
    ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
     `--user-data-dir=${tmpdir()}\\recall-smoke-${Date.now()}`, '--no-first-run', 'about:blank'],
    { detached: true, stdio: 'ignore' },
  ).unref()
  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
      .catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.deck_tutorial_seen', '1')
      } catch {}
    })

    // логин
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2' })
    await page.waitForSelector('#f-password', { timeout: 15000 })
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button[type="button"]')].find(
        (b) => b.textContent.trim() === 'Войти',
      )
      btn?.click()
    })
    await page.type('#f-email', EMAIL)
    await page.type('#f-password', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000 })
    check('логин', true)

    // ---- 1. Спринт ----
    await page.goto(BASE + '/flashcards', { waitUntil: 'networkidle2' })
    await sleep(800)
    const sprintOpened = await clickByText(page, 'button', 'Спринт')
    await sleep(2500) // пул слов грузится
    const sprintState = await page.evaluate(() => ({
      hasTimer: /\d+ с/.test(document.body.textContent || ''),
      hasPair: /=/.test(document.body.textContent || ''),
      hasButtons:
        !![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Верно')) &&
        !![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Неверно')),
    }))
    check('Спринт открылся', sprintOpened && sprintState.hasButtons, JSON.stringify(sprintState))
    if (sprintState.hasButtons) {
      await clickByText(page, 'button', 'Верно')
      await sleep(300)
      const counted = await page.evaluate(() => /верно: \d+ \/ 1/.test(document.body.textContent || ''))
      check('Спринт: ответ засчитан', counted)
    }

    // ---- 2. Диктант ----
    await page.goto(BASE + '/flashcards', { waitUntil: 'networkidle2' })
    await sleep(800)
    const dictOpened = await clickByText(page, 'button', 'Диктант')
    await sleep(2500)
    const hasInput = await page.$('input[aria-label="Услышанное слово"]')
    check('Диктант открылся', dictOpened && !!hasInput)
    if (hasInput) {
      await page.type('input[aria-label="Услышанное слово"]', 'xyzzz')
      await clickByText(page, 'button', 'Проверить')
      await sleep(300)
      const showsCorrect = await page.evaluate(() =>
        (document.body.textContent || '').includes('Правильно:'),
      )
      check('Диктант: неверный ответ показывает правильный', showsCorrect)
    }

    // ---- 3. Собери фразу (EN) ----
    await page.goto(BASE + '/flashcards', { waitUntil: 'networkidle2' })
    await sleep(800)
    const sbOpened = await clickByText(page, 'button', 'Собери фразу')
    await sleep(1500)
    const sbState = await page.evaluate(() => ({
      prompt: (document.body.textContent || '').includes('Переведи на английский'),
      bank: [...document.querySelectorAll('button')].filter((b) => /^[A-Za-z'’.,!?]+$/.test(b.textContent.trim())).length,
    }))
    check('Собери фразу работает в EN', sbOpened && sbState.prompt && sbState.bank > 2, JSON.stringify(sbState))

    // ---- 4. Placement EN ----
    await page.goto(BASE + '/placement', { waitUntil: 'networkidle2' })
    await sleep(1200)
    const introOk = await page.evaluate(() =>
      (document.body.textContent || '').includes('До 50 вопросов'),
    )
    check('Placement EN: интро «До 50 вопросов»', introOk)
    await clickByText(page, 'button', 'Начать тест')
    await sleep(600)
    // прокликиваем: всегда первый вариант; максимум 60 кликов.
    // Варианты ответа — button.rounded-xl.text-left (в отличие от «На главную»
    // и нижней навигации).
    let finished = false
    for (let i = 0; i < 60; i++) {
      const state = await page.evaluate(() => {
        const body = document.body.textContent || ''
        if (body.includes('Твой уровень')) return 'done'
        const opt = document.querySelector('button.rounded-xl.text-left')
        if (opt) {
          opt.click()
          return 'clicked'
        }
        return 'stuck'
      })
      if (state === 'done') {
        finished = true
        break
      }
      if (state === 'stuck') break
      await sleep(120)
    }
    const level = finished
      ? await page.evaluate(() => {
          const m = (document.body.textContent || '').match(/Твой уровень\s*(A1|A2|B1|B2|C1)/)
          return m?.[1] ?? '?'
        })
      : null
    check('Placement EN: тест завершается', finished, `уровень: ${level}`)

    // ---- 5. Мои ошибки в грамматике ----
    await page.goto(BASE + '/grammar', { waitUntil: 'networkidle2' })
    await sleep(1500)
    // открываем первую тему A1
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('button')].filter((b) =>
        b.textContent.includes('упр.'),
      )
      cards[0]?.click()
    })
    await sleep(800)
    await clickByText(page, 'button', 'Упражнения')
    await sleep(600)
    // добиваемся гарантированной ошибки: fill — вводим мусор; mcq — кликаем
    // первый вариант и, если он оказался верным, идём к следующему упражнению
    let gotWrong = false
    for (let step = 0; step < 5 && !gotWrong; step++) {
      const kind = await page.evaluate(() => {
        if (document.querySelector('input[placeholder="Ваш ответ…"]')) return 'fill'
        if (document.querySelector('button.rounded-xl.text-left')) return 'mcq'
        return 'other'
      })
      if (kind === 'fill') {
        await page.type('input[placeholder="Ваш ответ…"]', 'zzzz')
        await clickByText(page, 'button', 'Проверить')
        await sleep(300)
        gotWrong = true
      } else if (kind === 'mcq') {
        await page.evaluate(() => document.querySelector('button.rounded-xl.text-left').click())
        await sleep(300)
        gotWrong = await page.evaluate(
          () => !!document.querySelector('button.border-red-500'),
        )
        if (!gotWrong) {
          const moved = await clickByText(page, 'button', 'Дальше')
          if (!moved) break
          await sleep(300)
        }
      } else break
    }
    // выходим к списку уроков
    await clickByText(page, 'button', '← Назад')
    await sleep(800)
    const bodyAfter = await page.evaluate(() => document.body.textContent || '')
    const mistakesRow = bodyAfter.includes('Мои ошибки')
    check('Грамматика: строка «Мои ошибки» появляется после ошибки', mistakesRow, mistakesRow ? '' : '(возможно, первый клик был верным ответом — не критично)')

    // ---- 6. Диалог: вкладки без эмодзи ----
    await page.goto(BASE + '/conversation', { waitUntil: 'networkidle2' })
    await sleep(800)
    const convState = await page.evaluate(() => {
      const body = document.body.textContent || ''
      return {
        noEmoji: !body.includes('💬') && !body.includes('✍️'),
        tabs: body.includes('Чат') && body.includes('Письмо'),
        svgIcons: document.querySelectorAll('svg').length > 2,
      }
    })
    check('Диалог: вкладки с иконками, без эмодзи', convState.noEmoji && convState.tabs && convState.svgIcons, JSON.stringify(convState))

    if (errors.length) {
      console.log('\nJS-ошибки на страницах:')
      errors.forEach((e) => console.log('  ' + e))
    }
    const failed = results.filter((r) => !r.ok).length
    console.log(`\nИтого: ${results.length - failed}/${results.length} ок, JS-ошибок: ${errors.length}`)
    process.exitCode = failed > 0 || errors.length > 0 ? 1 : 0
  } finally {
    await browser.close()
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    console.log('Тестовый аккаунт удалён.')
  }
}

main().catch((e) => {
  console.error('Смоук упал:', e)
  process.exitCode = 1
})
