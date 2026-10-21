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
 * «Практике» (шаг words), и в «Учёбе» (шаг reader). Это один класс, и
 * разъехаться они не должны.
 *
 * Занятие идёт по плану дня (журнал п.76 (10)): у ученика преподаватель с
 * планом «Грамматика · Диалог» — подпись под кнопкой «слова → грамматика →
 * диалог»; шаг сделан — плашка «Дальше» каркаса ведёт к следующему, последний
 * в «Диалоге» — «Занятие завершено» под полем ввода.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем `node scripts/smoke-guided.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const EMAIL = 'guided-smoke@recall.test'
const TEACHER_EMAIL = 'guided-smoke-teacher@recall.test'
const PASSWORD = 'Guided!2026'

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
  // серия есть, но пункты плана сегодня не тронуты: квест в план без квестов не входит
  await admin.from('activity_log').upsert(
    { user_id: userId, type: 'quest', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  // преподаватель с планом дня «Грамматика · Диалог», без заданий и квестов
  await admin.from('allowed_emails').upsert({ email: TEACHER_EMAIL, note: 'guided-smoke (временный)' })
  const { data: tu, error: te } = await admin.auth.admin.createUser({ email: TEACHER_EMAIL, password: PASSWORD, email_confirm: true })
  if (te && !/already/i.test(te.message)) throw new Error(te.message)
  const teacherId = tu?.user?.id ?? (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => (u.email ?? '').toLowerCase() === TEACHER_EMAIL)?.id
  await admin.from('teacher_students').upsert({ teacher_id: teacherId, student_id: userId, daily_plan: { kinds: ['grammar', 'conversation'], auto: false } }, { onConflict: 'teacher_id,student_id' })

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('guided')}`,
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

  // ---- 0. подпись под «Начать занятие» — по плану дня преподавателя --------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await page
    .waitForFunction(() => /Начать занятие/.test(document.body.innerText || ''), {
      timeout: 15000,
      polling: 300,
    })
    .catch(() => {})
  const caption = await page
    .waitForFunction(() => /~\d+ минут · [^\n]+/.exec(document.body.innerText || '')?.[0], { timeout: 10000, polling: 300 })
    .then((h) => h.jsonValue())
    .catch(() => null)
  check('подпись — по плану преподавателя: «~15 минут · слова → грамматика → диалог»', caption === '~15 минут · слова → грамматика → диалог', String(caption))

  // ---- 1. «Начать занятие» действительно уводит в повторение ---------------
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
    // сессия прежней версии (без списка шагов): слова → чтение → речь
    sessionStorage.removeItem('recall.guided.steps')
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

  // ---- 3б. брошенная сессия НЕ двигается сама -----------------------------
  // Раньше шаг переключался в инициализаторе useState баннера «Дальше», то есть
  // САМИМ ФАКТОМ отрисовки экрана результата: бросил занятие, потом дошёл до
  // конца любого раунда — и сессия молча уезжала на чтение.
  //
  // ⚠️ Раунд здесь не проходим: он свайповый, и «прокликать» его хрупко.
  // Первая версия проверки так и делала — кнопок не находила, до баннера не
  // доходила и оставалась зелёной даже на сломанном коде (поймано мутацией).
  // Вместо этого отодвигаем расписание: очередь пуста → экран сразу показывает
  // итог, а вместе с ним и баннер. Именно его отрисовка и была триггером.
  const { data: cards } = await admin.from('cards').select('id').eq('deck_id', deck.id)
  const soon = new Date(Date.now() + 30 * 86400_000).toISOString()
  await admin.from('review_states').upsert(
    (cards ?? []).map((c) => ({
      card_id: c.id,
      user_id: userId,
      state: 'review',
      due: soon,
      last_review: new Date().toISOString(),
      reps: 3,
      lapses: 0,
    })),
    { onConflict: 'card_id,user_id' },
  )
  await page.evaluate(() => {
    // сессия прежней версии (шаг flashcards, без списка шагов) — должна жить дальше
    sessionStorage.removeItem('recall.guided.steps')
    sessionStorage.removeItem('recall.guided.done')
    sessionStorage.setItem('recall.guided', 'flashcards')
    sessionStorage.setItem('recall.guided.opened', 'words')
  })
  await page.goto(`${BASE}/practice?m=review`, { waitUntil: 'networkidle2' })
  const bannerShown = await page
    // ⚠️ Регистронезависимо: у подписи CSS uppercase, и innerText отдаёт её
    // уже преобразованной («ЗАНЯТИЕ ПРОДОЛЖАЕТСЯ»). На этом смоук уже спотыкался.
    .waitForFunction(() => /занятие продолжается/i.test(document.body.innerText || ''), {
      timeout: 15000,
      polling: 300,
    })
    .then(() => true)
    .catch(() => false)
  check(
    'баннер «Занятие продолжается» отрисован',
    bannerShown,
    bannerShown
      ? ''
      : (await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160))) +
        ' | шаг: ' +
        (await page.evaluate(() => sessionStorage.getItem('recall.guided'))),
  )
  const stepAfterBanner = await page.evaluate(() => sessionStorage.getItem('recall.guided'))
  check(
    'сама отрисовка баннера сессию НЕ двигает',
    stepAfterBanner === 'flashcards',
    `шаг: ${stepAfterBanner}`,
  )

  // ---- 3в. шаги плана без своего экрана итога: плашка «Дальше» каркаса ------
  // Грамматика сделана (активность записалась) — под экраном «Дальше: диалог»;
  // нажал — «Диалог», сессия на нём. Последний шаг сделан — «Занятие
  // завершено» под полем ввода, сессия закрыта.
  const plan = [
    { key: 'grammar', to: '/grammar', types: ['grammar'] },
    { key: 'conversation', to: '/conversation', types: ['conversation', 'writing'] },
  ]
  await page.evaluate((steps) => {
    sessionStorage.setItem('recall.guided.steps', JSON.stringify(steps))
    sessionStorage.setItem('recall.guided', 'grammar')
    sessionStorage.setItem('recall.guided.done', 'grammar')
  }, plan)
  await page.goto(`${BASE}/grammar`, { waitUntil: 'networkidle2' })
  const nextBar = await page
    .waitForSelector('[data-guided-bar="next"]', { timeout: 10000 })
    .then((el) => el.evaluate((e) => e.innerText))
    .catch(() => '')
  check('шаг «Грамматика» сделан — под экраном «Дальше: диалог»', /шаг 1 из 2 готов/i.test(nextBar) && /Дальше: диалог/.test(nextBar), nextBar.replace(/\s+/g, ' '))
  await page.evaluate(() => document.querySelector('[data-guided-bar="next"]')?.click())
  await page.waitForFunction(() => location.pathname === '/conversation', { timeout: 10000, polling: 250 }).catch(() => {})
  const moved = await page.evaluate(() => [location.pathname, sessionStorage.getItem('recall.guided'), sessionStorage.getItem('recall.guided.done')])
  check('«Дальше» → «Диалог», сессия на нём, сделанного нет', moved[0] === '/conversation' && moved[1] === 'conversation' && moved[2] === null, JSON.stringify(moved))
  await page.evaluate(() => sessionStorage.setItem('recall.guided.done', 'conversation'))
  await page.goto(`${BASE}/conversation`, { waitUntil: 'networkidle2' })
  const finished = await page
    .waitForSelector('[data-guided-bar="done"]', { timeout: 10000 })
    .then(() => true)
    .catch(() => false)
  const closed = await page.evaluate(() => sessionStorage.getItem('recall.guided'))
  check('последний шаг сделан — «Занятие завершено», сессия закрыта', finished && closed === null, `закрыта: ${closed === null}`)

  // ---- 4. новая сессия снова имеет право увести ----------------------------
  // слова снова к повторению (в 3б расписание отодвигали) — иначе шаг слов законно пропускается
  await admin.from('review_states').update({ due: new Date(Date.now() - 3600_000).toISOString() }).eq('user_id', userId)
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
  if (teacherId) await admin.auth.admin.deleteUser(teacherId).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', TEACHER_EMAIL)
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
