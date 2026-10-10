/**
 * Снимки НЫНЕШНИХ экранов для промптов дизайнеру (PLAN.md Ф2.19, пачка 1
 * макетов для компьютера): ученица с репетитором, самоучка, студия репетитора
 * Мадины Сейткали (английский, Mini), гость и новый репетитор. Каждый экран —
 * 1280 (кроме помеченных) и 390, тёмная тема. Данные кладутся в тестовую базу
 * напрямую, AI не вызывается (планы и тексты — черновиками), наружу ничего
 * не отправляется. Аккаунты удаляются сами.
 *
 * Запуск: npm run dev:test, затем node scripts/shots-batch1.mjs [папка]
 * (по умолчанию design/current/).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'
import { settledScreenshot } from './_shots.mjs'

if (process.argv.includes('--prod')) {
  console.error('Снимки заводят аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'design/current'
const PASS = 'ShotsB1!2026'
const E = (k) => `shots-b1-${k}@recall.test`
const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const must = (r, label) => {
  if (r.error) throw new Error(`${label}: ${r.error.message}`)
  return r.data
}
const made = []

async function makeUser(key, name, level = 'B1') {
  const email = E(key)
  await admin.from('allowed_emails').upsert({ email, note: 'shots-batch1 (временный)' })
  for (const u of await sql(`select id from auth.users where lower(email) = '${email}'`)) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { display_name: name } })
  if (error) throw new Error(error.message)
  made.push(data.user.id)
  await admin.from('profiles').update({ display_name: name, level }).eq('id', data.user.id)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  must(await client.auth.signInWithPassword({ email, password: PASS }), `вход ${key}`)
  return { id: data.user.id, email, client }
}

const ESSAY = `Nowadays, many people believe that governments should spend money on public transport rather than on building new roads. I strongly agree with this opinion for several reasons.

Firstly, public transport is much more efficient in big cities. One metro train can carry thousands of passengers, while the same number of people in cars would block the whole street for hours. Moreover, buses and trams are cheaper for ordinary families, so people who earn little money can still get to work every day.

Secondly, cars are a main source of pollution. In Almaty, for example, the air in winter is very bad, and a lot of children has problems with breathing. If the city invested in a modern metro and electric buses, fewer people would drive and the air would become cleaner.

However, some people argue that new roads are necessary because not every district have a metro station. This is true in some cases, but I think a better solution is to connect these districts with bus lines, which is faster and cheaper than building a highway.

In conclusion, I believe that public transport should be the priority for governments. It saves time and money, and it protects the environment for the future generations.`

const AI_REVIEW = {
  band: 6.5,
  criteria: { task: 6.5, coherence: 7, lexis: 6.5, grammar: 6 },
  focus: [
    { type: 'Subject-verb agreement', why: 'With plural subjects the verb must stay plural, and with singular ones it takes -s.', examples: [{ was: 'a lot of children has problems', fix: 'a lot of children have problems' }, { was: 'not every district have a metro station', fix: 'not every district has a metro station' }] },
    { type: 'Articles', why: 'Abstract plural nouns usually need no article.', examples: [{ was: 'for the future generations', fix: 'for future generations' }] },
  ],
  errors: [
    { was: 'a lot of children has problems with breathing', fix: 'a lot of children have problems with breathing', type: 'grammar' },
    { was: 'not every district have a metro station', fix: 'not every district has a metro station', type: 'grammar' },
    { was: 'for the future generations', fix: 'for future generations', type: 'article' },
    { was: 'people who earn little money', fix: 'low-income people', type: 'lexis' },
  ],
  strengths: ['Clear position stated in the introduction and repeated in the conclusion', 'Good linking words (Firstly, Moreover, However)', 'A concrete example from the local context (Almaty)'],
  improve: ['Add a more developed counter-argument in paragraph 4', 'Use a wider range of complex sentences'],
  rewrites: [{ was: 'It saves time and money', better: 'It reduces both journey times and household expenses' }],
}

const MATERIALS = [
  {
    lang: 'en', level: 'A2', topic: 'Daily routine', format: 'рассказ', length_range: '50-100', title: 'My morning routine',
    body: 'I get up at seven o\'clock. First, I wash my face and brush my teeth. Then I make breakfast: usually an egg and a cup of tea. At eight I leave home and take the bus to work. The bus ride takes twenty minutes, and I often listen to music.',
    exercises: [
      { kind: 'comprehension', type: 'mcq', prompt: 'What time does the speaker get up?', options: ['At six', 'At seven', 'At eight', 'At nine'], answer: 1 },
      { kind: 'comprehension', type: 'mcq', prompt: 'How does the speaker go to work?', options: ['By car', 'On foot', 'By bus', 'By bike'], answer: 2 },
      { kind: 'vocab', type: 'fill', prompt: 'I ___ the bus to work every day.', answer: 'take' },
    ],
  },
  {
    lang: 'en', level: 'A2', topic: 'Food', format: 'диалог', length_range: '100-250', title: 'Ordering lunch in a café',
    body: 'Waiter: Good afternoon! Are you ready to order?\nAnna: Yes, please. I\'d like the chicken soup and a salad.\nWaiter: Would you like something to drink?\nAnna: Just water, please.\nWaiter: Of course. Anything else?\nAnna: No, thank you. That\'s all.',
    exercises: [
      { kind: 'comprehension', type: 'mcq', prompt: 'What does Anna order to drink?', options: ['Tea', 'Juice', 'Water', 'Coffee'], answer: 2 },
      { kind: 'grammar', type: 'fill', prompt: 'I ___ like the chicken soup, please.', answer: 'would' },
    ],
  },
  {
    lang: 'en', level: 'B1', topic: 'Work', format: 'статья', length_range: '250-400', title: 'Working from home: pros and cons',
    body: 'More and more people work from home. The main advantage is flexibility: you save time on the way to the office and can plan your day yourself. However, many remote workers say they feel lonely and find it hard to separate work from private life.\n\nCompanies also notice differences. Some managers say that teams communicate less, while others report higher productivity. Experts suggest a mixed model, with two or three days at the office.',
    exercises: [
      { kind: 'comprehension', type: 'mcq', prompt: 'What is the main advantage of working from home?', options: ['Higher salary', 'Flexibility', 'Fewer meetings', 'Better equipment'], answer: 1 },
      { kind: 'comprehension', type: 'mcq', prompt: 'What do experts suggest?', options: ['Only remote work', 'Only office work', 'A mixed model', 'Shorter weeks'], answer: 2 },
      { kind: 'vocab', type: 'mcq', prompt: 'Which word means "able to change easily"?', options: ['flexible', 'lonely', 'private', 'mixed'], answer: 0 },
    ],
  },
  {
    lang: 'en', level: 'B1', topic: 'Travel', format: 'рассказ', length_range: '250-400', title: 'A trip that went wrong',
    body: 'Last summer my friends and I decided to go to Lake Issyk-Kul by car. We had been driving for three hours when the engine suddenly stopped. Nobody knew what to do, because there was no signal on our phones. Luckily, a farmer passed by and helped us call a mechanic. We reached the lake only the next morning, but we still remember that trip as the best one.',
    exercises: [
      { kind: 'comprehension', type: 'mcq', prompt: 'Why were they unable to call for help at first?', options: ['No money', 'No signal', 'No friends', 'No car'], answer: 1 },
      { kind: 'grammar', type: 'fill', prompt: 'We ___ driving for three hours when the engine stopped. (past perfect continuous: had been)', answer: 'had been' },
    ],
  },
]

async function seed() {
  const t = await makeUser('teacher', 'Мадина Сейткали')
  await sql(`update public.profiles set role = 'teacher', plan = 'teacher_mini', plan_expires_at = now() + interval '30 days' where id = '${t.id}'`)
  must(await t.client.rpc('set_default_lesson_link', { p_link: 'https://meet.google.com/abc-defg-hij' }), 'ссылка')
  const a = await makeUser('aigerim', 'Айгерим Нурланова', 'B1')
  const s = await makeUser('asel', 'Әсел Жұмабаева', 'A2')
  const m = await makeUser('meir', 'Мейір Сапар', 'B1')
  const solo = await makeUser('solo', 'Диас Омаров', 'A2')
  const nw = await makeUser('newbie', 'Динара Кали', 'B1')
  for (const u of [a, s, m]) must(await admin.from('teacher_students').upsert({ teacher_id: t.id, student_id: u.id, seat: true }, { onConflict: 'teacher_id,student_id' }), 'привязка')
  const cards = must(await t.client.rpc('get_my_student_cards'), 'карточки')
  const cardOf = (u) => cards.find((c) => c.user_id === u.id)?.id
  const [ca, cs, cm] = [cardOf(a), cardOf(s), cardOf(m)]
  const plain = [['Нұрсұлтан Ахметов', 'trial', '+7 705 220 11 90'], ['Камила Оспан', 'active', '+7 707 334 56 12'], ['Тимур Ким', 'active', '@timur_kim'], ['Алина Ли', 'active', '+7 701 888 02 45'], ['Данияр Беков', 'paused', '+7 747 100 20 30']]
  for (const [name, status, contact] of plain) {
    const id = must(await t.client.rpc('create_student_card', { p_name: name, p_status: status === 'paused' ? 'active' : status, p_contact: contact }), name)
    if (status === 'paused') must(await t.client.rpc('set_student_card_status', { p_card: id, p_status: 'paused' }), 'пауза')
  }

  // уроки Айгерим: прошлые (списаны), ближайший и ещё два на неделе.
  // Ближайший — в 19:00 по Алматы, как в общем контексте макетов: сегодня,
  // если до него больше часа, иначе завтра (вечерний прогон с «через 3 часа»
  // давал «Завтра, 02:49»)
  const [{ now }] = await sql('select now() as now')
  const ALMATY = 5 * 3600_000
  const local = new Date(Date.parse(now) + ALMATY)
  let next = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 19) - ALMATY
  if (next - Date.parse(now) < 3600_000) next += 86400_000
  // точной отметкой, а не минутами от now: у now есть секунды — было «18:59–19:59»
  const atNext = (days, hours = 0) => new Date(next + days * 86400_000 + hours * 3600_000).toISOString()
  must(await t.client.rpc('add_paid_lessons', { p_card: ca, p_count: 5 }), 'оплата')
  for (const d of [-9, -2]) {
    const l = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(d), p_minutes: 60, p_cards: [ca] }), 'прошлый урок')
    must(await t.client.rpc('mark_lesson_participant', { p_lesson: l, p_card: ca, p_outcome: 'present' }), 'отметка')
  }
  for (const days of [0, 2, 5]) must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(days), p_minutes: 60, p_cards: [ca] }), 'урок')
  must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(1, -2), p_minutes: 60, p_cards: [cs] }), 'урок Әсел')
  must(await t.client.rpc('add_paid_lessons', { p_card: cs, p_count: 4 }), 'оплата Әсел')
  must(await t.client.rpc('add_paid_lessons', { p_card: cm, p_count: 1 }), 'оплата Мейір')

  // домашка Айгерим: слова (частично), чтение, письмо, свободный пункт (сделан)
  const due = new Date(Date.parse(now) + 5 * 86400_000).toISOString()
  const hw = must(await t.client.rpc('create_homework', {
    p_student_id: a.id, p_lang: 'en', p_due: due, p_note: 'Focus on past tenses this week',
    p_items: [
      { kind: 'words', title: 'Review 10 words', target: 10 },
      { kind: 'text', title: 'Read "A trip that went wrong"', target: 1 },
      { kind: 'writing', title: 'Write 120 words about your last holiday', target: 1 },
      { kind: 'free', title: 'Watch one episode of a series with English subtitles', target: 1 },
    ],
  }), 'домашка')
  void hw
  const items = must(await a.client.rpc('get_homework'), 'домашка ученицы').items
  const free = items.find((i) => i.kind === 'free')
  if (free) await a.client.rpc('complete_homework_item', { p_item: free.id })
  // серия: четыре дня подряд + сегодня; на сегодня — 4 повторённых слова
  const day = (n) => new Date(Date.parse(now) - n * 86400_000).toISOString().slice(0, 10)
  for (const n of [1, 2, 3, 4]) {
    await admin.from('activity_log').upsert({ user_id: a.id, day: day(n), type: 'flashcards', items_done: 8 + n, duration_sec: 300 }, { onConflict: 'user_id,day,type' })
  }
  await a.client.rpc('log_activity', { p_type: 'flashcards', p_day: day(0), p_items: 4, p_sec: 180 })
  // буксующие слова
  const deck = must(await admin.from('decks').insert({ owner_id: a.id, title: 'Мой словарь', lang: 'en' }).select('id').single(), 'колода')
  const words = [['reluctant', 'неохотный'], ['although', 'хотя'], ['accommodation', 'жильё'], ['bargain', 'выгодная покупка'], ['deadline', 'крайний срок']]
  for (const [i, [front, back]] of words.entries()) {
    const c = must(await admin.from('cards').insert({ deck_id: deck.id, front, back, source: 'manual' }).select('id').single(), 'карточка')
    await admin.from('review_states').insert({ card_id: c.id, user_id: a.id, stability: 1.2, difficulty: 8, due: new Date(Date.parse(now) - 3600_000).toISOString(), last_review: new Date(Date.parse(now) - 86400_000).toISOString(), reps: 6 + i, lapses: i < 3 ? 4 - i : 0, state: i < 3 ? 'relearning' : 'review' })
  }

  // письменные задания и сданные работы
  const task2 = must(await admin.from('writing_tasks').insert({ teacher_id: t.id, lang: 'en', mode: 'ielts', level: 'B2', prompt: 'Some people think that governments should spend money on public transport rather than on building new roads. To what extent do you agree or disagree?', settings: { ieltsTask: 'task2', targetBand: '6.5' } }).select('id').single(), 'письмо 1')
  must(await admin.from('writing_tasks').insert({ teacher_id: t.id, lang: 'en', mode: 'regular', level: 'A2', prompt: 'Write an email to a friend about your weekend plans (80-100 words).', settings: { targetWords: ['weekend', 'plan', 'visit'], targetGrammar: ['going to'], minWords: 80 } }).select('id').single(), 'письмо 2')
  const wa = must(await admin.from('writing_task_assignments').insert({ task_id: task2.id, student_id: a.id, status: 'submitted', submitted_at: new Date(Date.parse(now) - 5 * 3600_000).toISOString(), essay: ESSAY, ai_review: AI_REVIEW }).select('id').single(), 'сданное письмо')

  const mats = []
  for (const mt of MATERIALS) mats.push(must(await admin.from('materials').insert({ teacher_id: t.id, ...mt }).select('id').single(), 'материал'))
  const ma = must(await admin.from('material_assignments').insert({
    material_id: mats[3].id, student_id: s.id, status: 'submitted', submitted_at: new Date(Date.parse(now) - 26 * 3600_000).toISOString(),
    answers: [{ index: 0, given: 'No signal', auto_ok: true }, { index: 1, given: 'was driving', auto_ok: false }], auto_score: 1, auto_total: 2,
    // готовый разбор: без него экран проверки сам зовёт AI (ReviewScreen), а
    // снимок ловит «AI разбирает работу…» вместо проверки
    ai_review: [
      { index: 0, ok: true, comment: 'Верно: связи не было, поэтому друзья не могли позвать на помощь.' },
      { index: 1, ok: false, comment: 'Нужно «had been driving»: действие длилось до момента в прошлом — Past Perfect Continuous.' },
    ],
  }).select('id').single(), 'сданное задание')
  await admin.from('material_assignments').insert({ material_id: mats[2].id, student_id: a.id, status: 'assigned' })
  return { t, a, s, m, solo, nw, ca, wa: wa.id, ma: ma.id }
}

// ── браузер ───────────────────────────────────────────────────────────────────────
let browser = null
const text = (page) => page.evaluate(() => document.body.innerText)
const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })

async function newPage(width, extra = {}) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport(width < 600 ? { width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height: 800 })
  await page.evaluateOnNewDocument((ex) => {
    try {
      localStorage.setItem('recall.theme', 'dark')
      localStorage.setItem('recall.lang', 'en')
      if (!ex.fresh) localStorage.setItem('recall.onboarded', '1')
      if (ex.pending) localStorage.setItem('recall.pending_role', ex.pending)
    } catch {
      /* about:blank */
    }
  }, extra)
  return page
}
async function signIn(page, email) {
  await go(page, '/login')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Войти')?.click())
  await sleep(600)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 30000, polling: 250 })
  await sleep(1200)
}
async function putDraft(page, owner, scope, value) {
  await page.evaluate((k, v) => localStorage.setItem(k, JSON.stringify({ v, at: Date.now() })), `recall.draft.${owner}.${scope}`, value)
}
async function dropDrafts(page, owner, scopes) {
  await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), scopes.map((s) => `recall.draft.${owner}.${s}`))
}
async function click(page, label, timeout = 10000) {
  const ok = await page.waitForFunction((src) => { const l = src; return [...document.querySelectorAll('button, a')].some((x) => !x.closest('.vt-nav') && !x.disabled && (x.textContent.trim().includes(l) || x.getAttribute('aria-label') === l)) }, { polling: 250, timeout }, label).then(() => true, () => false)
  if (ok) await page.evaluate((l) => [...document.querySelectorAll('button, a')].reverse().find((x) => !x.closest('.vt-nav') && !x.disabled && (x.textContent.trim().includes(l) || x.getAttribute('aria-label') === l))?.click(), label)
  await sleep(700)
  return ok
}

const report = []
/** Снимок + проверка, что экран тот: expect — регэксп по тексту страницы. */
async function snap(page, name, width, expect, { fullPage = true } = {}) {
  // экран мог ещё не открыться (список карточек, переход): ждём нужный текст до 15 с
  await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText) && !document.querySelector('main :is(div, span).animate-pulse'), { polling: 250, timeout: 15000 }, expect.source).catch(() => {})
  await sleep(500)
  const look = () => text(page).catch(async () => { await sleep(1500); return text(page) })
  const wrong = (s) => /Не удалось загрузить|Нет связи/.test(s) || !expect.test(s)
  let t = await look()
  // один повтор с перезагрузкой: страница бывает пустой посреди
  // перезагрузки (прогон 11.10: белый d12-learn-390); пусто и после —
  // значит, экран правда сломан, и это видно в отчёте
  if (wrong(t)) {
    await page.reload({ waitUntil: 'networkidle2' }).catch(() => {})
    await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout: 15000 }, expect.source).catch(() => {})
    await sleep(1500)
    t = await look()
  }
  const bad = wrong(t)
  if (bad) {
    console.log(`НЕ ТОТ ЭКРАН: ${name}-${width} — ${t.replace(/\s+/g, ' ').slice(0, 150)}`)
    report.push(`✗ ${name}-${width}`)
  } else report.push(`✓ ${name}-${width}`)
  const file = `${DIR}/${name}-${width}.png`
  await settledScreenshot(page, { path: file, fullPage })
  console.log(`снимок ${file}`)
}
const open = async (page, path, settle = 2200) => {
  await go(page, path)
  await sleep(settle)
}
async function scrollPane(page) {
  await page.evaluate(() => {
    const pane = document.querySelector('[data-pane="detail"]')
    if (pane) pane.scrollTop = pane.scrollHeight
  })
  await sleep(500)
}

try {
  const { t, a, s, solo, nw, ca, wa, ma } = await seed()
  mkdirSync(DIR, { recursive: true })
  const PORT = 9700 + Math.floor(Math.random() * 200)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('shots-batch1')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  for (const width of [1280, 390]) {
    console.log(`── ширина ${width}`)
    // ── гость ──
    const g = await newPage(width)
    await open(g, '/teachers', 2500)
    await snap(g, 'd15-landing', width, /Recall/)
    await g.browserContext().close()

    // ── новый репетитор ──
    const n = await newPage(width, { fresh: true, pending: 'teacher' })
    await signIn(n, nw.email)
    await n.waitForFunction(() => location.pathname === '/onboarding', { timeout: 20000, polling: 250 }).catch(() => {})
    await sleep(1500)
    await click(n, 'English')
    await click(n, 'Английский')
    await sleep(500)
    await snap(n, 't10-onboarding-teacher', width, /преподаёшь|teach/i)
    await n.browserContext().close()

    // ── самоучка (только 1280) ──
    if (width === 1280) {
      const sp = await newPage(width)
      await signIn(sp, solo.email)
      await open(sp, '/')
      await snap(sp, 'd4-home-solo', width, /Привет/)
      await sp.browserContext().close()
    }

    // ── ученица ──
    const st = await newPage(width)
    await signIn(st, a.email)
    await open(st, '/', 3000)
    await snap(st, 'd4-home', width, /урок|Lesson|lesson/i)
    await open(st, '/settings')
    await snap(st, 'd14-settings-student', width, /Настройки|Settings/i)
    await st.browserContext().close()

    // ── репетитор ──
    const te = await newPage(width)
    await signIn(te, t.email)
    const shotT = (name, expect, opts) => snap(te, name, width, expect, opts)
    await open(te, '/tasks')
    await shotT('d7-tasks', /Задания/)
    await open(te, `/tasks?work=${ma}`)
    await shotT('d7-review-material', /Troubles|trip that went wrong|Әсел/i)
    await open(te, `/tasks?work=${wa}`)
    await shotT('d7-review-writing', /Band|Айгерим/)
    await open(te, '/tasks?tab=materials')
    await shotT('d8-materials', /Working from home|My morning/)

    // мастер материала: форма, план, текст — черновиками
    const req = { lang: 'en', level: 'B1', topic: 'Travel problems', format: 'рассказ', lengthRange: '250-400', vocabulary: 'delay, luggage, refund, complain', grammar: 'Past Perfect', studentIds: [a.id, s.id] }
    const plan = {
      comments: 'A short story about a delayed flight for B1. I picked 6 words on the topic "travel problems" and put the focus on Past Perfect. Two comprehension questions, one vocabulary and one grammar exercise.',
      vocabulary: ['delay', 'luggage', 'refund', 'complain', 'gate', 'compensation'],
      grammar_focus: 'Past Perfect',
      exercise_plan: [{ kind: 'comprehension', type: 'mcq', count: 2, note: 'questions about the story' }, { kind: 'vocab', type: 'mcq', count: 1, note: 'word from definition' }, { kind: 'grammar', type: 'fill', count: 1, note: 'Past Perfect in context' }],
    }
    const content = {
      title: 'The flight that never left',
      body: 'When we arrived at the airport, the flight had already been delayed for two hours. Nobody had told us about it, so we had waited at the wrong gate.\n\nAfter a long argument, the airline offered us a refund and a hotel room. My luggage had been sent to another city, and I had to complain at the information desk. In the end, we left the next morning, tired but happy that the trip was still possible.',
      exercises: [
        { kind: 'comprehension', type: 'mcq', prompt: 'Why did they wait at the wrong gate?', options: ['The airline had not told them about the delay', 'They arrived too late', 'They lost the tickets', 'The gate was closed'], answer: 0 },
        { kind: 'vocab', type: 'mcq', prompt: 'money you get back when you return something', options: ['luggage', 'refund', 'gate', 'delay'], answer: 1 },
        { kind: 'grammar', type: 'fill', prompt: 'The flight ___ already ___ delayed for two hours. (be)', answer: 'had been' },
      ],
    }
    const flow = (at) => ({ steps: [{ name: 'form' }, { name: 'plan', req, plan }, { name: 'preview', req, plan, content }], at })
    await open(te, '/tasks?tab=materials')
    await putDraft(te, t.id, 'material-request', { source: 'generate', ...req, body: '' })
    await putDraft(te, t.id, 'material-flow', flow(0))
    await open(te, '/tasks?tab=materials')
    await shotT('d8-material-form', /Новый материал|Для кого/)
    const forWhom = await te.evaluate(() => [...document.querySelectorAll('[data-for-whom] button')].filter((x) => x.className.includes('bg-accent-soft')).map((x) => x.textContent.trim()).join(' | '))
    console.log(`  «Для кого» отмечено: ${forWhom}`)
    await putDraft(te, t.id, 'material-flow', flow(1))
    await open(te, '/tasks?tab=materials')
    await shotT('d8-material-plan', /Past Perfect/)
    await putDraft(te, t.id, 'material-flow', flow(2))
    await open(te, '/tasks?tab=materials')
    await shotT('d8-material-text', /The flight that never left/)
    await dropDrafts(te, t.id, ['material-flow', 'material-request'])

    await open(te, '/tasks?tab=writing')
    await shotT('d9-writing', /Письменные задания/)
    await click(te, '+ Новое письмо')
    await sleep(800)
    await shotT('d9-writing-new', /IELTS/)
    await dropDrafts(te, t.id, ['writing-task'])
    await open(te, '/tasks?tab=guide')
    await shotT('d9-guide', /Методичка/)

    // ученики и карточка Айгерим
    if (width === 1280) {
      await open(te, `/teacher?student=${ca}`)
      await shotT('students', /Айгерим/)
    }
    await open(te, `/teacher?student=${ca}`, 3000)
    await shotT('d10-card', /Айгерим/)
    if (width === 1280) {
      await scrollPane(te)
      await shotT('d10-card-b', /Айгерим/)
    }
    for (const [sec, name, re] of [['diag', 'd10-diag', /Диагностика/], ['words', 'd10-words', /reluctant|Слова/], ['quests', 'd10-quests', /Квест/], ['placement', 'd11-placement', /Тест уровня/], ['program', 'd11-program-form', /Программа|Уровень ученика/]]) {
      await open(te, `/teacher?student=${ca}&sec=${sec}`, 2500)
      await shotT(name, re)
    }
    await go(te, `/teacher?student=${ca}&sec=program`)
    const prog = {
      level: 'B1', weeks: 4, goal: 'Speak confidently about travel and work; reach IELTS 6.5 writing', feedback: '', editing: false,
      preview: {
        summary: 'Four weeks: past tenses, travel vocabulary and a structured IELTS Task 2 essay',
        weeks: [
          { title: 'Week 1', focus: 'Past Simple vs Past Continuous', items: [{ type: 'grammar', title: 'Past Simple vs Past Continuous', note: 'Do the lesson and the exercises, then write 5 sentences about last weekend' }, { type: 'words', title: '20 words: travel', note: 'Learn with cards, 10 a day' }, { type: 'speech', title: 'Pronunciation: -ed endings', note: 'Repeat each phrase twice' }] },
          { title: 'Week 2', focus: 'Present Perfect and experience', items: [{ type: 'grammar', title: 'Present Perfect: experience', note: 'Have you ever...? Make 6 questions' }, { type: 'reading', title: 'Text: A trip that went wrong', note: 'Read and mark new words' }, { type: 'dialog', title: 'Dialog with AI: at the airport', note: '10 minutes, use 5 new words' }] },
          { title: 'Week 3', focus: 'Linking words and essay structure', items: [{ type: 'words', title: '15 linking words', note: 'however, moreover, in contrast...' }, { type: 'custom', title: 'IELTS Task 2: plan and introduction', note: 'Write only the plan and the first paragraph' }] },
          { title: 'Week 4', focus: 'Full essay and review', items: [{ type: 'custom', title: 'IELTS Task 2: full essay (250 words)', note: 'Submit through the app' }, { type: 'speech', title: 'Retell the essay aloud', note: 'Record yourself, 2 minutes' }, { type: 'words', title: 'Repeat all difficult words', note: 'Everything with 3+ mistakes' }] },
        ],
      },
    }
    await putDraft(te, t.id, `program:${a.id}:en`, prog)
    await open(te, `/teacher?student=${ca}&sec=program`, 2500)
    await shotT('d11-program', /Past Simple vs Past Continuous/)
    await dropDrafts(te, t.id, [`program:${a.id}:en`])

    // «Моя учёба» и её разделы — заходом из /learn
    await open(te, '/learn')
    await shotT('d12-learn', /Начать занятие/)
    for (const [href, name, re] of [['/study', 'd12-study', /Учёба|Study/i], ['/practice', 'd12-practice', /Практика|Practice/i], ['/conversation', 'd12-conversation', /Диалог/]]) {
      await open(te, '/learn', 1200)
      const clicked = await te.evaluate((h) => {
        const el = [...document.querySelectorAll(`main a[href="${h}"], a[href="${h}"]`)].find((x) => !x.closest('.vt-nav'))
        if (el) el.click()
        return !!el
      }, href)
      if (!clicked) await go(te, href)
      await sleep(2500)
      await shotT(name, re)
    }
    await open(te, '/invite')
    await shotT('d13-invite', /Пригласи|ссылк/i)
    await open(te, '/pay')
    await shotT('d13-pay', /Kaspi|оплат/i)
    await open(te, '/settings')
    await shotT('d14-settings-teacher', /Настройки|Settings/i)
    await te.browserContext().close()
    await sleep(60000) // лимит входов Supabase между ширинами
  }
} finally {
  await browser?.close().catch(() => {})
  for (const id of made) await deleteTestUser(admin, sql, id).catch((e) => console.log(`  ⚠ ${e.message}`))
  for (const k of ['teacher', 'aigerim', 'asel', 'meir', 'solo', 'newbie']) await admin.from('allowed_emails').delete().eq('email', E(k))
  console.log('\n' + report.join('\n'))
}
