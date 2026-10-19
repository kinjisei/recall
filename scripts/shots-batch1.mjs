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
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL } from './_env.mjs'
import { PASS, studio } from './_seed-studio.mjs'
import { settledScreenshot } from './_shots.mjs'

if (process.argv.includes('--prod')) {
  console.error('Снимки заводят аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'design/current'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = studio('shots-b1')

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
  const { t, a, s, solo, nw, ca, wa, ma } = await st.seed()
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
  await st.cleanup()
  console.log('\n' + report.join('\n'))
}
