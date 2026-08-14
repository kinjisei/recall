/**
 * Смоук: задание с тремя типами упражнений и разбор ошибок у ученика.
 *
 * Проверяет две вещи, которых раньше не было:
 *  1. «Собери предложение» (order) доходит до ученика. Движок и сервер его
 *     считали всегда, а фильтр в lib/materials молча выбрасывал — из трёх типов
 *     в заданиях работало два, и задания были однообразными.
 *  2. После работы есть разбор с кнопкой «Почему?». В практике объяснение
 *     ошибки было, в заданиях преподавателя — нет: ученик видел «неверно» и
 *     правильный ответ, но не узнавал, чем плох его собственный.
 *
 * Материал кладём в базу напрямую (service_role): генерация стоила бы дорогой
 * модели и месячного лимита, а проверяем мы не её, а путь ученика.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-assignment-review.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const T_EMAIL = 'asgn-teacher@recall.test'
const S_EMAIL = 'asgn-student@recall.test'
const PASSWORD = 'Asgn!2026'

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
const tap = async (page, text, exact = false) => {
  const ok = await page.evaluate(
    (t, ex) => {
      const el = [...document.querySelectorAll('button, a, [role=button]')].find((e) => {
        const txt = (e.textContent || '').trim()
        return ex ? txt === t : txt.includes(t)
      })
      if (el) el.click()
      return !!el
    },
    text,
    exact,
  )
  await sleep(800)
  return ok
}
const seen = (page, t) => page.evaluate((x) => (document.body.innerText || '').includes(x), t)

async function makeUser(email, patch) {
  await admin.from('allowed_emails').upsert({ email, note: 'asgn-smoke (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = cu?.user?.id ?? null
  if (!id) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = l.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id ?? null
  }
  if (!id) throw new Error('не создан ' + email)
  if (patch) await admin.from('profiles').update(patch).eq('id', id)
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  return id
}

async function main() {
  let browser = null
  const teacherId = await makeUser(T_EMAIL, { role: 'teacher', display_name: 'Педагог' })
  const studentId = await makeUser(S_EMAIL, { display_name: 'Айгерим', level: 'A2' })
  await admin.from('teacher_students').upsert(
    { teacher_id: teacherId, student_id: studentId, seat: true },
    { onConflict: 'teacher_id,student_id' },
  )

  // материал с ТРЕМЯ типами упражнений
  const { data: mat, error: matErr } = await admin
    .from('materials')
    .insert({
      teacher_id: teacherId,
      lang: 'en',
      level: 'A2',
      topic: 'Утро',
      format: 'рассказ',
      length_range: '50-100',
      title: 'My morning',
      body: 'I get up at seven. I go home every day after work. Mornings are quiet.',
      exercises: [
        { kind: 'comprehension', type: 'mcq', prompt: 'When does he get up?', options: ['at six', 'at seven'], answer: 1 },
        { kind: 'grammar', type: 'fill', prompt: 'I ___ up at seven.', answer: 'get' },
        {
          kind: 'grammar',
          type: 'order',
          prompt: 'Я хожу домой каждый день',
          words: ['home', 'I', 'day', 'go', 'every'],
          answer: ['I', 'go', 'home', 'every', 'day'],
        },
      ],
    })
    .select('id')
    .single()
  if (matErr) throw new Error('материал не создан: ' + matErr.message)
  await admin.from('material_assignments').insert({ material_id: mat.id, student_id: studentId })

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('asgn')}`,
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
  await page.type('input[type=email]', S_EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4500)

  await page.goto(`${BASE}/assignments`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  check('задание видно ученику', await seen(page, 'My morning'))
  await tap(page, 'My morning')
  await tap(page, 'К упражнениям')

  // 1. выбор варианта — отвечаем НЕВЕРНО, чтобы было что разбирать
  //
  // ⚠️ Здесь же проверяется САМОКОРРЕКЦИЯ: после первой ошибки правильный
  // вариант НЕ подсвечивается и «Дальше» не появляется — сперва подсказка и
  // вторая попытка. Готовый ответ, выданный сразу, закрывает работу.
  await tap(page, 'at six', true)
  // ⚠️ Ищем общий признак подсказки, а не конкретный текст: при двух вариантах
  // он другой («Остался один вариант»), и узкая проверка краснела на исправном
  // коде.
  check('после ошибки в выборе есть подсказка', await seen(page, 'Попробуй ещё раз'))
  check(
    'и «Дальше» пока не предлагается',
    !(await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((b) =>
        (b.textContent || '').includes('Дальше'),
      ),
    )),
  )
  check('и есть выход для застрявшего', await seen(page, 'Показать ответ'))
  await tap(page, 'Показать ответ')
  await tap(page, 'Дальше')

  // 2. вписывание — тоже неверно
  await page.type('input[placeholder*="ответ"]', 'zzz')
  await tap(page, 'Проверить')
  check(
    'после ошибки во вписывании ответ НЕ показан',
    !(await seen(page, 'Верный ответ')),
  )
  check('зато сказано, где ошибка', await seen(page, 'Попробуй ещё раз'))
  await tap(page, 'Показать ответ')
  check('по кнопке ответ появляется', await seen(page, 'Верный ответ'))
  await tap(page, 'Дальше')

  // 3. сборка предложения — тот самый третий тип
  const bank = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .map((b) => (b.textContent || '').trim())
      .filter((t) => ['home', 'I', 'day', 'go', 'every'].includes(t)),
  )
  check(
    '«Собери предложение» дошло до ученика',
    bank.length === 5,
    `слов в банке: ${bank.length}`,
  )
  // собираем в заведомо неверном порядке — банк всё равно надо израсходовать
  for (const w of ['home', 'I', 'day', 'go', 'every']) await tap(page, w, true)
  await tap(page, 'Проверить')
  check('после ошибки в сборке правильный порядок НЕ показан', !(await seen(page, 'Правильно:')))
  await tap(page, 'Показать ответ')
  await tap(page, 'Завершить')
  await sleep(2500)

  // ---- разбор ------------------------------------------------------------
  check('итог работы показан', await seen(page, 'Работа отправлена'))
  const hasReview = await seen(page, 'Посмотреть результаты')
  check('в задании появился разбор ответов', hasReview)

  if (hasReview) {
    await tap(page, 'Посмотреть результаты')
    await sleep(900)
    check('в разборе виден верный ответ сборки', await seen(page, 'I go home every day'))
    const hasWhy = await seen(page, 'Почему?')
    check('у неверного ответа есть «Почему?»', hasWhy)
    if (hasWhy) {
      await tap(page, 'Почему?')
      // объяснение идёт лёгкой моделью и НЕ стоит энергии (task 'word')
      const explained = await page
        .waitForFunction(
          () => !(document.body.innerText || '').includes('Думаю'),
          { timeout: 25000, polling: 500 },
        )
        .then(() => true)
        .catch(() => false)
      check('объяснение дождалось ответа', explained)
    }
  }

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')

  await browser.close()
  await admin.auth.admin.deleteUser(teacherId).catch(() => {})
  await admin.auth.admin.deleteUser(studentId).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [T_EMAIL, S_EMAIL])
  console.log('Тестовые аккаунты удалены (материал и назначение ушли каскадом).')

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

main()
  .catch((e) => {
    console.error('Смоук упал:', e)
    process.exitCode = 1
  })
  // puppeteer держит websocket к браузеру: без принудительного выхода упавший
  // прогон висит минутами и выглядит как «смоук долго работает»
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 500))
