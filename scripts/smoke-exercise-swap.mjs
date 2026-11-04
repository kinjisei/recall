/**
 * Смоук замены упражнения через AI (PLAN.md Ф2.25-4б, макет d17: кадры
 * d17-2, d17-3, d17-3в) — в мастере и в библиотеке.
 *
 * Ответ AI — заготовкой: обёртка вокруг fetch отвечает на POST /api/gemini
 * тем, что положил смоук (`{ text, swaps }` или отказ с кодом), модель не
 * зовётся и замены не тратятся. Остаток до первой замены и «кончились» —
 * настоящие: строки `ai_calls` со `swap` на сегодня (секретным ключом),
 * экран читает их `my_exercise_swaps`.
 *
 * Мастер: счётчик у «Сохранить» («25 из 25 · сложных 5 из 5» — в материале
 * каверзные True / False), без «бесплатно»; «↻ Заменить» — скелетон
 * «AI пишет…» и сразу «24 из 25», запрос — вид и «каверзные»; пока AI
 * пишет, учитель правит другое упражнение — обе правки целы; сложная
 * замена — tricky в запросе; «+ Упражнение → Составит AI · ещё N сегодня» —
 * новое в конце; ответ не упражнением (422) и не прошедший проверку формы —
 * строка у упражнения, оно прежнее; «Сохранить» кладёт замены в базу.
 * Кончились сложные — плашка, «Заменить» у сложного выключен, у остальных
 * — нет; кончились все — «Замены кончились — снова завтра с 00:00»,
 * «Составит AI» выключен, «Изменить» работает.
 * Библиотека: тихая строка остатка, замена и «Составит AI» — сразу в базе с
 * новой версией; сервер ответил «кончились» — плашка, без строки ошибки.
 *
 * Краснеет на коде до 4б: у упражнения нет «Заменить».
 * Запуск: node scripts/smoke-exercise-swap.mjs (нужен `npm run dev:test` —
 * 5174, тестовая база; аккаунт заводится и удаляется).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунт и пишет в журнал AI — только тестовая база.')
  process.exit(1)
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'ExSwap!2026'
const TEACHER = 'exswap-teacher@recall.test'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}

// текст и упражнения кадров d17
const BODY =
  'Last summer Dana flew from Almaty to Istanbul. She came to the airport early, but the screen said: “Delay — 3 hours”. Dana was not happy. She bought a coffee and waited near the gate.\n\n' +
  'The plane left very late, and in Istanbul Dana had only forty minutes for her next flight. She ran through the airport with her boarding pass in her hand. But the gate was already closed. She missed her flight!\n\n' +
  'A woman at the desk was very kind. She gave Dana a ticket for the evening flight. Then Dana went to get her luggage, but her bag was not there. “Don’t worry,” the woman said. “It is on the next plane.” Dana laughed. What a day!'
const EXERCISES = [
  { kind: 'comprehension', type: 'mcq', prompt: 'Why did Dana wait near the gate for three hours?', options: ['Her flight had a delay.', 'She came to the airport late.', 'She wanted a coffee.', 'Her bag was lost.'], answer: 0 },
  { kind: 'comprehension', type: 'mcq', prompt: 'What did the woman at the desk give Dana?', options: ['A ticket for the evening flight.', 'A new boarding pass.', 'Her luggage.'], answer: 0 },
  { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana missed her flight because she came to the airport late.', options: ['True', 'False'], answer: 1 },
  {
    kind: 'vocab',
    type: 'match',
    format: 'translation',
    prompt: 'Соедини слово и перевод',
    pairs: [
      { left: 'delay', right: 'задержка' },
      { left: 'gate', right: 'выход на посадку' },
      { left: 'boarding pass', right: 'посадочный талон' },
      { left: 'luggage', right: 'багаж' },
      { left: 'miss a flight', right: 'опоздать на рейс' },
    ],
    extra: ['паспорт'],
  },
  { kind: 'grammar', type: 'fill', prompt: 'She ___ (buy) a coffee and waited near the gate.', answer: 'bought', hint: 'Past Simple от buy' },
]
// у True / False — «Каверзные вопросы»: его замена сложная
const PLAN = {
  comments: 'Рассказ: Дана летит из Алматы в Стамбул.',
  vocabulary: ['delay', 'luggage', 'boarding pass', 'gate', 'miss a flight'],
  grammar_focus: 'Past Simple',
  exercise_plan: [
    { format: 'mcq', kind: 'comprehension', type: 'mcq', count: 2, note: '' },
    { format: 'tfng', kind: 'comprehension', type: 'mcq', count: 1, note: '', tricky: true },
    { format: 'match_translation', kind: 'vocab', type: 'match', count: 5, note: '' },
    { format: 'fill_form', kind: 'grammar', type: 'fill', count: 1, note: '' },
  ],
}
// ответы AI — проходят фильтр приложения и проверку формы (кроме BAD_FILL)
const NEW_MCQ = { kind: 'comprehension', type: 'mcq', prompt: 'How long did Dana have for her next flight?', options: ['Thirty minutes', 'Forty minutes', 'Three hours', 'One hour'], answer: 1 }
const NEW_TF = { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana was happy at the airport.', options: ['True', 'False'], answer: 1 }
const NEW_FORM = { kind: 'grammar', type: 'mcq', format: 'form', prompt: 'Dana ___ to Istanbul last summer.', options: ['flew', 'flies', 'fly'], answer: 0 }
const BAD_FILL = { kind: 'grammar', type: 'fill', prompt: 'She bought a coffee (buy).', answer: 'bought' }
const reply = (ex, left, strongLeft, delay = 0) => ({ status: 200, body: { text: JSON.stringify({ exercises: [ex] }), swaps: { left, strongLeft } }, delay })
const refuse = (status, code, error) => ({ status, body: { error, code } })

const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 200, timeout }, re.source).then(() => true, () => false)
/** Нажать видимую кнопку по aria-label или тексту (начало совпадает); выключенная — не нажимается. */
async function press(page, label, scope = 'body') {
  const ok = await page.evaluate(
    (l, sc) => {
      const b = [...document.querySelectorAll(`${sc} button`)].find((x) => x.offsetParent !== null && !x.disabled && ((x.getAttribute('aria-label') ?? '').startsWith(l) || x.textContent.trim().startsWith(l)))
      b?.click()
      return Boolean(b)
    },
    label,
    scope,
  )
  await sleep(300)
  return ok
}
/** Кнопка есть и выключена. */
const isOff = (page, label) => page.evaluate((l) => [...document.querySelectorAll('button')].some((x) => (x.getAttribute('aria-label') ?? x.textContent.trim()).startsWith(l) && x.disabled), label)
const swapCount = (page) => page.$$eval('[data-swap-count]', (els) => els.map((e) => e.innerText).join(' | ')).catch(() => '')
/** Положить ответы AI в очередь заготовок и забыть прежние запросы. */
const queue = (page, ...items) => page.evaluate((list) => ((window.__swapQueue = list), (window.__aiCalls = [])), items)
const calls = (page) => page.evaluate(() => (window.__aiCalls || []).map((b) => JSON.parse(b)))
const exerciseText = (page, n) => page.$eval(`[data-exercise="${n}"]`, (el) => el.innerText).catch(() => '')
const putSwaps = (uid, n, kind) =>
  n > 0 && sql(`insert into public.ai_calls (user_id, kind, cost_energy, is_generation, swap, called_at) select '${uid}', 'heavy', 0, false, '${kind}', now() from generate_series(1, ${n})`)

async function makeTeacher() {
  await admin.from('allowed_emails').upsert({ email: TEACHER, note: 'exswap' })
  const { data: cu } = await admin.auth.admin.createUser({ email: TEACHER, password: PASS, email_confirm: true })
  let id = cu?.user?.id
  if (!id) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = l.users.find((u) => (u.email ?? '').toLowerCase() === TEACHER)?.id
    await admin.auth.admin.updateUserById(id, { password: PASS })
  }
  await admin.from('profiles').update({ display_name: 'Учитель Замена', role: 'teacher' }).eq('id', id)
  return id
}

let browser = null
let tId = null
try {
  tId = await makeTeacher()
  await sql(`delete from public.ai_calls where user_id = '${tId}'`)

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('smoke-exercise-swap')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width: 1280, height: 900 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))
  // ПЕРЕХВАТ на уровне fetch, а не setRequestInterception (тот вешал dev-сервер, smoke-material-diagnostics):
  // ответ — из очереди заготовок, пустая очередь — отказ, до сервера не доходит ничего
  await page.evaluateOnNewDocument(`
    window.__aiCalls = []; window.__swapQueue = [];
    const orig = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!url.includes('/api/gemini')) return orig(input, init);
      window.__aiCalls.push(String((init && init.body) || ''));
      const item = window.__swapQueue.shift();
      if (!item) return Promise.reject(new Error('перехвачено смоуком'));
      const res = () => new Response(JSON.stringify(item.body), { status: item.status, headers: { 'Content-Type': 'application/json' } });
      return new Promise((ok) => setTimeout(() => ok(res()), item.delay || 0));
    };
  `)

  await go(page, '/login')
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', TEACHER)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  await sleep(1200)

  // ---------------- мастер: шаг «Текст» черновиком (AI не звался) ----------------
  const req = { lang: 'en', level: 'A2', topic: 'Travel problems', format: 'рассказ', lengthRange: '100-140', vocabulary: '', grammar: '', studentIds: [] }
  const flow = { steps: [{ name: 'form' }, { name: 'plan', req, plan: PLAN }, { name: 'preview', req, plan: PLAN, content: { title: 'Exswap airport', body: BODY, exercises: EXERCISES } }], at: 2 }
  await page.evaluate((key, v) => localStorage.setItem(key, JSON.stringify({ v, at: Date.now() })), `recall.draft.${tId}.material-flow`, flow)
  await go(page, '/tasks?tab=materials')
  check('шаг «Текст»: «Упражнения (5)»', await waitText(page, /Упражнения \(5\)/))
  check('у упражнения — «↻ Заменить»', await page.$('button[aria-label="Заменить упражнение 1"]').then(Boolean))
  await waitText(page, /Замен через AI сегодня: 25 из 25/, 8000)
  const card0 = await swapCount(page)
  check('карточка: «Замен через AI сегодня: 25 из 25 · сложных 5 из 5» (каверзные в материале)', /25 из 25 · сложных 5 из 5/.test(card0), card0)
  check('карточка: «…генерацию не тратят», нигде нет «бесплатно» и «без ограничений»', /генерацию не тратят/.test(card0) && !/бесплатно|без ограничений/i.test(await text(page)), card0)

  // (1) замена упражнения 1; пока AI пишет — правка упражнения 2 руками
  await queue(page, reply(NEW_MCQ, 24, 5, 2500))
  await press(page, 'Заменить упражнение 1')
  check('пока AI пишет — скелетон строки «AI пишет новый вопрос того же формата»', (await page.$('[data-exercise="1"][data-swapping]').then(Boolean)) && (await exerciseText(page, 1)).includes('AI пишет новый вопрос того же формата'))
  check('сразу после нажатия — «24 из 25»', /24 из 25/.test(await swapCount(page)), await swapCount(page))
  check('у заменяемого «Изменить» и «Убрать» выключены', (await isOff(page, 'Изменить упражнение 1')) && (await isOff(page, 'Убрать упражнение 1')))
  const [c1] = await calls(page)
  check('запрос: задача exercise_swap, вид mcq, не каверзный', c1?.task === 'exercise_swap' && c1?.swap?.format === 'mcq' && c1?.swap?.tricky === false, JSON.stringify(c1?.swap))
  await press(page, 'Изменить упражнение 2')
  await page.focus('[data-exercise-edit] textarea[name="prompt"]')
  await page.keyboard.press('End')
  await page.type('[data-exercise-edit] textarea[name="prompt"]', ' (edited)')
  await press(page, 'Готово', '[data-exercise-edit]')
  await waitText(page, /How long did Dana have for her next flight/, 6000)
  const t1 = await text(page)
  check('ответ AI лёг на место упражнения 1', (await exerciseText(page, 1)).includes('How long did Dana have for her next flight?') && !t1.includes('Why did Dana wait near the gate'))
  check('правка упражнения 2, сделанная пока AI писал, цела', (await exerciseText(page, 2)).includes('(edited)'), await exerciseText(page, 2))

  // (2) сложная замена: каверзные True / False
  await queue(page, reply(NEW_TF, 23, 4))
  await press(page, 'Заменить упражнение 3')
  await waitText(page, /Dana was happy at the airport/, 6000)
  const [c2] = await calls(page)
  check('сложная замена: вид tfng, tricky — из плана', c2?.swap?.format === 'tfng' && c2?.swap?.tricky === true, JSON.stringify(c2?.swap))
  check('после ответа — остаток сервера «23 из 25 · сложных 4 из 5»', /23 из 25 · сложных 4 из 5/.test(await swapCount(page)), await swapCount(page))

  // (3) «+ Упражнение → Составит AI»
  await press(page, 'Упражнение')
  await page.evaluate(() => document.querySelector('[data-pick="Выбери правильную форму"]')?.click())
  await sleep(300)
  check('«Составит AI · ещё 23 сегодня» — без «бесплатно»', /Составит AI · ещё 23 сегодня/.test(await text(page)))
  await queue(page, reply(NEW_FORM, 22, 4, 1500))
  await press(page, 'Составит AI')
  check('пока AI пишет — новая строка «AI пишет новое упражнение»', await waitText(page, /AI пишет новое упражнение/, 1200))
  check('новое упражнение — шестым, «Упражнения (6)»', (await waitText(page, /Упражнения \(6\)/, 6000)) && (await exerciseText(page, 6)).includes('Dana ___ to Istanbul last summer.'))
  const [c3] = await calls(page)
  check('запрос «Составит AI»: вид form', c3?.swap?.format === 'form', JSON.stringify(c3?.swap))

  // (4) ответ не упражнением (422) — строка у упражнения, оно прежнее
  await queue(page, refuse(422, 'RECALL_SWAP_SHAPE', 'AI ответил не упражнением. Попробуй заменить ещё раз или поправь руками.'))
  await press(page, 'Заменить упражнение 5')
  await waitText(page, /AI ответил не упражнением/, 6000)
  check('422 RECALL_SWAP_SHAPE — строка у упражнения, оно прежнее', (await text(page)).includes('AI ответил не упражнением') && (await exerciseText(page, 5)).includes('She ___ (buy) a coffee'))

  // (5) ответ прошёл фильтр, но не проверку формы (нет пропуска ___)
  await queue(page, reply(BAD_FILL, 21, 4))
  await press(page, 'Заменить упражнение 5')
  await waitText(page, /не проходит проверку/, 6000)
  const t5 = await text(page)
  check('ответ не прошёл проверку формы — «Замена не удалась…», упражнение прежнее', /Замена не удалась: AI прислал упражнение, которое не проходит проверку \(отметь пропуск/.test(t5) && (await exerciseText(page, 5)).includes('She ___ (buy) a coffee'), t5.slice(t5.indexOf('Замена'), t5.indexOf('Замена') + 160))

  // (6) «Сохранить» — замены в базе
  await press(page, 'Сохранить в библиотеку')
  await sleep(2500)
  const { data: saved } = await admin.from('materials').select('exercises').eq('teacher_id', tId).eq('title', 'Exswap airport').maybeSingle()
  const ex = saved?.exercises ?? []
  check(
    '«Сохранить» кладёт в базу замены, новое и правку руками',
    ex.length === 6 && ex[0]?.prompt === NEW_MCQ.prompt && ex[1]?.prompt?.includes('(edited)') && ex[2]?.prompt === NEW_TF.prompt && ex[5]?.prompt === NEW_FORM.prompt,
    JSON.stringify(ex.map((e) => e.prompt)),
  )

  // (7) кончились сложные (5 строк strong на сегодня), потом все (ещё 20)
  await putSwaps(tId, 5, 'strong')
  await page.evaluate((key, v) => localStorage.setItem(key, JSON.stringify({ v, at: Date.now() })), `recall.draft.${tId}.material-flow`, flow)
  await go(page, '/tasks?tab=materials')
  await waitText(page, /Упражнения \(5\)/)
  await waitText(page, /20 из 25/, 8000)
  const outStrong = await text(page)
  check('сложные кончились: «20 из 25 · сложных 0 из 5» и плашка «Сложные замены кончились — снова завтра с 00:00»', /20 из 25 · сложных 0 из 5/.test(await swapCount(page)) && outStrong.includes('Сложные замены кончились — снова завтра с 00:00'), await swapCount(page))
  check('«Заменить» у каверзного True / False выключен, у «Выбери ответ» — нет', (await isOff(page, 'Заменить упражнение 3')) && !(await isOff(page, 'Заменить упражнение 1')))
  await putSwaps(tId, 20, 'light')
  await go(page, '/tasks?tab=materials')
  await waitText(page, /Упражнения \(5\)/)
  check('все кончились: «Замены кончились — снова завтра с 00:00», «Изменить» и «Напишу сам» работают и сейчас', await waitText(page, /Замены кончились — снова завтра с 00:00[\s\S]*«Изменить» и «Напишу сам» работают и сейчас/, 8000))
  check('все кончились: «Заменить» выключен у всех', (await isOff(page, 'Заменить упражнение 1')) && (await isOff(page, 'Заменить упражнение 5')))
  await press(page, 'Упражнение')
  await page.evaluate(() => document.querySelector('[data-pick="Выбери ответ"]')?.click())
  await sleep(300)
  check('все кончились: «Составит AI» выключен, «Напишу сам» — нет', (await isOff(page, 'Составит AI')) && !(await isOff(page, 'Напишу сам')))
  check('все кончились: «Изменить» открывает форму', (await press(page, 'Изменить упражнение 2')) && (await page.$('[data-exercise-edit]').then(Boolean)))

  // ---------------- библиотека: сохранённый материал без сданных ----------------
  await sql(`delete from public.ai_calls where user_id = '${tId}'`)
  const { data: lib } = await admin
    .from('materials')
    .insert({ teacher_id: tId, lang: 'en', level: 'A2', topic: 'Travel problems', format: 'рассказ', length_range: '100-140', title: 'Exswap library', body: BODY, exercises: EXERCISES, plan: PLAN })
    .select('id, exercises_version')
    .single()
  await page.evaluate((uid) => Object.keys(localStorage).filter((k) => k.startsWith(`recall.draft.${uid}.material`)).forEach((k) => localStorage.removeItem(k)), tId)
  await go(page, `/tasks?tab=materials&mat=${lib.id}`)
  await waitText(page, /Упражнения · 5/)
  check('библиотека: тихая строка «Замен через AI сегодня: 25 из 25 · сложных 5 из 5 · генерацию не тратят»', await waitText(page, /Замен через AI сегодня: 25 из 25 · сложных 5 из 5 · генерацию не тратят/, 8000), await swapCount(page))
  await queue(page, reply(NEW_MCQ, 24, 5, 800))
  await press(page, 'Заменить упражнение 2')
  await waitText(page, /How long did Dana have for her next flight/, 6000)
  await sleep(1200)
  const after = (await admin.from('materials').select('exercises, exercises_version').eq('id', lib.id).single()).data
  check('библиотека: замена сразу в базе, версия выросла', after?.exercises?.[1]?.prompt === NEW_MCQ.prompt && after?.exercises_version > lib.exercises_version, JSON.stringify({ v: after?.exercises_version, p: after?.exercises?.[1]?.prompt }))
  await press(page, 'Упражнение')
  await page.evaluate(() => document.querySelector('[data-pick="Выбери правильную форму"]')?.click())
  await sleep(300)
  await queue(page, reply(NEW_FORM, 23, 5))
  await press(page, 'Составит AI')
  await waitText(page, /Упражнения · 6/, 6000)
  await sleep(1200)
  const after2 = (await admin.from('materials').select('exercises, exercises_version').eq('id', lib.id).single()).data
  check('библиотека: «Составит AI» — шестое упражнение в базе, версия ещё выросла', after2?.exercises?.length === 6 && after2?.exercises?.[5]?.prompt === NEW_FORM.prompt && after2?.exercises_version > after?.exercises_version)
  // замены потратили в другой вкладке: экран ещё видит остаток, сервер отказывает, база говорит «0»
  await putSwaps(tId, 25, 'light')
  await queue(page, refuse(409, 'RECALL_SWAP_LIMIT', 'Замены через AI на сегодня закончились — снова завтра с 00:00. Поправить упражнение руками можно и сейчас.'))
  await press(page, 'Заменить упражнение 1')
  await waitText(page, /Замены кончились — снова завтра с 00:00/, 6000)
  const t9 = await text(page)
  check('сервер ответил «кончились» — плашка, а не строка ошибки у упражнения', t9.includes('Замены кончились — снова завтра с 00:00') && !t9.includes('Замены через AI на сегодня закончились'))

  check('без ошибок JS на странице', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 300))
} catch (e) {
  check('смоук дошёл до конца', false, e instanceof Error ? e.message : String(e))
} finally {
  if (tId) await sql(`delete from public.ai_calls where user_id = '${tId}'`).catch(() => {})
  if (tId) await admin.from('materials').delete().eq('teacher_id', tId)
  if (tId) await deleteTestUser(admin, sql, tId).catch(() => {})
  await browser?.close().catch(() => {})
}

const ok = results.filter(Boolean).length
console.log(`\n${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
