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
 * ⚠️ До этапа 1 плана ремонта часть проверок ПАДАЕТ — это ожидаемо, скрипт и
 * писался как приёмка этого этапа. Эталон «как надо» — сценарий «Практика»,
 * где режим уже лежит в адресе (?m=).
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-navigation.mjs`.
 * Аккаунт создаётся и удаляется сам (service_role из .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const EMAIL = 'nav-smoke@recall.test'
const PASSWORD = 'NavSmoke!2026'
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
      name: 'Учёба → Тексты и диалоги → открытый текст',
      reach: async () => {
        await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
        await sleep(1800)
        await tap(page, 'Тексты')
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
      backMarker: 'Тексты',
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
      backMarker: 'Тексты',
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
    await sleep(1500)
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
    await sleep(2500)
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
    await sleep(2000)
    const home = await onHome(page)
    const backOk = !home && (s.backMarker ? await seen(page, s.backMarker) : true)
    check(
      `${s.name}: «назад» возвращает на шаг`,
      backOk,
      home ? 'выкинуло на Главную' : page.url(),
    )
  }

  // --- Студия преподавателя: вкладка и открытый материал в адресе -----------
  // Отдельным блоком, потому что нужна роль teacher и материал в БД. Материал
  // вставляем напрямую: живая генерация жжёт дорогую квоту Pro-моделей.
  await admin.from('profiles').update({ role: 'teacher' }).eq('id', userId)
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
      exercises: [],
    })
    .select('id')
    .single()

  await page.goto(`${BASE}/teacher?tab=materials`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  check(
    'Студия: вкладка «Материалы» открывается по адресу',
    await seen(page, 'Материал для смоука навигации'),
    page.url(),
  )

  await tap(page, 'Материал для смоука навигации')
  await sleep(1800)
  const matUrl = page.url()
  check('Студия: открытый материал попал в адрес', matUrl.includes('mat='), matUrl)

  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(2500)
  check(
    'Студия: F5 оставляет в материале',
    await seen(page, 'Материал для смоука навигации'),
    page.url(),
  )

  await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(2000)
  check(
    'Студия: «назад» из материала возвращает к списку',
    !(await onHome(page)) && page.url().includes('tab=materials') && !page.url().includes('mat='),
    page.url(),
  )

  // чужой/удалённый id не должен давать пустой экран
  await page.goto(`${BASE}/teacher?tab=materials&mat=00000000-0000-0000-0000-000000000000`, {
    waitUntil: 'networkidle2',
  })
  await sleep(2500)
  check(
    'Студия: несуществующий материал показывает список',
    await seen(page, 'Создать материал'),
    page.url(),
  )

  if (mat?.id) await admin.from('materials').delete().eq('id', mat.id)

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
