/**
 * Смоук карточки ученика: домашка глазами преподавателя.
 *
 * Серверные правила проверяет smoke-homework (он быстрый и без браузера). Здесь
 * проверяется ровно то, чего он не видит: что карточка перестроена вокруг
 * домашки, что её можно собрать шторкой, и что закрытый сервером пункт
 * подписан честно — «засчитано по занятиям», а не «проверено».
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-homework-ui.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const T_EMAIL = 'hwui-teacher@recall.test'
const S_EMAIL = 'hwui-student@recall.test'
const PASSWORD = 'HwUi!Smoke2026'
const STUDENT_NAME = 'Ерболат Смоуков'

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
const seen = (page, t) => page.evaluate((x) => (document.body.innerText || '').includes(x), t)
const waitText = (page, t, ms = 15000) =>
  page
    .waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms, polling: 250 }, t)
    .then(() => true)
    .catch(() => false)
const tap = async (page, text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role=button]')].find(
      (e) => (e.textContent || '').trim().includes(t) && !e.disabled,
    )
    if (el) el.click()
    return !!el
  }, text)
  await sleep(800)
  return ok
}

async function makeUser(email, role, name) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  for (const u of list.users.filter((u) => u.email === email)) await admin.auth.admin.deleteUser(u.id)
  const { data } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  await admin.from('profiles').update({ role, display_name: name }).eq('id', data.user.id)
  return data.user.id
}

let tId, sId, browser
try {
  tId = await makeUser(T_EMAIL, 'teacher', 'Смоук-Учитель')
  sId = await makeUser(S_EMAIL, 'learner', STUDENT_NAME)
  await admin.from('teacher_students').insert({ teacher_id: tId, student_id: sId })
  check('учитель и ученик заведены', !!tId && !!sId)

  const port = 9700 + Math.floor(Math.random() * 200)
  spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu',
     `--user-data-dir=${profileDir('hwui')}`, 'about:blank'],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 40 && !browser; i++) {
    try {
      // ⚠️ protocolTimeout обязателен. Без него прогон в цепочке за другим
      // смоуком падал с «Runtime.callFunctionOn timed out»: браузер ещё занят
      // прошлой работой, а умолчание puppeteer ждать её не рассчитано.
      browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${port}`,
        protocolTimeout: 120000,
      })
    } catch {
      await sleep(500)
    }
  }
  let page = await browser.newPage()
  await page.setViewport({ width: 420, height: 900 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('recall.onboarded', '1')
    } catch {}
  })

  // вход преподавателем
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 })
  await tap(page, 'Войти')
  await page.type('#f-email', T_EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000, polling: 250 })

  // ---- 1. карточка построена вокруг домашки ---------------------------------
  await page.goto(`${BASE}/teacher?student=${sId}`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('карточка открылась', await waitText(page, STUDENT_NAME))
  check('пустая домашка объясняет себя', await seen(page, 'Домашки нет'))
  check('главная кнопка на месте', await seen(page, 'Собрать домашку'))
  check('плашки с числами показаны', await seen(page, 'буксуют слов') && (await seen(page, 'слабых тем')))

  // ⚠️ Старые разделы должны быть СПРЯТАНЫ под «Ещё»: ради этого всё и делалось.
  // Если они снова окажутся на виду, экран вернётся к пяти раскрывашкам подряд.
  check('разделы убраны под «Ещё»', !(await seen(page, 'Диагностическая карта')))
  check('кнопка «Ещё» есть', await seen(page, 'Ещё:'))

  // ---- 2. разделы адресуемые ------------------------------------------------
  await page.goto(`${BASE}/teacher?student=${sId}&sec=diag`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('?sec=diag открывает диагностику сразу', await waitText(page, 'Диагностическая карта'))

  // ---- 3. сборка домашки шторкой --------------------------------------------
  await page.goto(`${BASE}/teacher?student=${sId}`, { waitUntil: 'networkidle2', timeout: 30000 })
  await waitText(page, 'Собрать домашку')
  await tap(page, 'Собрать домашку')
  check('шторка сборки открылась', await waitText(page, 'Сдать до'))

  // ---- красный пункт скриншота: свайп вниз по «ручке» ЗАКРЫВАЕТ шторку -------
  // Раньше свайп долетал до браузера как pull-to-refresh и перезагружал PWA.
  // Проверка умеет краснеть: если жест или порог сломаны, длинный свайп не
  // закроет шторку и «свайп закрывает» упадёт.
  const noPull = await page.evaluate(
    () =>
      getComputedStyle(document.documentElement).overscrollBehaviorY === 'none' ||
      getComputedStyle(document.body).overscrollBehaviorY === 'none',
  )
  check('pull-to-refresh погашен глобально', noPull)

  // «Ручка» — первый дочерний div панели role=dialog (touch-none, cursor-grab).
  const grabBox = () =>
    page.evaluate(() => {
      const grab = document.querySelector('[role="dialog"] > div')
      if (!grab) return null
      const r = grab.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + 6 }
    })
  const dragDown = async (px) => {
    const b = await grabBox()
    if (!b) return
    await page.mouse.move(b.x, b.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(b.x, b.y + (i * px) / 10)
    await page.mouse.up()
    await sleep(400)
  }

  // Короткий свайп (< порога 100px) — шторка возвращается на место.
  await dragDown(40)
  check('короткий свайп не закрывает', await seen(page, 'Сдать до'))

  // Длинный свайп — закрывает. Порог CLOSE_AT = 100.
  await dragDown(240)
  const swipedClosed = await page
    .waitForFunction(() => !document.querySelector('[role="dialog"]'), {
      timeout: 5000,
      polling: 250,
    })
    .then(() => true)
    .catch(() => false)
  check('свайп вниз закрывает шторку', swipedClosed)

  // Возвращаем шторку — остальной сценарий работает с открытой.
  await waitText(page, 'Собрать домашку')
  await tap(page, 'Собрать домашку')
  check('шторка снова открылась после свайпа', await waitText(page, 'Сдать до'))

  // ---- ⬜ серый нативный <select> заменён пикером-снизу ----------------------
  // ⚠️ Клики по пикеру — программно через evaluate, как tap(): ElementHandle
  // .click() вычисляет точку клика и виснет, когда композер в этот момент
  // перерисовывается (ловушка стоила зависания на 120с protocolTimeout).
  const noNativeSelect = await page.evaluate(
    () => !document.querySelector('[role="dialog"] select'),
  )
  check('нативного <select> в композере не осталось', noNativeSelect)

  const clickKind = () =>
    page.evaluate(() => document.querySelector('button[aria-haspopup="listbox"]')?.click())
  const hasTrigger = await page.evaluate(
    () => !!document.querySelector('button[aria-haspopup="listbox"]'),
  )
  check('тип задания — свой пикер (aria-haspopup=listbox)', hasTrigger)

  await clickKind()
  await sleep(400)
  // «Своими словами» — метка типа, видна только когда открыт список пикера.
  check('пикер типов открылся списком', await seen(page, 'Своими словами'))

  // Escape закрывает ТОЛЬКО пикер, композер остаётся — стек шторок.
  await page.keyboard.press('Escape')
  await sleep(400)
  const onlyComposer = await page.evaluate(
    () => document.querySelectorAll('[role="dialog"]').length === 1,
  )
  check('Escape закрыл пикер, но не композер', onlyComposer && (await seen(page, 'Сдать до')))

  // Выбор в пикере применяется к строке.
  await clickKind()
  await sleep(400)
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('[role="option"]')].find((e) =>
      (e.textContent || '').trim().startsWith('Чтение'),
    )
    opt?.click()
  })
  await sleep(400)
  const label = await page.evaluate(() =>
    (document.querySelector('button[aria-haspopup="listbox"]')?.textContent || '').trim(),
  )
  check('выбор типа в пикере применился к строке', /Чтение/.test(label), label)

  // ⚠️ Возвращаем «Слова»: ниже сценарий закрывает СЛОВАРНЫЙ пункт по занятиям,
  // и если первый пункт останется «Чтение», словарное занятие его не закроет.
  await clickKind()
  await sleep(400)
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('[role="option"]')].find(
      (e) => (e.textContent || '').trim() === 'Слова',
    )
    opt?.click()
  })
  await sleep(400)
  const restored = await page.evaluate(() =>
    (document.querySelector('button[aria-haspopup="listbox"]')?.textContent || '').trim(),
  )
  check('тип возвращён к «Слова»', /Слова/.test(restored), restored)

  // ---- 🟡 число только где реальное, 🟢 заметка видна многострочно -----------
  // STARTER: слова(20) + чтение(1) + письмо(1). Число — только у слов; у чтения
  // и письма цель всегда 1, поля нет. Красит, если вернуть число всем типам.
  const numberFields = await page.evaluate(
    () => document.querySelectorAll('[role="dialog"] input[type="number"]').length,
  )
  check('число показано только у счётных типов', numberFields === 1, `полей: ${numberFields}`)
  check('у числа есть единица («карточек»)', await seen(page, 'карточек'))
  const noteIsTextarea = await page.evaluate(
    () => document.querySelector('#hw-note')?.tagName === 'TEXTAREA',
  )
  check('заметка — textarea, а не однострочное поле', noteIsTextarea)

  // ⚠️ Значения полей ввода в innerText НЕ попадают — заготовку надо читать из
  // самих input, иначе проверка ищет текст, которого на странице нет по природе.
  const drafted = await page.$$eval('input[aria-label="Что сделать"]', (els) =>
    els.map((e) => e.value),
  )
  check(
    'заготовка недели предлагает баланс',
    drafted.length === 3 && drafted.some((t) => /слов/i.test(t)) && drafted.some((t) => /текст/i.test(t)),
    drafted.join(' | '),
  )

  const sent = await tap(page, 'Выдать домашку')
  check('домашка выдана', sent && (await waitText(page, 'Домашка на неделю')))
  // ⚠️ Точный текст элемента, а не вхождение в страницу: строка пункта со
  // словами показывает «0 из 20», и поиск подстроки «0 из 2» нашёл бы её.
  // На соседнем смоуке эта ловушка уже дала зелёную проверку при сломанном
  // счёте — здесь закрываем её тем же приёмом.
  const counterShown = await page.evaluate(() =>
    [...document.querySelectorAll('span, p, div')].some(
      (e) => (e.textContent || '').trim() === '0 из 3',
    ),
  )
  check('видно счёт', counterShown)

  const { count } = await admin
    .from('homework')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', sId)
  check('домашка появилась в базе', count === 1, `строк: ${count}`)

  // ---- 4. закрытый сервером пункт подписан честно ---------------------------
  const { data: deck } = await admin
    .from('decks').select('id').eq('owner_id', sId).eq('lang', 'en').limit(1).single()
  const { data: cards } = await admin
    .from('cards')
    .insert(Array.from({ length: 20 }, (_, i) => ({ deck_id: deck.id, front: `w${i}`, back: `с${i}`, source: 'teacher' })))
    .select('id')
  // ⚠️ Время — ОТ СЕРВЕРА (created_at выданной домашки + минута), а не от своей
  // машины: часы расходятся, в прогонах node отставал от базы на секунду с
  // лишним, и «свежее» повторение оказывалось раньше выдачи домашки. Сервер
  // честно его не засчитывал, а проверка краснела на исправном коде.
  const { data: hw1 } = await admin
    .from('homework')
    .select('created_at')
    .eq('student_id', sId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  const now = new Date(new Date(hw1.created_at).getTime() + 60_000).toISOString()
  await admin.from('review_states').insert(
    cards.map((c) => ({ user_id: sId, card_id: c.id, state: 'review', due: now, last_review: now, reps: 1, stability: 2, difficulty: 5 })),
  )
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 })
  check('пункт закрылся по занятиям', await waitText(page, 'засчитано по занятиям'))
  const overclaims = await seen(page, 'проверено')
  check(
    'формулировка честная — не «проверено»',
    !overclaims,
    overclaims ? 'на экране обещано больше, чем мы можем измерить' : '',
  )

  // ---- 5. ТОТ ЖЕ ОБЪЕКТ ГЛАЗАМИ УЧЕНИКА -------------------------------------
  //
  // Раньше «что мне задали» ученик собирал из трёх экранов, и общего ответа не
  // давал ни один. Проверяем ровно это: один список, прогресс ВНУТРИ пункта
  // (незакрытое должно тянуть закончить), выбор из пары и галочка только там,
  // где измерить нечем.
  const teacherApi = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  await teacherApi.auth.signInWithPassword({ email: T_EMAIL, password: PASSWORD })
  const { error: hw2err } = await teacherApi.rpc('create_homework', {
    p_student_id: sId,
    p_lang: 'en',
    p_due: new Date(Date.now() + 7 * 86400000).toISOString(),
    p_items: [
      { kind: 'words', title: 'Слова: повторить 30', target: 30, pick_group: null },
      { kind: 'free', title: 'Рассказать маме про выходные', target: 1, pick_group: null },
      { kind: 'speech', title: 'Проговорить вслух 5 выученных слов', target: 5, pick_group: 1 },
      { kind: 'quest', title: 'Пройти квест по Past Simple', target: 1, pick_group: 1 },
    ],
    p_note: 'Начни со слов',
  })
  check('выдана домашка с выбором и свободным пунктом', !hw2err, hw2err?.message ?? '')

  // ⚠️ Повторяем карточки ПОСЛЕ выдачи. Двадцать повторений выше были сделаны
  // до неё, и сервер их не засчитывает — правильно: прошлые заслуги не должны
  // закрывать новое задание.
  //
  // ⚠️ Время берём ОТ СЕРВЕРА (created_at выданной домашки), а не от своей
  // машины. Часы расходятся: в этом прогоне node отставал от базы почти на
  // секунду, и «свежее» повторение оказывалось на 0,6 с РАНЬШЕ выдачи домашки.
  // Проверка краснела на полностью исправном коде — самый дорогой вид ложного
  // падения, потому что чинить начинают работающее.
  const { data: hw2row } = await admin
    .from('homework')
    .select('created_at')
    .eq('student_id', sId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  await admin
    .from('review_states')
    .update({ last_review: new Date(new Date(hw2row.created_at).getTime() + 1000).toISOString() })
    .eq('user_id', sId)

  // ---- ⬜ класс закрыт: серого нативного <select> нет и в других разделах ----
  // Композер выше — одно из пяти мест. Здесь убеждаемся, что миграция дошла до
  // Квестов и Программы: нативного <select> нет, выбор — пикер. Красит, если
  // раздел откатить на <select>. (Делаем ДО входа учеником — тут ещё учитель.)
  // ⚠️ Ждём МАРКЕР формы, а не фиксированную паузу: разделы грузят данные через
  // useAsyncData, и на 800 мс Программа ещё показывала скелетон — пикера в нём
  // нет, и проверка краснела на исправном коде.
  for (const [sec, name, marker] of [
    ['quests', 'Квесты', 'Тема грамматики'],
    ['program', 'Программа', 'Уровень ученика'],
  ]) {
    await page.goto(`${BASE}/teacher?student=${sId}&sec=${sec}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })
    check(`«${name}»: форма выбора открылась`, await waitText(page, marker, 15000))
    const nativeSelects = await page.evaluate(() => document.querySelectorAll('select').length)
    check(`«${name}»: нативного <select> нет`, nativeSelects === 0, `select: ${nativeSelects}`)
    const hasPicker = await page.evaluate(
      () => !!document.querySelector('button[aria-haspopup="listbox"]'),
    )
    check(`«${name}»: выбор — пикер`, hasPicker)
  }

  // Вход учеником — в ОТДЕЛЬНОМ контексте браузера.
  //
  // ⚠️ Сессия Supabase лежит в localStorage и общая на весь профиль, поэтому
  // учительскую надо было как-то снять. Две попытки провалились: очистка в
  // живой вкладке роняла её («Target closed» — приложение работало со снятой
  // из-под него сессией), а пересоздание вкладки с очисткой до загрузки давало
  // то же самое через раз. Отдельный контекст решает причину, а не следствие:
  // у него своё хранилище, чистить и закрывать нечего.
  const studentCtx = await browser.createBrowserContext()
  page = await studentCtx.newPage()
  await page.setViewport({ width: 420, height: 900 })
  page.on('pageerror', (e) => jsErrors.push(e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('recall.onboarded', '1')
    } catch {}
  })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 })
  await tap(page, 'Войти')
  await page.type('#f-email', S_EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000, polling: 250 })

  await page.goto(`${BASE}/assignments`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('ученик видит домашку одним списком', await waitText(page, 'Домашка на неделю'))
  check('виден срок', await seen(page, 'осталось'))
  // ⚠️ Та же ловушка, что и в счёте преподавателя выше: подстрока «из 3» есть
  // внутри «20 из 30» — строки пункта, которая на экране всегда. Проверка была
  // вечно-зелёной: счёт можно было сломать (считать группу «на выбор» двумя
  // пунктами вместо одного), и она этого не замечала. Сверяем текст элемента
  // целиком; заодно это и есть проверка правила «группа — один пункт»:
  // пунктов в наборе четыре, строк — три.
  const totalShown = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('span, p, div')].some((e) =>
          /^0 из 3$/.test((e.textContent || '').trim()),
        ),
      { timeout: 15000, polling: 250 },
    )
    .then(() => true)
    .catch(() => false)
  check('виден общий счёт, группа «на выбор» — один пункт', totalShown)
  check('заметка преподавателя дошла', await seen(page, 'Начни со слов'))

  // Прогресс ВНУТРИ пункта: 20 карточек повторены выше, цель 30.
  check('прогресс виден внутри пункта, а не только после', await waitText(page, '20 из 30'))
  check('и подсказывает, сколько осталось', await seen(page, 'осталось 10'))

  check('пункт ведёт в тот экран, где работа и делается', await seen(page, 'К словам'))
  check('пара «на выбор» показана', await seen(page, 'сделай что-то одно'))

  // Галочка — ТОЛЬКО у неизмеримого пункта. Если она появится у слов или речи,
  // весь экран преподавателя превратится в то, что ученик о себе сообщил.
  const marks = await page.$$eval('button', (bs) =>
    bs.filter((b) => (b.textContent || '').includes('Отметить, что сделал')).length,
  )
  check('галочка ровно одна — у пункта «своими словами»', marks === 1, `кнопок: ${marks}`)

  const chose = await tap(page, 'Выбрать это')
  check('ученик может выбрать вариант', chose && (await waitText(page, 'Ты выбрал')))

  // Хаб «Учёба»: одна строка про домашку вместо трёх разных списков.
  await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('в «Учёбе» одна строка про домашку', await waitText(page, 'Домашка на неделю'))
  check(
    'старой строки «Задания от преподавателя» рядом нет',
    !(await seen(page, 'Задания от преподавателя')),
  )

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  if (browser) await browser.close().catch(() => {})
  for (const id of [tId, sId]) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  console.log('Тестовые аккаунты удалены.')
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exit(ok === results.length ? 0 : 1)
}
