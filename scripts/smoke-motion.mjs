/**
 * Смоук анимаций (docs/motion-plan.md).
 *
 * Зачем отдельный скрипт. Анимации — единственная часть продукта, поломку
 * которой не видно ни в типах, ни в остальных смоуках: экран продолжает
 * работать, просто перестаёт быть плавным, и это замечают через месяц.
 * Плюс половина сделанного — это КЛАСС мест (шесть ожиданий AI, десять
 * моментов правильного ответа), а класс разъезжается тихо: кто-то правит один
 * экран и не знает про остальные девять.
 *
 * Что проверяет:
 *   1. переход реально МЕНЯЕТ картинку: кадры «до» и «после» разные и на
 *      новом не заглушка (только счётчик вызовов однажды уже соврал);
 *   2. при «уменьшить движение» переход не запускается, но экран меняется;
 *   3. шапка и навигация из перехода исключены (иначе они ехали бы вместе);
 *   4. подложка вкладок реально едет (сравниваем transform на двух вкладках);
 *   5. верный ответ «клюёт» (проходим упражнение правильно);
 *   6. класс мест не разъехался — все шесть ожиданий AI на общем компоненте;
 *   7. keyframes живы в собранном CSS;
 *   8. вкладки: направление по порядку, повторный тап не плодит переходов.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-motion.mjs`.
 * Аккаунт создаётся и удаляется сам (service_role из .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const EMAIL = 'motion-smoke@recall.test'
const PASSWORD = 'MotionSmoke!2026'
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

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
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

/**
 * Дождаться текста на экране. Возвращает false, если не дождались.
 *
 * ⚠️ Сравниваем ПОДСТРОКОЙ, а не регуляркой: заголовки уроков содержат «:», а
 * названия глаголов — скобки, и экранировать их каждый раз значит однажды
 * ошибиться и получить «проверка не дождалась» вместо настоящей причины.
 */
async function waitText(page, needle, timeout = 8000) {
  return page
    .waitForFunction((t) => (document.body.innerText || '').includes(t), { timeout, polling: 200 }, needle)
    .then(() => true)
    .catch(() => false)
}


/**
 * Дождаться, пока перехватчик запишет кадр перехода.
 *
 * ⚠️ Не «поспать N мс»: в headless вкладка считается скрытой, а там браузер
 * тормозит таймеры примерно до одного в секунду — из-за этого ожидание
 * перерисовки (domSettled) иногда не успевало, и проверка падала с «кадр не
 * снят», хотя продукт исправен. Ждём условие, а не время.
 */
async function waitFrame(page, timeout = 6000) {
  return page
    .waitForFunction(() => (window.__vtFrames || []).length > 0, { timeout, polling: 100 })
    .then(() => true)
    .catch(() => false)
}

/**
 * Перехватчик переходов. Считает вызовы, запоминает направление и — главное —
 * СРАВНИВАЕТ кадры.
 *
 * ⚠️ Без сравнения кадров проверка бессмысленна. Первая версия смоука считала
 * только вызовы и была зелёной, пока переход анимировал два ОДИНАКОВЫХ кадра:
 * React Router откладывает обновление, и на момент снимка «после» экран был
 * ещё старый. Настоящая смена происходила потом, рывком. Считаем не факт
 * запуска, а то, что кадры разные и на новом не заглушка.
 */
const COUNTER = `
  window.__vt = 0;
  window.__vtDirs = [];
  window.__vtFrames = [];
  if (document.startViewTransition) {
    const orig = document.startViewTransition.bind(document);
    const seen = () => (document.querySelector('main')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
    document.startViewTransition = (cb) => {
      window.__vt++;
      // направление кладут на <html> ДО запуска — здесь оно уже стоит
      window.__vtDirs.push(document.documentElement.dataset.vt || null);
      const before = seen();
      return orig(async () => {
        await cb();
        window.__vtFrames.push({ before, after: seen() });
      });
    };
  }
`

// ---------------------------------------------------------------- проверки без браузера

/** Класс «ожидание AI»: все места обязаны быть на общем компоненте. */
function checkThinkingClass() {
  const places = [
    'src/features/conversation/ConversationPage.tsx',
    'src/features/quests/QuestsPage.tsx',
    'src/components/WordSheet.tsx',
    'src/components/PhraseSheet.tsx',
    'src/components/AnalysisSheet.tsx',
    'src/components/RoundReview.tsx',
  ]
  const missing = places.filter((p) => !readFileSync(join(ROOT, p), 'utf8').includes('<Thinking'))
  check(
    'все шесть ожиданий AI на общем компоненте',
    missing.length === 0,
    missing.join(', ') || '6/6',
  )

  // и наоборот: не осталось старого статического текста
  const stale = places.filter((p) => {
    const s = readFileSync(join(ROOT, p), 'utf8')
    return />\s*(печатает|Перевожу|Разбираю фрагмент|Думаю)…\s*</.test(s)
  })
  check('статических «печатает…» не осталось', stale.length === 0, stale.join(', '))
}

/** Класс «момент правильного ответа»: десять мест. */
function checkAnswerPopClass() {
  const places = [
    'src/components/exercises.tsx',
    'src/features/words/GameShell.tsx',
    'src/features/words/MatchMode.tsx',
    'src/features/words/SentenceBuilder.tsx',
    'src/features/words/SprintMode.tsx',
    'src/features/words/DictationMode.tsx',
    'src/features/grammar/IrregularVerbsSection.tsx',
    'src/features/grammar/PhrasalVerbsSection.tsx',
    'src/features/grammar/ConjugationSection.tsx',
    'src/features/flashcards/WordCheckRunner.tsx',
  ]
  const missing = places.filter(
    (p) => !readFileSync(join(ROOT, p), 'utf8').includes('animate-answer-pop'),
  )
  check(
    'верный ответ отмечен во всех десяти местах',
    missing.length === 0,
    missing.join(', ') || '10/10',
  )
}

/** Keyframes живы в собранном CSS (если сборка есть). */
function checkBuiltCss() {
  const dir = join(ROOT, 'dist', 'assets')
  if (!existsSync(dir)) {
    console.log('⏭ dist нет — проверку собранного CSS пропускаю (npm run build)')
    return
  }
  const css = readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n')
  const need = ['dot-bounce', 'answer-pop', 'vt-in-right', 'vt-out-left', 'recall-nav']
  const missing = need.filter((n) => !css.includes(n))
  check('анимации доехали до собранного CSS', missing.length === 0, missing.join(', ') || need.length + '/' + need.length)
}

/**
 * Урок A1, первое упражнение которого — выбор варианта. Заголовок и правильный
 * ответ читаем из данных: при правке уроков смоук поедет за ними сам, а не
 * начнёт врать про сломанную анимацию.
 */
function pickLesson() {
  const raw = JSON.parse(
    readFileSync(join(ROOT, 'src/data/english/grammar/grammar_a1.json'), 'utf8'),
  )
  const topics = Array.isArray(raw) ? raw : raw.topics ?? raw.lessons ?? Object.values(raw)[0]
  for (const t of topics ?? []) {
    const ex = t.exercises?.[0]
    if (!ex || ex.type !== 'mcq' || !Array.isArray(ex.options)) continue
    const right = ex.options[ex.answer]
    const wrong = ex.options.find((o, i) => i !== ex.answer)
    if (typeof right === 'string' && typeof wrong === 'string' && t.title) {
      return { title: t.title, right, wrong }
    }
  }
  return null
}

// ---------------------------------------------------------------- основной прогон

async function main() {
  checkThinkingClass()
  checkAnswerPopClass()
  checkBuiltCss()

  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'motion-smoke (временный)' })
  const { data: cu, error: cuErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (cuErr && !/already/i.test(cuErr.message)) throw new Error(cuErr.message)
  let userId = cu?.user?.id ?? null
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!userId) throw new Error('не удалось создать тестовый аккаунт')

  await admin.from('activity_log').upsert(
    { user_id: userId, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  await admin.from('profiles').update({ level: 'A1' }).eq('id', userId)

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${process.env.TEMP}\\motion-smoke-${Date.now()}`,
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
  // ⚠️ Обязательно: в фоновой вкладке document.visibilityState === 'hidden', и
  // браузер отказывается снимать кадры перехода (а наш код такие переходы
  // сознательно пропускает). Без bringToFront смоук показывал «переход не
  // запускается», хотя в жизни он работает.
  await page.bringToFront()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))
  await page.evaluateOnNewDocument(COUNTER)

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await tap(page, 'Войти')
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4000)

  // ---- 1. поддерживает ли браузер вообще -----------------------------------
  const supported = await page.evaluate(() => typeof document.startViewTransition === 'function')
  check('браузер прогона поддерживает переходы', supported)

  // ---- 2. переход запускается при смене экрана ------------------------------
  await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  await page.evaluate(() => (window.__vt = 0))
  const entered = await tap(page, 'Тексты и диалоги')
  await waitFrame(page)
  const inState = await page.evaluate(() => ({ vt: window.__vt, frames: window.__vtFrames }))
  check('заход внутрь запускает переход', entered && inState.vt >= 1, `вызовов: ${inState.vt}`)
  const f0 = inState.frames[0]
  check(
    'кадры «до» и «после» разные, а не один и тот же экран',
    !!f0 && f0.before !== f0.after && !/Загрузка…/.test(f0.after),
    f0 ? `${f0.before.slice(0, 24)} → ${f0.after.slice(0, 24)}` : 'кадр не снят',
  )

  // направление легло на <html> и снялось после
  const dirCleared = await page.evaluate(() => document.documentElement.dataset.vt === undefined)
  check('признак направления снимается после перехода', dirCleared)

  // ---- 3. возврат тоже с переходом ------------------------------------------
  // ⚠️ Ждём саму кнопку, а не «сколько-нибудь миллисекунд»: экран читалки —
  // ленивый чанк, и на медленном прогоне его ещё не было. Из-за этого проверка
  // падала через раз, а выглядело как «переход не сработал».
  const hasBack = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some((x) =>
          (x.getAttribute('aria-label') || '').includes('Назад'),
        ),
      { timeout: 8000, polling: 300 },
    )
    .then(() => true)
    .catch(() => false)
  check('кнопка «Назад» появилась', hasBack)

  await page.evaluate(() => (window.__vt = 0))
  const clickedBack = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.getAttribute('aria-label') || '').includes('Назад'),
    )
    if (b) b.click()
    return !!b
  })
  await sleep(900)
  const vtOut = await page.evaluate(() => window.__vt)
  check('возврат тоже с переходом', clickedBack && vtOut >= 1, `вызовов: ${vtOut}`)

  // ---- 4. шапка и навигация выключены из перехода ---------------------------
  const names = await page.evaluate(() => {
    const g = (sel) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el).viewTransitionName : null
    }
    return { top: g('header.vt-topbar'), nav: g('nav.vt-nav') }
  })
  check(
    'шапка и навигация не едут вместе с экраном',
    names.top === 'recall-topbar' && names.nav === 'recall-nav',
    JSON.stringify(names),
  )

  // ---- 5. подложка вкладок реально едет -------------------------------------
  const pillOn = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
    await sleep(1200)
    return page.evaluate(() => {
      const pill = document.querySelector('nav.vt-nav span[aria-hidden]')
      return pill ? getComputedStyle(pill).transform : null
    })
  }
  const pillHome = await pillOn('/')
  const pillDialog = await pillOn('/conversation')
  check(
    'подложка активной вкладки едет, а не перепрыгивает фоном',
    !!pillHome && !!pillDialog && pillHome !== pillDialog,
    `${pillHome} → ${pillDialog}`,
  )

  // ---- 6. верный ответ «клюёт», а неверный — нет ----------------------------
  // Правильный ответ берём из САМИХ данных урока, а не угадываем: иначе смоук
  // проходил бы через раз и мы бы привыкли его перезапускать.
  const lesson = pickLesson()
  check('нашли урок с выбором варианта', !!lesson, lesson ? `${lesson.title} → «${lesson.right}»` : '')

  if (lesson) {
    await page.goto(`${BASE}/grammar`, { waitUntil: 'networkidle2' })
    await sleep(2500)
    // уровни свёрнуты аккордеоном — сначала раскрываем A1
    await page.evaluate(() => {
      const acc = [...document.querySelectorAll('button')].find((b) =>
        /Уровень A1\b/.test((b.textContent || '').trim()),
      )
      if (acc) acc.click()
    })
    await waitText(page, lesson.title.slice(0, 12))
    const openedLesson = await tap(page, lesson.title)
    check('урок открылся', openedLesson && (await waitText(page, 'Упражнения')))
    const toExercises = await tap(page, 'Упражнения')
    // ждём, пока на экране появятся варианты ответа, а не «через 900 мс»
    const ready = await page
      .waitForFunction(
        () => [...document.querySelectorAll('button')].some((b) => /rounded-xl border/.test(b.className)),
        { timeout: 8000, polling: 200 },
      )
      .then(() => true)
      .catch(() => false)
    check('вкладка упражнений открылась', toExercises && ready)

    const verdict = await page.evaluate(
      async ([right, wrong]) => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms))
        const find = (t) =>
          [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === t)
        // сперва НЕверный вариант: он подсветится, но праздновать там нечего
        const bad = wrong ? find(wrong) : null
        if (bad) {
          bad.click()
          await wait(450)
        }
        const popsOnWrong = [...document.querySelectorAll('button')].some((b) =>
          b.className.includes('animate-answer-pop'),
        )
        return { popsOnWrong, hadWrong: !!bad }
      },
      [lesson.right, lesson.wrong],
    )
    check(
      'неверный ответ анимацией НЕ отмечается',
      verdict.hadWrong && verdict.popsOnWrong === false,
      verdict.hadWrong ? '' : 'неверного варианта не нашлось',
    )

    // перезаходим в тот же урок и отвечаем верно
    await page.goto(`${BASE}/grammar`, { waitUntil: 'networkidle2' })
    await sleep(2000)
    await page.evaluate(() => {
      const acc = [...document.querySelectorAll('button')].find((b) =>
        /Уровень A1\b/.test((b.textContent || '').trim()),
      )
      if (acc) acc.click()
    })
    await waitText(page, lesson.title.slice(0, 12))
    await tap(page, lesson.title)
    await waitText(page, 'Упражнения')
    await tap(page, 'Упражнения')
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('button')].some((b) => /rounded-xl border/.test(b.className)),
        { timeout: 8000, polling: 200 },
      )
      .catch(() => {})
    const popped = await page.evaluate(
      async (right) => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms))
        const btn = [...document.querySelectorAll('button')].find(
          (b) => (b.textContent || '').trim() === right,
        )
        if (!btn) return { reason: 'верного варианта на экране нет' }
        btn.click()
        await wait(450)
        return {
          ok: btn.className.includes('animate-answer-pop'),
          cls: btn.className.slice(-60),
        }
      },
      lesson.right,
    )
    check('верный ответ отмечается анимацией', !!popped.ok, popped.reason ?? popped.cls ?? '')
  }

  // ---- 7. переходы между ВКЛАДКАМИ ------------------------------------------
  // Тут главный риск не в анимации, а в ленивых чанках: если запустить переход
  // до загрузки экрана, «новым» кадром снимется заглушка «Загрузка…».
  const tapTab = async (label) => {
    await page.evaluate(() => {
      window.__vt = 0
      window.__vtDirs = []
      window.__vtFrames = []
    })
    await page.evaluate((t) => {
      const el = [...document.querySelectorAll('nav.vt-nav a')].find(
        (a) => (a.textContent || '').trim() === t,
      )
      if (el) el.click()
    }, label)
    await waitFrame(page)
    // даём анимации доиграть, иначе dataset.vt ещё стоит
    await sleep(600)
    return page.evaluate(() => ({
      vt: window.__vt,
      dirs: window.__vtDirs,
      frames: window.__vtFrames,
      body: (document.body.innerText || '').slice(0, 120),
    }))
  }

  // холодный старт: чанк «Учёбы» ещё не качали в этой вкладке
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  const toStudy = await tapTab('Учёба')
  check('переход по вкладке запускается', toStudy.vt >= 1, `вызовов: ${toStudy.vt}`)
  const tf = toStudy.frames[0]
  check(
    'на новом кадре следующий экран, а не «Загрузка…» и не прежний',
    !!tf && tf.before !== tf.after && !/Загрузка…/.test(tf.after),
    tf ? `${tf.before.slice(0, 22)} → ${tf.after.slice(0, 22)}` : 'кадр не снят',
  )
  check('вкладка вправо — экран приезжает справа', toStudy.dirs[0] === 'in', String(toStudy.dirs[0]))

  const backHome = await tapTab('Главная')
  check('вкладка влево — экран приезжает слева', backHome.dirs[0] === 'out', String(backHome.dirs[0]))

  // повторный тап по своей вкладке не должен плодить историю и переходы
  await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  const again = await tapTab('Практика')
  check('повторный тап по своей вкладке перехода не запускает', again.vt === 0, `вызовов: ${again.vt}`)

  // ---- 7б. «Практика»: раскрыт один раздел, остальные свёрнуты --------------
  // Идея MinimalCarousel: карточки не подменяются, а меняются местами и
  // размером. Проверяем, что имена перехода стоят на ОБОИХ состояниях —
  // без них браузер показал бы обычную смену содержимого.
  await page.goto(`${BASE}/practice`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  const hub = await page.evaluate(() => {
    const named = [...document.querySelectorAll('*')].filter((el) =>
      (getComputedStyle(el).viewTransitionName || '').startsWith('pg-'),
    )
    return {
      named: named.length,
      collapsed: [...document.querySelectorAll('button')].filter((b) =>
        ['Слова', 'Грамматика', 'Речь', 'Повторение'].includes((b.textContent || '').trim()),
      ).length,
      body: (document.body.innerText || '').slice(0, 80).replace(/\s+/g, ' '),
    }
  })
  check('в «Практике» четыре раздела с именами перехода', hub.named === 4, JSON.stringify(hub))

  await page.evaluate(() => (window.__vtFrames = []))
  const switched = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'Слова')
    if (b) b.click()
    return !!b
  })
  await waitFrame(page)
  await sleep(500)
  const opened = await page.evaluate(() => ({
    url: location.search,
    hasGames: (document.body.innerText || '').includes('Спринт'),
  }))
  check('раздел раскрывается и попадает в адрес', switched && opened.url.includes('g=words'), opened.url)
  check('в раскрытом разделе видны его игры', opened.hasGames)

  // ---- 8. Главная собирается ОДНИМ кадром -----------------------------------
  // Было: шесть независимых запросов, каждый дорисовывал свой кусок — экран
  // складывался рывками, и позиция содержимого менялась на глазах. Проверяем
  // не «красиво», а измеримое: после появления контента он больше не двигается.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  const gotPlan = await page
    .waitForFunction(
      () => [...document.querySelectorAll('h2')].some((h) => h.textContent?.includes('План на сегодня')),
      { timeout: 15000, polling: 200 },
    )
    .then(() => true)
    .catch(() => false)
  check('Главная догрузилась', gotPlan)

  const posOf = () =>
    page.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((x) =>
        x.textContent?.includes('План на сегодня'),
      )
      return h ? Math.round(h.getBoundingClientRect().top) : null
    })
  const firstY = await posOf()
  // 3.5 с — заведомо дольше, чем идёт отложенное «слово дня» (idle + чанк)
  await sleep(3500)
  const laterY = await posOf()
  check(
    'после загрузки содержимое Главной не прыгает',
    firstY !== null && firstY === laterY,
    `${firstY} → ${laterY}`,
  )

  // ---- 9. «уменьшить движение» выключает переходы ---------------------------
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  await page.evaluate(() => (window.__vt = 0))
  const enteredAgain = await tap(page, 'Тексты и диалоги')
  const vtReduced = await page.evaluate(() => window.__vt)
  const screenChanged = await page.evaluate(() =>
    (document.body.innerText || '').includes('Мои тексты') ||
    (document.body.innerText || '').includes('Свой текст'),
  )
  check('при «уменьшить движение» переход не запускается', enteredAgain && vtReduced === 0, `вызовов: ${vtReduced}`)
  check('и экран при этом всё равно меняется', screenChanged)

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')

  await browser.close()
  await admin.auth.admin.deleteUser(userId).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
  console.log('Тестовый аккаунт удалён.')

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

main().catch((e) => {
  console.error('Смоук упал:', e)
  process.exitCode = 1
})
