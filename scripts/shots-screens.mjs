/**
 * Снимки экранов по макетам компьютера (PLAN.md Ф2.17-4) для приёмки
 * владельцем: свои снимки кладутся рядом с кадрами макетов. Данные — студия
 * Мадины Сейткали (`_seed-studio.mjs`), AI не вызывается, наружу ничего не
 * уходит, аккаунты удаляются сами.
 *
 * Заход 4а — Главная ученика (макеты u1, d4-v2):
 *   home      — Айгерим: урок в 19:00, домашка 1 из 4, серия, слова к повторению;
 *   home-soon — она же, урок через 5 минут (u1-2, d4-v2-2);
 *   home-solo — самоучка Диас (u1-3, d4-v2-3).
 * Заход 4б-1 — список «Учеников» (макеты t6-1, d3-1, d3-3, d3-5):
 *   students      — никто не выбран (на компьютере справа «Требуют внимания»);
 *   students-sort — меню сортировки открыто;
 *   students-card — выбрана Айгерим (d10-1, t6-2);
 * Заход 4б-2 — карточка ученика (макеты d10-1, t6-2…t6-4):
 *   students-card-menu  — у Айгерим открыто меню «⋯» (t6-3);
 *   students-card-noapp — Тимур без приложения: «Пригласить в Recall» (t6-4);
 *   students-diag       — раздел «Диагностика» Айгерим (d10-2);
 *   students-words      — «Слова», отмечены три (d10-3);
 *   students-quests     — «Квесты»: пусто и форма (d10-4).
 * Заход 4б-3 — отмена урока и диалог по центру (макеты t5-2, d2-2, s3):
 *   cancel          — «Отменить урок» Айгерим: серия «вт и чт» 19:00,
 *                     остаток 3, уведомления включены — как в кадре t5-2;
 *   cancel-confirm  — «Этот и все следующие» → «Отменить уроки?»;
 *   material-delete — «Удалить материал?» в «Материалах»;
 *   reassign        — «Вернуть на доработку?» с полем (был window.prompt).
 * Заход 4в-1 — «Задания» (макеты d7-1…d7-4, t1-3):
 *   tasks          — хаб: Айгерим сдала письмо сегодня, Әсел — задание вчера;
 *   tasks-material — проверка задания Әсел (d7-2);
 *   tasks-writing  — проверка письма Айгерим (d7-3, d7-4): правка 1 выбрана
 *                    (нажата в тексте), последняя убрана;
 *   tasks-empty    — проверять нечего (схема d7-1): работы проверены.
 * Заход 4в-2 — «Материалы» (макеты d8):
 *   materials      — библиотека: «На проверку», уровни, ничего не выбрано
 *                    (на телефоне — список);
 *   materials-open — открыт «A trip that went wrong» с работой Әсел на
 *                    проверке (d8-1; на телефоне — экран материала).
 * Заход 4в-2б — мастер нового материала (d8-2…d8-5), шаги — черновиком,
 * как после перезагрузки (строку «Черновик восстановлен» перед снимком
 * убираем — в макете мастер открыт впервые); AI не зовётся — запрос к
 * /api/gemini висит:
 *   wizard-form    — заявка: Айгерим и Әсел, A2, «Travel problems» (d8-2);
 *   wizard-plan    — план от AI, бесплатные повторы есть (d8-3);
 *   wizard-writing — «Новый текст →» нажат, AI пишет — скелетон (d8-5);
 *   wizard-text    — текст готов, слова плана подсвечены (d8-4, 1440).
 * Заход 4в-3 — письменные задания и методичка (d9):
 *   writing     — список и открытый Task 2: Айгерим сдала, Мейір проверен,
 *                 Әсел назначено (d9-1);
 *   writing-new — «Новое письмо» панелью, вопрос придумал AI (d9-2; вопрос —
 *                 черновиком, AI не зовётся);
 *   guide       — методичка, прокручена до раздела 2 (d9-3), снимок окном.
 * Заходы 4г (d11–d15) — экраны и данные в `_shots-4g.mjs`: тест уровня, программа, «Моя учёба»,
 * «Пригласи коллегу», «Как оплатить», Настройки, лендинг (гость — без входа: `screen(null, …)`).
 * Аудит у них — по шторке или диалогу (`audit`), а не по <main> под
 * затемнением; снимок — ровно окном (`overlay`), как кадры t5-2 и d2-2.
 * Ширины 390 и 1280 — в четырёх вариантах вида («Сумерки» и «Закат» ×
 * светлая и тёмная), 1440 — светлые «Сумерки». Имя файла —
 * `<экран>-<палитра>-<тема>-<ширина>.png`. На каждом снимке — UX-аудит
 * `<main>` (`_ux-audit-page`: контраст, цели касания, подписи): замечание —
 * красная строка в итоге. Телефон снимается окном во всю высоту страницы.
 *
 * Запуск: npm run dev:test, затем node scripts/shots-screens.mjs [папка]
 * [--only home|students|schedule|cancel|tasks|materials|wizard|writing|program|learn|invite|settings|landing] [--name экран,экран] (по умолчанию shots-screens/,
 * все экраны; --name — только эти снимки, для быстрой сверки). ~10 мин.
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL } from './_env.mjs'
import { PASS, admin, must, sql, studio } from './_seed-studio.mjs'
import { settleAnimations, settledScreenshot, waitForData } from './_shots.mjs'
import { auditPage } from './_ux-audit-page.mjs'
import { shotsInvitePay, shotsLanding, shotsLearn, shotsProgram, shotsSettings } from './_shots-4g.mjs'
import { shotsSchedule } from './_shots-4d.mjs'

if (process.argv.includes('--prod')) {
  console.error('Снимки заводят аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'shots-screens'
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
const NAMES = process.argv.includes('--name') ? process.argv[process.argv.indexOf('--name') + 1].split(',') : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = studio('shots-scr')

const LOOKS = [
  ['twilight', 'light'],
  ['twilight', 'dark'],
  ['sunset', 'light'],
  ['sunset', 'dark'],
]

let browser = null
const report = []

async function newPage(width) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  // высота окна — как у кадров макетов: телефон 844, 1280 × 800, 1440 × 900
  await page.setViewport(width < 600 ? { width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height: width >= 1440 ? 900 : 800 })
  await page.evaluateOnNewDocument(() => {
    try {
      // язык — английский студии, если снимок не попросил другой (shots.lang: «Моя учёба» на испанском)
      localStorage.setItem('recall.lang', localStorage.getItem('shots.lang') || 'en')
      localStorage.setItem('recall.onboarded', '1')
    } catch {
      /* about:blank */
    }
    // AI не зовём: снимки мастера — запрос висит («AI пишет»); shots.aiReply —
    // готовый ответ без сервера (черновик программы, 4г-1)
    const orig = window.fetch
    window.fetch = (input, init) => {
      if (!String(input?.url ?? input).includes('/api/gemini')) return orig(input, init)
      const reply = localStorage.getItem('shots.aiReply')
      if (reply) return Promise.resolve(new Response(JSON.stringify({ text: reply }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      return localStorage.getItem('shots.aiHang') === '1' ? new Promise(() => {}) : orig(input, init)
    }
  })
  return page
}

async function signIn(page, email) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Войти')?.click())
  await sleep(600)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 30000, polling: 250 })
  await sleep(1200)
}

/**
 * Один экран во всех вариантах вида на этой ширине; expect — текст, по
 * которому видно, что экран тот; prepare — что сделать перед снимком
 * (открыть меню); wait — чего дождаться сверх expect (слово дня); tall —
 * высота окна компьютера, если кадр макета снят выше 800 (d10-2 — «во всю
 * высоту»: панель раздела прокручивается внутри, снимок страницы её не
 * удлинит); audit — где искать замечания (по умолчанию <main>); overlay —
 * шторка или диалог поверх экрана: снимок ровно окном, как кадр макета (на
 * всю страницу закреплённая шторка висела бы вверху длинной картинки).
 */
async function shoot(page, name, path, width, expect, looks, { before, prepare, wait, tall, audit = 'main', overlay = false } = {}) {
  const base = page.viewport()
  if (tall && width >= 600) await page.setViewport({ ...base, height: tall })
  for (const [palette, theme] of looks) {
    await page.evaluate((p, t) => {
      localStorage.setItem('recall.palette', p)
      localStorage.setItem('recall.theme', t)
    }, palette, theme)
    if (before) await before(page)
    await page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
    const ok = await page
      .waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout: 15000 }, expect.source)
      .then(() => true, () => false)
    if (wait) await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout: 8000 }, wait.source).catch(() => {})
    await sleep(600)
    if (prepare) await prepare(page)
    // контраст и цели касания (правила ui-ux-pro-max) — в каждом варианте вида.
    // ДО снимка и после доигранных анимаций: снимок всей страницы меняет окно и
    // перезапускает появление, и аудит ловил полупрозрачный текст («Войти в
    // урок» 3,3 : 1 вместо 5 : 1 — прогон 20.10.2026)
    // заглушка не ушла за 10 с — снимок не годится для приёмки: ✗ в итоге, а не тихий ✓
    const loaded = await waitForData(page)
    await settleAnimations(page)
    const issues = await page.evaluate(auditPage, audit)
    const file = `${DIR}/${name}-${palette}-${theme}-${width}.png`
    // телефон — окном во всю высоту страницы: при снимке fullPage закреплённая
    // панель вкладок висит посреди картинки, а не внизу, как у человека
    const vp = page.viewport()
    const stretch = width < 600 && !overlay
    if (stretch) {
      const h = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewport({ ...vp, height: Math.max(vp.height, h) })
      await sleep(400)
    }
    await settledScreenshot(page, { path: file, fullPage: width >= 600 && !overlay })
    if (stretch) await page.setViewport(vp)
    report.push(`${ok && loaded ? '✓' : '✗'} ${file}${loaded ? '' : ' — заглушка загрузки не ушла за 10 с'}`)
    report.push(`${issues.length ? '✗' : '✓'} UX ${file}: ${issues.length ? JSON.stringify(issues.slice(0, 3)) : '0 замечаний'}`)
    console.log(`${ok ? 'снимок' : 'НЕ ТОТ ЭКРАН'} ${file}${issues.length ? ` — UX: ${issues.length}` : ''}`)
  }
  if (tall && width >= 600) await page.setViewport(base)
}

/** Экран на 390 и 1280 в четырёх вариантах, 1440 — светлые «Сумерки». */
async function screen(email, shots) {
  for (const width of [390, 1280, 1440]) {
    const page = await newPage(width)
    await (email ? signIn(page, email) : page.goto(APP_URL + '/teachers', { waitUntil: 'networkidle2' }))
    for (const s of shots) {
      if ((s.wide && width < 600) || (NAMES && !NAMES.includes(s.name))) continue
      await shoot(page, s.name, s.path, width, s.expect, width === 1440 ? LOOKS.slice(0, 1) : LOOKS, s)
    }
    await page.browserContext().close()
  }
}

/** Открыть меню «⋯» карточки ученика (t6-3). */
const openCardMenu = async (page) => {
  await page.evaluate(() => document.querySelector('[aria-label="Действия с учеником"]')?.click())
  await page.waitForSelector('[role="menu"]', { timeout: 3000 }).catch(() => {})
  await sleep(300)
}

/** Отметить три первых слова в разделе «Слова» (d10-3). */
const pickThreeWords = async (page) => {
  await page.evaluate(() => [...document.querySelectorAll('[data-studio-section="words"] input[type=checkbox]')].slice(0, 3).forEach((b) => b.click()))
  await sleep(300)
}

/** Открыть меню сортировки «Учеников» (d3-5, t6-1). */
const openSort = async (page) => {
  await page.evaluate(() => document.querySelector('[data-roster-head] button[aria-haspopup="menu"]')?.click())
  await page.waitForSelector('[role="menu"]', { timeout: 3000 }).catch(() => {})
  await sleep(300)
}

/** Проверка письма как в кадре d7-3: правка 1 выбрана (нажата в тексте), последняя убрана. */
const pickFixes = async (page) => {
  // черновик прошлого варианта вида — сбросить: в кадре его нет
  await press(page, 'Очистить')
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-fix]')]
    rows.at(-1)?.querySelectorAll('[role="radio"]')[1]?.click()
  })
  await sleep(200)
  // правку 1 нажимаем в тексте, как в кадре; текст и окно — снова к началу
  await page.evaluate(() => [...document.querySelectorAll('[data-mark]')].find((m) => m.querySelector('sup')?.textContent === '1')?.click())
  await sleep(700)
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.querySelector('[data-text-pane]')?.scrollTo(0, 0)
  })
  await sleep(300)
}

/** Нажать кнопку с подписью — последнюю в документе (шторка поверх экрана). */
const press = async (page, label) => {
  await page.evaluate((l) => [...document.querySelectorAll('button')].reverse().find((b) => b.textContent.trim() === l && !b.disabled)?.click(), label)
  await sleep(500)
}
const askOpen = (page) => page.waitForSelector('[role="alertdialog"]', { timeout: 5000 }).catch(() => {})
/** Шторка «Отменить урок» из шторки урока (t5-2). */
const openCancel = async (page) => {
  await press(page, 'Отменить урок')
  await page.waitForFunction(() => /Списать урок\?/.test(document.body.innerText), { polling: 250, timeout: 5000 }).catch(() => {})
}
/** «Этот и все следующие» → «Отменить уроки» → диалог по центру. */
const openSeriesAsk = async (page) => {
  await openCancel(page)
  await press(page, 'Этот и все следующие')
  await press(page, 'Отменить уроки')
  await askOpen(page)
}
const askOn = (label) => async (page) => {
  await press(page, label)
  await askOpen(page)
}

try {
  mkdirSync(DIR, { recursive: true })
  console.log('── студия')
  const { t, a, s, solo, ca, cm, card, wa, ma, wt } = await st.seed()
  const PORT = 9700 + Math.floor(Math.random() * 200)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir('shots-screens')}`, '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  if (!ONLY || ONLY === 'students') {
    console.log('── «Ученики»')
    await screen(t.email, [
      { name: 'students', path: '/teacher', expect: /Ученики · \d/ },
      { name: 'students-sort', path: '/teacher', expect: /Ученики · \d/, prepare: openSort },
      { name: 'students-card', path: `/teacher?student=${ca}`, expect: /Айгерим Нурланова[\s\S]*Домашка на неделю/ },
      { name: 'students-card-menu', path: `/teacher?student=${ca}`, expect: /Айгерим Нурланова[\s\S]*Домашка на неделю/, prepare: openCardMenu },
      { name: 'students-card-noapp', path: `/teacher?student=${card['Тимур']}`, expect: /Тимур Ким[\s\S]*Пригласить в Recall/ },
      { name: 'students-diag', path: `/teacher?student=${ca}&sec=diag`, expect: /Динамика за месяц[\s\S]*Последнее занятие/, wait: /Письмо IELTS/, tall: 1160 },
      { name: 'students-words', path: `/teacher?student=${ca}&sec=words`, expect: /Отметь слова для перепроверки/, prepare: pickThreeWords },
      { name: 'students-quests', path: `/teacher?student=${ca}&sec=quests`, expect: /Квестов пока нет[\s\S]*Новый квест/ },
    ])
  }
  if (!ONLY || ONLY === 'cancel') {
    // как в кадре t5-2: у Айгерим не разовые уроки, а серия «вт и чт» в 19:00
    // (разовые впереди убираем — иначе два урока в один час), остаток 3 и
    // включённые уведомления — «Айгерим получит уведомление»
    await sql(`delete from public.lessons l where l.teacher_id = '${t.id}' and l.series_id is null and l.starts_at > now()
      and exists (select 1 from public.lesson_participants p where p.lesson_id = l.id and p.card_id = '${ca}')`)
    const [{ today }] = await sql(`select (now() at time zone 'Asia/Almaty')::date::text as today`)
    const ser = must(await t.client.rpc('create_series', { p_kind: 'individual', p_weekdays: [2, 4], p_time: '19:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: today, p_cards: [ca] }), 'серия Айгерим')
    await sql(`insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
      values ('https://fcm.googleapis.com/fcm/send/shots-${a.id}', '${a.id}', '${'B'.repeat(87)}', '${'A'.repeat(22)}') on conflict do nothing`)
    const rows = must(await t.client.rpc('get_schedule', { p_from: new Date().toISOString(), p_to: new Date(Date.now() + 14 * 864e5).toISOString() }), 'расписание')
    const next = rows.filter((r) => r.series_id === ser && r.status === 'planned').sort((x, y) => x.starts_at.localeCompare(y.starts_at))[0]
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date(next.starts_at))
    const [mat] = must(await admin.from('materials').select('id').eq('teacher_id', t.id).eq('title', 'My morning routine'), 'материал')
    const lesson = `/schedule?view=day&day=${day}&lesson=${next.lesson_id}`
    console.log('── отмена урока и диалоги')
    await screen(t.email, [
      { name: 'cancel', path: lesson, expect: /Перенести[\s\S]*Отменить урок/, prepare: openCancel, audit: '[role="dialog"]', overlay: true },
      { name: 'cancel-confirm', path: lesson, expect: /Перенести[\s\S]*Отменить урок/, prepare: openSeriesAsk, audit: '[role="alertdialog"]', overlay: true },
      { name: 'material-delete', path: `/tasks?tab=materials&mat=${mat.id}`, expect: /Удалить материал/, prepare: askOn('Удалить материал'), audit: '[role="alertdialog"]', overlay: true },
      { name: 'reassign', path: `/tasks?work=${wa}`, expect: /На доработку/, prepare: askOn('На доработку'), audit: '[role="alertdialog"]', overlay: true },
    ])
  }
  if (!ONLY || ONLY === 'materials') {
    console.log('── «Материалы»')
    const [trip] = must(await admin.from('materials').select('id').eq('teacher_id', t.id).eq('title', 'A trip that went wrong'), 'материал')
    await screen(t.email, [
      { name: 'materials', path: '/tasks?tab=materials', expect: /На проверку[\s\S]*A trip that went wrong/ },
      { name: 'materials-open', path: `/tasks?tab=materials&mat=${trip.id}`, expect: /Выдан:[\s\S]*Упражнения/ },
    ])
  }
  if (!ONLY || ONLY === 'wizard') {
    console.log('── мастер материала')
    const req = { lang: 'en', level: 'A2', topic: 'Travel problems', format: 'рассказ', lengthRange: '100-140', vocabulary: 'delay, luggage, boarding pass', grammar: 'Past Simple', studentIds: [a.id, s.id] }
    const plan = {
      comments: 'Рассказ: Дана летит из Алматы в Стамбул — рейс задерживают, она опаздывает на пересадку, а багаж теряется. Короткие предложения в Past Simple, слова — на уровне A2.',
      vocabulary: ['delay', 'luggage', 'boarding pass', 'gate', 'miss a flight'],
      grammar_focus: 'Past Simple',
      exercise_plan: [
        { kind: 'comprehension', type: 'fill', count: 2, note: 'Вопросы по сюжету: почему Дана ждала у выхода, что случилось в Стамбуле' },
        { kind: 'vocab', type: 'mcq', count: 1, note: 'Сопоставить 4 целевых слова с переводом' },
      ],
    }
    const content = {
      title: 'A long day at the airport',
      body: 'Last summer Dana flew from Almaty to Istanbul. She came to the airport early, but the screen said: “Delay — 3 hours”. Dana was not happy. She bought a coffee and waited near the gate.\n\nThe plane left very late, and in Istanbul Dana had only forty minutes for her next flight. She ran through the airport with her boarding pass in her hand. But the gate was already closed. She missed her flight!\n\nA woman at the desk was very kind. She gave Dana a ticket for the evening flight. Then Dana went to get her luggage, but her bag was not there. “Don’t worry,” the woman said. “It is on the next plane.” Dana laughed. What a day!',
      exercises: [
        { kind: 'comprehension', type: 'fill', prompt: 'Why did Dana wait near the gate for three hours?', answer: 'Her flight had a delay.' },
        { kind: 'comprehension', type: 'fill', prompt: 'What happened when Dana got to the gate in Istanbul?', answer: 'It was closed — she missed her flight.' },
        { kind: 'vocab', type: 'mcq', prompt: 'luggage — это…', options: ['багаж', 'выход на посадку', 'задержка', 'посадочный талон'], answer: 0 },
      ],
    }
    const steps = [{ name: 'form' }, { name: 'plan', req, plan, replan: { id: '00000000-0000-4000-8000-000000000000', left: 3 } }, { name: 'preview', req, plan, content }]
    const drafts = (at) => async (page) =>
      page.evaluate(
        (uid, flow, form) => {
          const put = (k, v) => localStorage.setItem(`recall.draft.${uid}.${k}`, JSON.stringify({ v, at: Date.now() }))
          for (const k of Object.keys(localStorage)) if (k.startsWith(`recall.draft.${uid}.material-`)) localStorage.removeItem(k)
          put('material-flow', flow)
          put('material-request', form)
          localStorage.setItem('shots.aiHang', '1')
        },
        t.id,
        { steps: steps.slice(0, at + 1), at },
        { source: 'generate', ...req, body: '' },
      )
    // в макете мастер открыт впервые — строки «Черновик восстановлен» нет
    const fresh = (page) => page.evaluate(() => [...document.querySelectorAll('main p')].filter((p) => p.textContent.startsWith('Черновик восстановлен')).forEach((p) => p.remove()))
    const writing = async (page) => {
      await fresh(page)
      await press(page, 'Новый текст →')
      await page.waitForFunction(() => document.body.innerText.includes('AI пишет текст'), { polling: 250, timeout: 5000 }).catch(() => {})
    }
    await screen(t.email, [
      { name: 'wizard-form', path: '/tasks?tab=materials', before: drafts(0), prepare: fresh, expect: /Новый материал[\s\S]*Итог/ },
      { name: 'wizard-plan', path: '/tasks?tab=materials', before: drafts(1), prepare: fresh, expect: /План от AI[\s\S]*Итог/ },
      { name: 'wizard-writing', path: '/tasks?tab=materials', before: drafts(1), prepare: writing, expect: /План от AI/ },
      { name: 'wizard-text', path: '/tasks?tab=materials', before: drafts(2), prepare: fresh, expect: /A long day at the airport/ },
    ])
  }
  if (!ONLY || ONLY === 'writing') {
    console.log('── «Письменные задания» и методичка')
    const QUESTION = 'Many people believe that tourism does more harm than good to local communities. To what extent do you agree or disagree?'
    // «Новое письмо» с вопросом от AI — черновиком формы (раздел с черновиком открывает панель сам)
    const newDraft = async (page) =>
      page.evaluate(
        (uid, q) => {
          localStorage.setItem(
            `recall.draft.${uid}.writing-task`,
            JSON.stringify({ v: { mode: 'ielts', lang: 'en', level: 'B1', ieltsTask: 'task2', targetBand: '6.5', chartKind: 'bar', chartTopic: '', chart: null, prompt: q, aiPrompt: q, targetWords: '', targetGrammar: '', minWords: '150' }, at: Date.now() }),
          )
        },
        t.id,
        QUESTION,
      )
    const noDraft = async (page) => page.evaluate((uid) => localStorage.removeItem(`recall.draft.${uid}.writing-task`), t.id)
    // в макете форма открыта впервые — строки «Черновик восстановлен» нет (панель — вне <main>)
    const freshAll = (page) => page.evaluate(() => [...document.querySelectorAll('p')].filter((p) => p.textContent.startsWith('Черновик восстановлен')).forEach((p) => p.remove()))
    const toSection2 = async (page) => {
      await page.evaluate(() => document.getElementById('guide-diagnostics')?.scrollIntoView({ block: 'start' }))
      await sleep(800)
    }
    await screen(t.email, [
      { name: 'writing', path: `/tasks?tab=writing&wt=${wt}`, before: noDraft, expect: /Назначить ученикам[\s\S]*Удалить задание/ },
      { name: 'writing-new', path: `/tasks?tab=writing&wt=${wt}`, before: newDraft, prepare: freshAll, expect: /Новое письмо[\s\S]*Создать/, audit: '[role="dialog"]', overlay: true },
      { name: 'guide', path: '/tasks?tab=guide', before: noDraft, prepare: toSection2, expect: /Методичка[\s\S]*Содержание/, overlay: true },
    ])
  }
  if (!ONLY || ONLY === 'tasks') {
    console.log('── «Задания»')
    await screen(t.email, [
      { name: 'tasks', path: '/tasks', expect: /Проверка работ[\s\S]*Проверить/ },
      { name: 'tasks-material', path: `/tasks?work=${ma}`, expect: /AI предлагает засчитать/ },
      // окном 1800 — кадр d7-3 «во всю высоту»: закреплённые кнопки встают в конце панели
      { name: 'tasks-writing', path: `/tasks?work=${wa}`, expect: /Твоя проверка/, prepare: pickFixes, tall: 1800 },
    ])
    // проверять нечего: обе работы проверены — строка «Всё проверено · последняя работа — …»
    must(await admin.from('writing_task_assignments').update({ status: 'reviewed' }).eq('id', wa), 'письмо проверено')
    must(await admin.from('material_assignments').update({ status: 'reviewed' }).eq('id', ma), 'задание проверено')
    await screen(t.email, [{ name: 'tasks-empty', path: '/tasks', expect: /Всё проверено/ }])
  }
  if (!ONLY || ONLY === 'program') {
    console.log('── «Тест уровня» и «Программа»')
    await shotsProgram({ screen, sql, must, t, a, ca, cm, sleep })
  }
  if (!ONLY || ONLY === 'learn') {
    console.log('── «Моя учёба»')
    await shotsLearn({ screen, sql, admin, must, t })
  }
  if (!ONLY || ONLY === 'invite') {
    console.log('── «Пригласи коллегу» и «Как оплатить»')
    await shotsInvitePay({ screen, sql, t })
  }
  if (!ONLY || ONLY === 'settings') {
    console.log('── Настройки')
    await shotsSettings({ screen, t, a })
  }
  if (!ONLY || ONLY === 'schedule') await shotsSchedule({ screen, sql, t }) // расписание: день t2-1, неделя t2-2 и d1 (4д-4а)
  if (!ONLY || ONLY === 'landing') await shotsLanding({ screen, t }) // лендинг (d15): гость и в рамке у репетитора
  if (!ONLY || ONLY === 'home') {
    const word = /Слово дня/
    console.log('── Главная ученицы')
    await screen(a.email, [{ name: 'home', path: '/', expect: /Ближайший урок/, wait: word }])
    console.log('── Главная самоучки')
    await screen(solo.email, [{ name: 'home-solo', path: '/', expect: /Занимаешься с преподавателем/, wait: word }])
    // урок через 5 минут: карточка урока становится главной (u1-2, d4-v2-2)
    const soon = new Date(Date.now() + 5 * 60_000).toISOString()
    must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: soon, p_minutes: 45, p_cards: [ca] }), 'урок через 5 минут')
    console.log('── Главная за 10 минут до урока')
    await screen(a.email, [{ name: 'home-soon', path: '/', expect: /Урок через/, wait: word }])
  }
} catch (e) {
  console.error('СБОЙ:', e.message)
  report.push(`✗ сбой: ${e.message}`)
} finally {
  await browser?.close().catch(() => {})
  await st.cleanup()
  console.log('\n' + report.join('\n'))
  const bad = report.filter((r) => r.startsWith('✗')).length
  console.log(`\nИтог: ${report.length - bad}/${report.length}`)
  process.exit(bad ? 1 : 0)
}
