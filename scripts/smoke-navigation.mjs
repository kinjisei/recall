/**
 * Смоук сквозной навигации: «назад» и F5 на внутренних экранах.
 *
 * Зачем. Ревью 1Г (docs/mkt/20-ux-review-1g-navigation.md) замерило, что больше
 * половины внутренних экранов не существует для истории браузера: «назад» из
 * открытого текста ведёт на Главную мимо списка, F5 теряет место. В PWA на
 * телефоне свайп-назад — единственный способ вернуться, поэтому это не мелочь.
 *
 * Что проверяет. Для каждого внутреннего экрана три вещи:
 *   1. дошли  — экран открылся (виден его маркер);
 *   2. назад  — браузерный «назад» возвращает НА ШАГ, а не на Главную;
 *   3. F5     — перезагрузка оставляет на том же экране.
 *
 * Эталон «как надо» — сценарий «Практика», где режим лежит в адресе (?m=).
 *
 * Меню по роли (PLAN.md Ф2.10, макет t1): ученику — прежнее меню, экраны
 * студии — приглашение; учитель стартует в расписании, видит Расписание ·
 * Ученики · Задания · Моя учёба (и на 1280 — слева), «ждут проверки» на
 * «Заданиях»; хаб «Заданий» открывает разбор сданной работы, разделы и
 * открытый материал — в адресе; старые ссылки /teacher?tab=… ведут во
 * «Задания»; «Моя учёба» — плитки в экраны ученика.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем `node scripts/smoke-navigation.mjs`.
 * Аккаунт создаётся и удаляется сам (service_role из .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const EMAIL = 'nav-smoke@recall.test'
const STUDENT_EMAIL = 'nav-smoke-st@recall.test'
const PASSWORD = 'NavSmoke!2026'

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Клик по тексту ВНУТРИ страницы: handle.click() перехватывают анимации
 * (конфетти, шторки), из-за чего смоук падал там, где продукт был исправен.
 */
async function tap(page, text, sel = 'button, a, [role=button]') {
  const ok = await page.evaluate(
    (s, t) => {
      const el = [...document.querySelectorAll(s)].find((e) =>
        (e.textContent || '').trim().includes(t),
      )
      if (el) el.click()
      return !!el
    },
    sel,
    text,
  )
  await sleep(900)
  return ok
}

/** Есть ли на экране такой текст. */
const seen = (page, text) =>
  page.evaluate((t) => (document.body.innerText || '').includes(t), text)

/**
 * Появится ли текст за ms — после F5: dev-сервер собирает экран заново, и
 * фиксированной паузы то хватает, то нет (ложное красное на рабочем коде).
 */
const appears = (page, text, ms = 10000) =>
  page
    .waitForFunction((t) => (document.body.innerText || '').includes(t), { polling: 250, timeout: ms }, text)
    .then(() => true, () => false)

/**
 * Отпечаток внутреннего экрана: заголовок + начало текста.
 *
 * ⚠️ Без него смоук ВРЁТ. Пока состояние экрана не в адресе, после F5
 * `page.url()` совпадает (оба раза /study), и проверка «остались на месте»
 * проходит, хотя на деле нас отбросило к списку. Сравниваем содержимое.
 */
const fingerprint = (page) =>
  page.evaluate(() => {
    const h = document.querySelector('h1, h2')?.textContent?.trim() ?? ''
    const body = (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    return { h, body }
  })

/**
 * Экран дорисовался: у первого заголовка есть текст. Фиксированная пауза
 * ловила испанский текст до того, как пришёл его кусок (заголовок «»), и
 * после F5 «заголовок сменился» — ложное красное на рабочем коде.
 */
const headingReady = (page, ms = 10000) =>
  page
    .waitForFunction(() => !!document.querySelector('h1, h2')?.textContent?.trim(), { polling: 250, timeout: ms })
    .then(() => true, () => false)

/** Мы на Главной? (признак «нас выкинуло в начало») */
const onHome = async (page) => {
  const u = new URL(page.url())
  return u.pathname === '/'
}

async function main() {
  let userId = null
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'nav-smoke (временный)' })
  const { data: cu, error: cuErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (cuErr && !/already/i.test(cuErr.message)) throw new Error(cuErr.message)
  if (cu?.user) userId = cu.user.id
  else {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    // Supabase хранит email в нижнем регистре — сравнение без toLowerCase()
    // однажды молча возвращало undefined, и смоук «проходил» вхолостую
    userId = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!userId) throw new Error('не удалось получить id тестового пользователя')

  // онбординг считаем пройденным, иначе ProtectedRoute уведёт на /onboarding
  await admin.from('activity_log').upsert(
    {
      user_id: userId,
      type: 'flashcards',
      day: new Date().toISOString().slice(0, 10),
      items_done: 1,
    },
    { onConflict: 'user_id,type,day' },
  )
  await admin.from('profiles').update({ level: 'B1' }).eq('id', userId)

  // порт свой на каждый прогон: фиксированный ловил ЧУЖОЙ живой Edge с чужой сессией
  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('nav-smoke')}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()

  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 })
      .catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  // вход
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await tap(page, 'Войти')
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4000)

  /**
   * Сценарии. `reach` доводит до внутреннего экрана, `marker` — текст, который
   * на нём обязан быть, `backMarker` — что должно быть видно ПОСЛЕ «назад»
   * (то есть на шаг назад, а не на Главной).
   */
  const scenarios = [
    {
      name: 'Практика → режим «Перевод слова» (эталон: режим в адресе)',
      reach: async () => {
        await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle2' })
        await sleep(1500)
        // «Практика» сгруппирована: сначала раздел «Слова», потом игра
        await tap(page, 'Слова')
        return tap(page, 'Перевод слова')
      },
      marker: 'Перевод слова',
      backMarker: 'Повторение',
    },
    {
      name: 'Учёба → Чтение → открытый текст',
      reach: async () => {
        await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
        await sleep(1800)
        await tap(page, 'Чтение')
        await sleep(1200)
        // первый текст в списке — берём первую карточку-строку
        return page.evaluate(() => {
          const el = document.querySelectorAll('button, a')
          for (const e of el) {
            const t = (e.textContent || '').trim()
            if (t.length > 12 && !/Назад|Тексты|Грамматика|Слова|Практика/.test(t)) {
              e.click()
              return true
            }
          }
          return false
        })
      },
      marker: null, // текст произвольный — проверяем только, что ушли со списка
      // маркер списка читалки — «Выбери текст» (в шапке теперь «Чтение», слова
      // «Тексты» там больше нет после переименования строки хаба)
      backMarker: 'Выбери текст',
    },
    {
      name: 'Учёба → Грамматика → урок',
      reach: async () => {
        await page.goto(`${BASE}/grammar`, { waitUntil: 'networkidle2' })
        await sleep(1800)
        // Список уроков спрятан за аккордеоном уровня. Запоминаем кнопки ДО
        // раскрытия и жмём первую НОВУЮ — так не нужно угадывать названия
        // уроков (прошлая версия угадывала и промахивалась в аккордеон).
        const before = await page.evaluate(() =>
          [...document.querySelectorAll('button, a')].map((e) => (e.textContent || '').trim()),
        )
        await tap(page, 'A1')
        await sleep(1200)
        return page.evaluate((prev) => {
          const seenBefore = new Set(prev)
          const fresh = [...document.querySelectorAll('button, a')].find((e) => {
            const t = (e.textContent || '').trim()
            return t.length > 3 && !seenBefore.has(t)
          })
          if (fresh) fresh.click()
          return !!fresh
        }, before)
      },
      marker: null,
      backMarker: 'A1',
    },
    {
      name: 'Практика → игра «Спринт»',
      reach: async () => {
        await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle2' })
        await sleep(1500)
        await tap(page, 'Слова')
        return tap(page, 'Спринт')
      },
      marker: null,
      backMarker: 'Повторение',
    },
    {
      // свой текст живёт в localStorage устройства — сеем его прямо туда
      name: 'Учёба → свой текст',
      reach: async () => {
        await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
        await page.evaluate(() => {
          localStorage.setItem(
            'recall.my_texts.en',
            JSON.stringify([
              {
                id: 'nav-smoke-1',
                title: 'Мой проверочный текст',
                body: 'A short text pasted by the learner for the navigation smoke.',
                createdAt: Date.now(),
              },
            ]),
          )
        })
        await page.goto(`${BASE}/study?view=reader`, { waitUntil: 'networkidle2' })
        await sleep(1800)
        return tap(page, 'Мой проверочный текст')
      },
      marker: null,
      backMarker: 'Выбери текст',
    },
    {
      // испанская читалка — отдельный компонент со своим параметром (?es=)
      name: 'Учёба ES → испанский текст',
      reach: async () => {
        await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
        // язык хранится СЫРОЙ строкой (writeRaw в LanguageContext), не JSON:
        // '"es"' с кавычками молча оставлял тест на английском
        await page.evaluate(() => localStorage.setItem('recall.lang', 'es'))
        await page.goto(`${BASE}/study?view=reader`, { waitUntil: 'networkidle2' })
        await sleep(2500) // испанский контент грузится отдельным чанком
        return page.evaluate(() => {
          const el = [...document.querySelectorAll('button')].find((e) => {
            const t = (e.textContent || '').trim()
            return t.length > 14 && !/Назад|Тексты|Диалоги|^A1|^A2|^B1|^B2/.test(t)
          })
          if (el) el.click()
          return !!el
        })
      },
      marker: null,
      backMarker: 'Диалоги',
    },
  ]

  for (const s of scenarios) {
    // отпечаток ДО перехода: если после reach содержимое не изменилось —
    // значит клик никуда не привёл, и остальные проверки бессмысленны
    const printBefore = await fingerprint(page)
    const reached = await s.reach()
    await sleep(800)
    await headingReady(page)
    const urlInside = page.url()
    const printInside = await fingerprint(page)
    const moved = printInside.body !== printBefore.body
    check(
      `${s.name}: экран открылся`,
      reached && moved && !(await onHome(page)),
      moved ? urlInside : 'содержимое не изменилось — переход не состоялся',
    )
    if (!reached || !moved) continue

    // 1. F5 — остаёмся ли на месте. Сравниваем ЗАГОЛОВОК, а не всё содержимое:
    // в играх раунд начинается заново (новое слово) — это правильно и сменой
    // экрана не считается.
    await page.reload({ waitUntil: 'networkidle2' })
    await headingReady(page)
    await sleep(500)
    const printAfter = await fingerprint(page)
    // решающий признак: если после F5 виден маркер СПИСКА, значит нас отбросило
    // назад (у урока грамматики заголовок тот же, что у списка, — одного
    // сравнения заголовков мало)
    const fellBack = s.backMarker ? await seen(page, s.backMarker) : false
    const sameAfterReload =
      page.url() === urlInside &&
      !(await onHome(page)) &&
      printAfter.h === printInside.h &&
      !fellBack
    check(
      `${s.name}: F5 оставляет на экране`,
      sameAfterReload,
      sameAfterReload
        ? page.url()
        : fellBack
          ? `отбросило к списку (виден «${s.backMarker}»)`
          : `был «${printInside.h}», стал «${printAfter.h}»`,
    )

    // возвращаемся на экран, если F5 увёл
    if (!sameAfterReload) {
      await s.reach()
      await sleep(1500)
    }

    // 2. «Назад» — на шаг, а не на Главную
    await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {})
    if (s.backMarker) await appears(page, s.backMarker)
    else await sleep(2000)
    const home = await onHome(page)
    const backOk = !home && (s.backMarker ? await seen(page, s.backMarker) : true)
    check(
      `${s.name}: «назад» возвращает на шаг`,
      backOk,
      home ? 'выкинуло на Главную' : page.url(),
    )
  }

  // --- Меню по роли (PLAN.md Ф2.10, макет t1) --------------------------------
  // Подписи вкладок нижней панели (без числа счётчика) и активная вкладка.
  const navTabs = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('nav.vt-nav a')].map((a) => a.querySelector(':scope > span:last-of-type')?.textContent?.trim() ?? ''),
    )
  const activeTab = () =>
    page.evaluate(() => document.querySelector('nav.vt-nav a[aria-current="page"] > span:last-of-type')?.textContent?.trim() ?? '—')
  const path = () => new URL(page.url()).pathname + new URL(page.url()).search

  // Пока ученик: меню прежнее, экраны студии — приглашение, «Моя учёба» — его Главная
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  check('ученик: меню Главная · Учёба · Практика · Диалог', (await navTabs()).join(' · ') === 'Главная · Учёба · Практика · Диалог', (await navTabs()).join(' · '))
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle2' })
  await sleep(1800)
  check('ученик: «Задания» учителя — приглашение «Ведёшь учеников?»', await seen(page, 'Ведёшь учеников?'), path())
  await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  check('ученик: «Моя учёба» учителя ведёт на его Главную', new URL(page.url()).pathname === '/', path())

  // Учитель с учеником, который сдал письмо и задание по материалу. Данные —
  // напрямую в базу: живая генерация жжёт дорогую квоту Pro-моделей.
  await admin.from('profiles').update({ role: 'teacher' }).eq('id', userId)
  await admin.from('allowed_emails').upsert({ email: STUDENT_EMAIL, note: 'nav-smoke (временный)' })
  const { data: su } = await admin.auth.admin.createUser({ email: STUDENT_EMAIL, password: PASSWORD, email_confirm: true })
  const studentId =
    su?.user?.id ??
    (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => (u.email ?? '').toLowerCase() === STUDENT_EMAIL)?.id
  if (!studentId) throw new Error('не удалось завести ученика')
  await admin.from('profiles').update({ display_name: 'Әсел Навигация' }).eq('id', studentId)
  await admin.from('teacher_students').upsert({ teacher_id: userId, student_id: studentId, seat: true }, { onConflict: 'teacher_id,student_id' })
  const { data: mat } = await admin
    .from('materials')
    .insert({
      teacher_id: userId,
      lang: 'en',
      level: 'B1',
      topic: 'Навигационная проверка',
      format: 'article',
      length_range: 'short',
      title: 'Материал для смоука навигации',
      body: 'A short body for the navigation smoke.',
      exercises: [{ kind: 'comprehension', type: 'mcq', prompt: 'Is it short?', options: ['yes', 'no'], answer: 0 }],
    })
    .select('id')
    .single()
  const { data: work } = await admin
    .from('material_assignments')
    .insert({
      material_id: mat.id,
      student_id: studentId,
      status: 'submitted',
      submitted_at: new Date(Date.now() - 3600_000).toISOString(),
      answers: [{ index: 0, given: 'no', auto_ok: false }],
      auto_score: 0,
      auto_total: 1,
    })
    .select('id')
    .single()
  const { data: task } = await admin
    .from('writing_tasks')
    .insert({ teacher_id: userId, lang: 'en', mode: 'regular', level: 'B1', prompt: 'Nav smoke essay: your town.', settings: {} })
    .select('id')
    .single()
  await admin.from('writing_task_assignments').insert({
    task_id: task.id,
    student_id: studentId,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    essay: 'My town is small and green.',
    ai_review: { level: 'B1', errors: [], strengths: ['clear'] },
  })

  // Старт учителя — расписание, меню — четыре вкладки, счётчик на «Заданиях»
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  check('учитель: с «/» — в расписание (стартовый экран)', new URL(page.url()).pathname === '/schedule', path())
  check('учитель: меню Расписание · Ученики · Задания · Моя учёба', (await navTabs()).join(' · ') === 'Расписание · Ученики · Задания · Моя учёба', (await navTabs()).join(' · '))
  check('учитель: подсвечено «Расписание»', (await activeTab()) === 'Расписание', await activeTab())
  const tasksLabel = await page.evaluate(() => document.querySelector('nav.vt-nav a[href="/tasks"]')?.getAttribute('aria-label') ?? '')
  check('учитель: на «Заданиях» — «ждут проверки: 2»', tasksLabel.includes('ждут проверки: 2'), tasksLabel)

  // «Задания»: хаб → разбор сданной работы → назад
  await tap(page, 'Задания', 'nav.vt-nav a')
  await sleep(1500)
  check('«Задания»: хаб с «Проверкой работ» и тем, кто сдал', path() === '/tasks' && (await seen(page, 'Проверка работ')) && (await seen(page, 'Әсел Навигация')), path())
  check('«Задания»: «2 ждут»', await seen(page, '2 ждут'))
  check('«Задания»: разделы «Материалы», «Письменные задания», «Методичка»', (await seen(page, 'Собрать материал')) && (await seen(page, 'Письменные задания')) && (await seen(page, 'Методичка')))
  await tap(page, 'Методичка')
  await sleep(1500)
  check('«Задания» → «Методичка» по адресу', path() === '/tasks?tab=guide', path())
  await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(1500)
  await tap(page, '«Материал для смоука навигации»')
  await sleep(1800)
  check('«Задания»: строка открывает разбор этой работы', path() === `/tasks?work=${work.id}` && (await seen(page, 'Проверка работы: Әсел Навигация')), path())
  await page.reload({ waitUntil: 'networkidle2' })
  check('«Задания»: F5 оставляет в разборе', await appears(page, 'Проверка работы: Әсел Навигация'), path())
  await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(1800)
  check('«Задания»: «назад» из разбора — в хаб', path() === '/tasks' && (await seen(page, 'Проверка работ')), path())
  await page.goto(`${BASE}/tasks?work=00000000-0000-0000-0000-000000000000`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  check('«Задания»: уже проверенная работа — «больше не ждёт», а не пустой экран', await seen(page, 'больше не ждёт'), path())

  // Раздел «Материалы»: открытый материал в адресе
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  // библиотека — по заголовку карточки «Материалы» (кнопка карточки — «Собрать материал»)
  await tap(page, 'AI соберёт текст')
  await sleep(2000)
  check('«Задания» → заголовок «Материалы»: библиотека по адресу', path() === '/tasks?tab=materials' && (await seen(page, 'Материал для смоука навигации')), path())
  await tap(page, 'Материал для смоука навигации')
  await sleep(1800)
  const matUrl = page.url()
  check('Материалы: открытый материал попал в адрес', matUrl.includes('mat='), matUrl)
  await page.reload({ waitUntil: 'networkidle2' })
  check('Материалы: F5 оставляет в материале', await appears(page, 'Материал для смоука навигации'), path())
  await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(2000)
  check('Материалы: «назад» из материала — к списку', path() === '/tasks?tab=materials', path())
  // чужой/удалённый id не должен давать пустой экран
  await page.goto(`${BASE}/tasks?tab=materials&mat=00000000-0000-0000-0000-000000000000`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  check('Материалы: несуществующий материал показывает список', await seen(page, 'Создать материал'), path())
  // старые ссылки на вкладки студии (до Ф2.10) ведут во «Задания»
  await page.goto(`${BASE}/teacher?tab=writing`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  check('старая ссылка /teacher?tab=writing → «Задания», письменные', path() === '/tasks?tab=writing' && (await seen(page, 'Nav smoke essay')), path())
  check('на «Заданиях» подсвечены «Задания»', (await activeTab()) === 'Задания', await activeTab())

  // «Ученики»: студия без ряда вкладок
  await tap(page, 'Ученики', 'nav.vt-nav a')
  await sleep(2000)
  const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim())
  check('«Ученики»: /teacher с заголовком «Ученики», без ряда вкладок студии', path() === '/teacher' && h1 === 'Ученики' && !(await seen(page, 'Методичка')), `${path()} «${h1}»`)

  // «Моя учёба»: сводка и плитки, внутри — экраны ученика
  await tap(page, 'Моя учёба', 'nav.vt-nav a')
  await sleep(2000)
  check('«Моя учёба»: /learn с плитками Учёба · Практика · Диалог', path() === '/learn' && (await seen(page, 'Начать занятие')) && (await seen(page, 'Разговор с AI')), path())
  await tap(page, 'Практика', 'nav[aria-label="Разделы учёбы"] a')
  await sleep(2000)
  check('«Моя учёба» → «Практика»: экран ученика, подсвечена «Моя учёба»', path().startsWith('/practice') && (await activeTab()) === 'Моя учёба', `${path()} · ${await activeTab()}`)

  // Компьютер: те же четыре вкладки в меню слева
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`${BASE}/schedule`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  const side = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Разделы"] a[href]')].map((a) => a.querySelector('span')?.textContent?.trim()).filter(Boolean))
  check('1280: меню слева — Расписание · Ученики · Задания · Моя учёба', side.slice(0, 4).join(' · ') === 'Расписание · Ученики · Задания · Моя учёба', side.join(' · '))
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

  if (mat?.id) await admin.from('materials').delete().eq('id', mat.id)
  if (task?.id) await admin.from('writing_tasks').delete().eq('id', task.id)
  await admin.auth.admin.deleteUser(studentId).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', STUDENT_EMAIL)

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '))

  await browser.close()
  await admin.auth.admin.deleteUser(userId).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)

  const ok = results.filter((r) => r.ok).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  // process.exit() с открытыми сокетами роняет node на Windows (libuv assert)
  process.exitCode = ok === results.length ? 0 : 1
}

main().catch((e) => {
  console.error('Смоук упал:', e)
  process.exitCode = 1
})
