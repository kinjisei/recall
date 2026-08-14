/**
 * Смоук: разбор письма просит ФОКУС, а не сплошную разметку.
 *
 * Зачем. Разбор, который метит весь текст, работает хуже направленного: список
 * из двадцати правок не говорит, за что взяться, и вдобавок учит писать проще —
 * безопаснее не рисковать сложной конструкцией, чем снова получить россыпь
 * красного. Проверяем, что в промпт уходит требование выделить 2-3
 * ПОВТОРЯЮЩИХСЯ типа ошибок, и что разбор ставит их первыми, а полный список
 * убирает за раскрывашку.
 *
 * ⚠️ Запрос к AI ПЕРЕХВАТЫВАЕТСЯ: смотрим тело и подсовываем свой ответ. Ни
 * энергии, ни квоты дорогих моделей прогон не тратит — и заодно проверяет
 * разбор на предсказуемых данных, а не на том, что придумает модель.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-writing-focus.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const EMAIL = 'wfocus-student@recall.test'
const PASSWORD = 'WFocus!Smoke2026'

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
const waitText = (page, t, ms = 20000) =>
  page
    .waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms, polling: 250 }, t)
    .then(() => true)
    .catch(() => false)
const tap = async (page, text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role=button], summary')].find(
      (e) => (e.textContent || '').trim().includes(t) && !e.disabled,
    )
    if (el) el.click()
    return !!el
  }, text)
  await sleep(700)
  return ok
}

/** Ответ, который подсовываем вместо модели: три фокуса и много мелких правок. */
const FAKE_GRADE = {
  level: 'B1',
  targetWords: [],
  targetGrammar: [],
  focus: [
    {
      type: 'Артикли перед исчисляемыми',
      why: 'Без артикля фраза читается как обрывок.',
      examples: [
        { was: 'I bought car', fix: 'I bought a car' },
        { was: 'She is doctor', fix: 'She is a doctor' },
      ],
    },
    {
      type: 'Время в придаточных',
      why: 'После past в главном придаточное тоже уходит в past.',
      examples: [{ was: 'He said he is tired', fix: 'He said he was tired' }],
    },
  ],
  errors: Array.from({ length: 12 }, (_, i) => ({
    was: `wrong ${i}`,
    fix: `right ${i}`,
    type: 'grammar',
  })),
  strengths: ['Понятная структура'],
  improve: ['Следить за артиклями'],
  topics: ['Articles'],
  words: ['however'],
  rewrites: [],
}

let uid, browser
try {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  for (const u of list.users.filter((u) => u.email === EMAIL)) {
    await admin.auth.admin.deleteUser(u.id)
  }
  const { data } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  uid = data.user.id
  await admin.from('profiles').update({ display_name: 'Фокус Тестовый', level: 'B1' }).eq('id', uid)
  check('ученик заведён', !!uid)

  const port = 9950 + Math.floor(Math.random() * 40)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('wfocus')}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 40 && !browser; i++) {
    try {
      browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${port}`,
        protocolTimeout: 120000,
      })
    } catch {
      await sleep(500)
    }
  }

  const page = await browser.newPage()
  await page.setViewport({ width: 420, height: 900 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(e.message))

  // ⚠️ Перехват на уровне fetch: запрос к модели не уходит, вместо ответа
  // подставляем свой. Так прогон не стоит ни энергии, ни квоты, а разбор
  // проверяется на предсказуемых данных.
  await page.evaluateOnNewDocument(
    (fake) => {
      try {
        localStorage.setItem('recall.onboarded', '1')
      } catch {}
      window.__aiCalls = []
      const orig = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : (input && input.url) || ''
        if (url.includes('/api/gemini')) {
          window.__aiCalls.push(String((init && init.body) || ''))
          return Promise.resolve(
            new Response(JSON.stringify({ text: JSON.stringify(fake) }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        return orig(input, init)
      }
    },
    FAKE_GRADE,
  )

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 })
  await tap(page, 'Войти')
  await page.type('#f-email', EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000, polling: 250 })

  await page.goto(`${BASE}/writing`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('экран письма открылся', await waitText(page, 'Письменные задания'))

  // Путь человека без преподавателя: «Выбрать тему» → тема → текст → сдать.
  check('можно выбрать тему', await tap(page, 'Выбрать тему'))
  // ⚠️ Заголовок группы набран капсом через CSS — innerText отдаёт его уже
  // преобразованным, поэтому сверяем без учёта регистра.
  const themesShown = await page
    .waitForFunction(
      () => document.body.innerText.toLowerCase().includes('свободные темы'),
      { timeout: 15000, polling: 250 },
    )
    .then(() => true)
    .catch(() => false)
  check('список тем открылся', themesShown)
  check('тема выбрана', await tap(page, 'Работа из дома'))
  // ⚠️ Ждём сам textarea, а не подсказку в нём: placeholder в innerText не
  // попадает, и проверка краснела на исправном экране.
  const editorReady = await page
    .waitForSelector('textarea', { timeout: 20000 })
    .then(() => true)
    .catch(() => false)
  check('редактор открылся', editorReady)

  const area = await page.$('textarea')
  if (area) {
    await area.type(
      'Last summer I bought car and go to sea. She is doctor and he said he is tired.',
    )
  }
  const sent = await tap(page, 'Сдать на проверку')
  check('работа отправлена на разбор', sent)

  await waitText(page, 'Над чем поработать', 25000)

  // ---- 1. промпт просит фокус ----------------------------------------------
  const calls = await page.evaluate(() => window.__aiCalls || [])
  const body = calls.join('\n')
  check('запрос к модели ушёл', calls.length > 0, `запросов: ${calls.length}`)
  // ⚠️ Тело запроса — JSON, кавычки внутри экранированы (\"focus\"), поэтому
  // ищем без них.
  check('в промпте есть поле focus', /focus/.test(body))
  check(
    'сказано: 2-3 ПОВТОРЯЮЩИХСЯ типа, а не все ошибки подряд',
    /2-3 ПОВТОРЯЮЩИХСЯ типа/.test(body),
  )
  check('и что тип — это закономерность, а не опечатка', /НЕ отдельная опечатка/.test(body))
  check('и что повторов должно быть не меньше двух', /НЕ МЕНЕЕ двух раз/.test(body))
  check('полный список ошибок при этом не отменён', /errors/.test(body))

  // ---- 2. экран разбора ставит фокус первым --------------------------------
  // ⚠️ Заголовки разделов набраны капсом через CSS (text-transform), а innerText
  // отдаёт УЖЕ преобразованный текст — сравниваем без учёта регистра, иначе
  // проверка ищет то, чего на экране «нет».
  const txt = await page.evaluate(() => document.body.innerText)
  const low = txt.toLowerCase()
  check('фокус показан', low.includes('над чем поработать в этот раз'))
  check('назван первый тип', /Артикли перед исчисляемыми/.test(txt))
  check('назван второй тип', /Время в придаточных/.test(txt))
  check('у типа есть объяснение', /Без артикля фраза читается как обрывок/.test(txt))
  check('и пример из текста ученика', /I bought car/.test(txt))

  // ⚠️ Главное: двенадцать мелких правок НЕ вывалены на экран — они за
  // раскрывашкой. Иначе фокус тонет в том же списке, ради ухода от которого
  // всё и делалось.
  check('полный список свёрнут', !/wrong 7/.test(txt), 'все правки видны сразу')
  check('но он доступен и подписан числом', low.includes('все правки · 12'))
  check(
    'фокус стоит ВЫШЕ полного списка',
    low.indexOf('над чем поработать') >= 0 &&
      low.indexOf('над чем поработать') < low.indexOf('все правки'),
  )

  await tap(page, 'Показать полный разбор')
  check('по нажатию список раскрывается', await waitText(page, 'wrong 7', 5000))

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  if (browser) await browser.close().catch(() => {})
  if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {})
  console.log('Тестовый аккаунт удалён.')
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
  setTimeout(() => process.exit(process.exitCode ?? 0), 500)
}
