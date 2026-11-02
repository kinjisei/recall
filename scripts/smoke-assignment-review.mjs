/**
 * Смоук: задание со всеми видами упражнений и разбор ошибок у ученика.
 *
 * Проверяет две вещи, которых раньше не было:
 *  1. «Собери предложение» (order) доходит до ученика. Движок и сервер его
 *     считали всегда, а фильтр в lib/materials молча выбрасывал — из трёх типов
 *     в заданиях работало два, и задания были однообразными.
 *  2. После работы есть разбор с кнопкой «Почему?». В практике объяснение
 *     ошибки было, в заданиях преподавателя — нет: ученик видел «неверно» и
 *     правильный ответ, но не узнавал, чем плох его собственный.
 *  3. Новые виды Ф2.25-1 (макет u5) доходят до ученика и считаются в
 *     баллах: «Верно / Неверно» (две кнопки на языке текста, после ответа —
 *     строка из текста), «Соедини пары» (нажал слово — нажал пару, на
 *     компьютере — клавишами 1–4 и A–E; «Проверить» — когда соединено всё;
 *     3 из 4 пар — 3 балла и «+3» у счёта), «Выбери правильную форму».
 *     Пары переживают перезагрузку (черновик), сервер начисляет балл за
 *     каждую пару: итог работы — 5 из 9 баллов, а не «2 из 6».
 *  4. Проверка учителем по d18 (Ф2.25-1б): ответ AI — заготовкой (запрос к
 *     /api/gemini перехвачен — ни AI, ни энергии), счёт в баллах, у неверной
 *     пары «Засчитать» → «4 из 4» и «вручную +1»; «Завершить проверку»
 *     сохраняет отметки у пар, ученик видит «6 баллов из 9».
 *
 * Материал кладём в базу напрямую (service_role): генерация стоила бы дорогой
 * модели и месячного лимита, а проверяем мы не её, а путь ученика.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем `node scripts/smoke-assignment-review.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const T_EMAIL = 'asgn-teacher@recall.test'
const S_EMAIL = 'asgn-student@recall.test'
const PASSWORD = 'Asgn!2026'

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
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
        { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'He gets up at six.', options: ['True', 'False'], answer: 1, quote: 'I get up at seven.', mark: 'seven', why: 'Он встаёт в семь' },
        {
          kind: 'vocab',
          type: 'match',
          format: 'translation',
          prompt: 'Соедини слово и перевод',
          pairs: [
            { left: 'morning', right: 'утро' },
            { left: 'quiet', right: 'тихий' },
            { left: 'work', right: 'работа' },
            { left: 'home', right: 'дом' },
          ],
          extra: ['день'],
        },
        { kind: 'grammar', type: 'mcq', format: 'form', prompt: 'Mornings ___ quiet.', options: ['are', 'is', 'be'], answer: 0 },
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

  // 3. «Верно / Неверно» (A2 — две кнопки на языке текста), отвечаем верно
  check('«Верно или неверно?» дошло до ученика', await seen(page, 'Верно или неверно?'))
  const tfButtons = await page.evaluate(() => [...document.querySelectorAll('main button')].map((b) => b.textContent.trim()).filter((t) => ['True', 'False', 'Not given'].includes(t)))
  check('у текста A2 — две кнопки True / False', tfButtons.join(',') === 'True,False', tfButtons.join(','))
  await tap(page, 'False', true)
  check('после ответа — «Правильно — False» и строка из текста', (await seen(page, 'Правильно — False')) && (await seen(page, 'I get up at seven.')))
  check('и балл «+1 балл»', await seen(page, '+1 балл'))
  await tap(page, 'Дальше')

  // 4. «Соедини пары» — на компьютере, клавишами: 1–4 слово, A–E перевод
  check('«Соедини пары» дошло до ученика', await seen(page, 'Соедини слово и перевод'))
  const checkOff = () => page.evaluate(() => [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Проверить')?.disabled ?? null)
  check('«Проверить» выключена, пока соединено не всё', (await checkOff()) === true)
  await page.setViewport({ width: 1280, height: 800 })
  await sleep(800)
  const rights = await page.evaluate(() => [...document.querySelectorAll('button[data-pair-side="R"]')].map((b) => b.lastElementChild?.textContent.trim()))
  const key = (word) => 'Key' + String.fromCharCode(65 + rights.indexOf(word))
  // три верные пары и одна неверная: home ↔ «день» (лишний вариант)
  for (const [n, word] of [['1', 'утро'], ['2', 'тихий'], ['3', 'работа'], ['4', 'день']]) {
    await page.keyboard.press(n)
    await page.keyboard.press(key(word))
    await sleep(150)
  }
  check('все пары соединены клавишами — «Проверить» включена', (await checkOff()) === false, `справа: ${rights.join(', ')}`)
  // Backspace разъединяет последнюю пару, она снова соединяется
  await page.keyboard.press('Backspace')
  await sleep(150)
  check('Backspace разъединил пару', (await checkOff()) === true)
  await page.keyboard.press('4')
  await page.keyboard.press(key('день'))
  await sleep(150)
  await page.keyboard.press('Enter')
  await sleep(600)
  check('после «Проверить»: 3 из 4 пар — 3 балла', await seen(page, '3 из 4 пар — 3 балла'))
  check('у неверной пары — верный перевод', await seen(page, 'верно: дом'))
  check('у счёта — «+3»', await seen(page, '+3'))
  await page.keyboard.press('Enter')
  await sleep(800)
  await page.setViewport({ width: 420, height: 900 })
  await sleep(500)

  // пары переживают перезагрузку: черновик хранит их, счёт — с баллами пар
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(2000)
  check('после перезагрузки счёт помнит пары — «5 / 6 · 4 балла»', await seen(page, '5 / 6 · 4 балла'))

  // 5. «Выбери правильную форму» — выбор с подписью задания
  check('«Выбери правильную форму» дошло до ученика', await seen(page, 'Выбери правильную форму'))
  await tap(page, 'are', true)
  await tap(page, 'Дальше')

  // 6. сборка предложения — тот самый третий тип
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
  // сервер считает в баллах: выбор 0, вписать 0, верно/неверно 1, пары 3, форма 1, сборка 0
  await sleep(1500)
  const { data: done } = await admin.from('material_assignments').select('auto_score, auto_total, answers').eq('material_id', mat.id).single()
  check('сервер начислил балл за каждую пару: 5 из 9', done?.auto_score === 5 && done?.auto_total === 9, `${done?.auto_score} из ${done?.auto_total}`)
  check(
    'пары ученика дошли до сервера',
    JSON.stringify(done?.answers?.find((a) => a.index === 3)?.pairs) === JSON.stringify(['утро', 'тихий', 'работа', 'день']),
  )
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

  // ---- проверка учителем (d18) ------------------------------------------
  const { data: asg } = await admin.from('material_assignments').select('id').eq('material_id', mat.id).single()
  const tctx = await browser.createBrowserContext()
  const tp = await tctx.newPage()
  await tp.setViewport({ width: 1280, height: 900 })
  tp.on('pageerror', (e) => jsErrors.push(String(e)))
  // AI-разбор — заготовкой: выбор и вписать неверны, «верно/неверно» и форма верны,
  // у пар AI пытается снять верную пару — приложение не даст
  const aiReview = {
    items: [
      { index: 0, ok: false, comment: 'Он встаёт в семь: at seven.' },
      { index: 1, ok: false, comment: 'Нужно get.' },
      { index: 2, ok: true, comment: '' },
      { index: 3, ok: false, comment: 'лишнее', pairs: [false, true, true, false] },
      { index: 4, ok: true, comment: '' },
      { index: 5, ok: false, comment: 'Порядок: I go home every day.' },
    ],
  }
  await tp.setRequestInterception(true)
  tp.on('request', (r) =>
    r.url().includes('/api/gemini')
      ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(aiReview) }) })
      : r.continue(),
  )
  await tp.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await tp.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await tap(tp, 'Войти')
  await tp.type('input[type=email]', T_EMAIL)
  await tp.type('input[type=password]', PASSWORD)
  await tp.keyboard.press('Enter')
  await sleep(4500)
  await tp.goto(`${BASE}/tasks?work=${asg.id}`, { waitUntil: 'networkidle2' })
  await tp.waitForFunction(() => /AI предлагает засчитать/.test(document.body.innerText), { timeout: 20000, polling: 300 }).catch(() => {})
  check('проверка: AI предлагает в баллах — 5 баллов из 9', await seen(tp, 'AI предлагает засчитать 5 баллов из 9'))
  check('у пар счёт «3 из 4» и подпись вида', (await seen(tp, '3 из 4')) && (await seen(tp, 'Соедини слово и перевод · балл за пару')))
  check('AI не снял верную пару: «Пары Айгерим: 3 верно, 1 неверно»', await seen(tp, '3 верно, 1 неверно'))
  check('итог справа: «Авто: 5 из 9 баллов · вручную 0»', await seen(tp, 'Авто: 5 из 9 баллов · вручную 0'))
  await tap(tp, 'Засчитать', true)
  await sleep(500)
  check('«Засчитать» у пары — «4 из 4» и «вручную +1»', (await seen(tp, '4 из 4')) && (await seen(tp, 'вручную +1')))
  check('сводка пар — «1 засчитана вручную»', await seen(tp, '1 засчитана вручную'))
  await tap(tp, 'Завершить проверку')
  await sleep(2500)
  const { data: rv } = await admin.from('material_assignments').select('status, teacher_review').eq('id', asg.id).single()
  check(
    'сервер сохранил отметки у пар',
    rv?.status === 'reviewed' && JSON.stringify(rv.teacher_review?.find((x) => x.index === 3)?.pairs) === '[true,true,true,true]',
    JSON.stringify(rv?.teacher_review?.find((x) => x.index === 3)),
  )
  await tctx.close()

  // ученик видит итог учителя в баллах
  await page.goto(`${BASE}/assignments?a=${asg.id}&stage=review`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  check('ученик: «Проверено преподавателем: 6 баллов из 9»', await seen(page, 'Проверено преподавателем: 6 баллов из 9'))

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
