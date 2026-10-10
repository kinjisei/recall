/**
 * Смоук: задание собирается ПОД УЧЕНИКА, а не «вообще».
 *
 * Зачем. Генератор материалов знал только заявку (тема, уровень, слова,
 * грамматика) — то есть делал то же, что любой чат. Диагностика ученика при
 * этом уже собиралась в приложении и лежала рядом неиспользованной. Проверяем
 * главное: когда преподаватель выбрал ученика, в промпт РЕАЛЬНО уходят его
 * буксующие слова и темы, где он ошибается.
 *
 * И материал на нескольких (PLAN.md Ф2.11б-3): группа из расписания отмечает
 * обоих, уровень — самого слабого с предупреждением, в промпте — общие слабые
 * места, слова плана правятся руками, «Сохранить» назначает материал обоим.
 *
 * ⚠️ Запрос к AI ПЕРЕХВАТЫВАЕТСЯ: смотрим тело и не даём ему уйти — сначала
 * отменяем, потом отвечаем правдоподобной заготовкой. Значит проверка ничего
 * не стоит — ни энергии ученика, ни месячных генераций преподавателя, ни
 * квоты дорогих моделей.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем `node scripts/smoke-material-diagnostics.mjs`.
 * Аккаунты создаются и удаляются сами (service_role из .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const T_EMAIL = 'matdiag-teacher@recall.test'
const S_EMAIL = 'matdiag-student@recall.test'
const PASSWORD = 'MatDiag!2026'
// слово с срывами и тема грамматики — их и ждём в промпте
const HARD_WORD = 'whisper'
const MISTAKE_TOPIC = 0
// имя нарочно НЕ похоже ни на что в интерфейсе: «Ученик» входил в «Ученики»
const STUDENT_NAME = 'Аружан Тестовая'
// второй ученик слабее первого: B1 против B2 — по умолчанию в форме A2, так
// что «уровень самого слабого» на прежнем коде краснеет
const S2_EMAIL = 'matdiag-student2@recall.test'
const SECOND_NAME = 'Данияр Проверочный'
const GROUP_TITLE = 'IELTS вечер'

// Заготовки ответа AI — правдоподобные: они попадают на экран (Ф2.11б-3).
const AI_PLAN = JSON.stringify({
  comments: 'Рассказ про поход в горы для B1. Общее слабое место группы — whisper: слово в тексте и в упражнении.',
  vocabulary: ['whisper', 'trail', 'campfire', 'borrow'],
  grammar_focus: null,
  exercise_plan: [
    { kind: 'comprehension', type: 'mcq', count: 2, note: 'вопросы по смыслу текста' },
    { kind: 'vocab', type: 'mcq', count: 1, note: 'слово по определению' },
  ],
})
const AI_CONTENT = JSON.stringify({
  title: 'A Night on the Trail',
  body: 'We walked up the mountain trail until the sun went down. Mia had a lantern, so we did not get lost. At night we sat close together and talked in a whisper because the forest was so quiet. I had to borrow a warm jacket from Mia. In the morning we saw the whole valley below us.',
  exercises: [
    { kind: 'comprehension', type: 'mcq', prompt: 'Why did they not get lost?', options: ['Mia had a lantern', 'They had a map', 'A guide helped them', 'They stayed home'], answer: 0 },
    { kind: 'comprehension', type: 'mcq', prompt: 'What did they see in the morning?', options: ['The sea', 'The whole valley', 'A big city', 'Nothing'], answer: 1 },
    { kind: 'vocab', type: 'mcq', prompt: 'to speak very quietly', options: ['whisper', 'borrow', 'trail', 'lantern'], answer: 0 },
  ],
})

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
/**
 * @param exact точное совпадение текста, а не вхождение.
 * ⚠️ Без него смоук кликал не туда: имя ученика «Ученик» входит в подпись
 * вкладки «Ученики», и первый же поиск уводил со всей формы. Проверка при
 * этом честно краснела — но на другом шаге, и причина была неочевидна.
 */
/** Кнопка выбора подсвечена (класс выбранного чипа); exact — текст целиком (уровень «B1»). */
const chosen = (page, name, exact = false) =>
  page.evaluate(
    (n, ex) =>
      [...document.querySelectorAll('button')].some(
        (b) => (ex ? b.textContent.trim() === n : b.textContent.includes(n)) && b.className.includes('bg-accent-soft'),
      ),
    name,
    exact,
  )
const studentChosen = (page) => chosen(page, STUDENT_NAME)
const bodyText = (page) => page.evaluate(() => document.body.innerText || '')
/** Ждём текст на экране (до 10 с). */
const waitText = async (page, re, ms = 10000) => {
  for (let t = 0; t < ms; t += 250) {
    if (re.test(await bodyText(page))) return true
    await sleep(250)
  }
  return false
}
const tap = async (page, text, sel = 'button, a, [role=button]', exact = false) => {
  const ok = await page.evaluate(
    (s, t, ex) => {
      const el = [...document.querySelectorAll(s)].find((e) => {
        const txt = (e.textContent || '').trim()
        return ex ? txt === t : txt.includes(t)
      })
      if (el) el.click()
      return !!el
    },
    sel,
    text,
    exact,
  )
  await sleep(700)
  return ok
}

/** Заведённые аккаунты — уборка и после падения: иначе следующий прогон наследует их карточки. */
const made = []
async function cleanup() {
  for (const id of made) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [T_EMAIL, S_EMAIL, S2_EMAIL])
  console.log('Тестовые аккаунты удалены.')
}

async function makeUser(email, patch) {
  await admin.from('allowed_emails').upsert({ email, note: 'matdiag (временный)' })
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
  made.push(id)
  if (patch) await admin.from('profiles').update(patch).eq('id', id)
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  return id
}

async function main() {
  const teacherId = await makeUser(T_EMAIL, { role: 'teacher', display_name: 'Педагог' })
  const studentId = await makeUser(S_EMAIL, { display_name: STUDENT_NAME, level: 'B2' })
  const student2Id = await makeUser(S2_EMAIL, { display_name: SECOND_NAME, level: 'B1' })
  for (const id of [studentId, student2Id]) {
    await admin.from('teacher_students').upsert(
      { teacher_id: teacherId, student_id: id, seat: true },
      { onConflict: 'teacher_id,student_id' },
    )
  }

  // ---- сеем диагностику: буксующее слово + ошибка в теме грамматики -------
  // whisper буксует у обоих (общее слабое место), borrow — только у второго
  const struggling = async (uid, front, back) => {
    const { data: deck } = await admin.from('decks').select('id').eq('owner_id', uid).eq('lang', 'en').limit(1).single()
    const { data: card } = await admin
      .from('cards')
      .insert({ deck_id: deck.id, front, back, source: 'manual' })
      .select('id')
      .single()
    await admin.from('review_states').upsert(
      { card_id: card.id, user_id: uid, state: 'relearning', lapses: 4, reps: 6, due: new Date().toISOString() }, // ≥2 — «буксующие»
      { onConflict: 'card_id,user_id' },
    )
  }
  await struggling(studentId, HARD_WORD, 'шептать')
  // то же слово второй карточкой (как своя колода + от учителя): ученик один —
  // без отсева дублей сводка писала «у 3 из 2»
  await struggling(studentId, HARD_WORD, 'шептать')
  await struggling(student2Id, HARD_WORD, 'шептать')
  await struggling(student2Id, 'borrow', 'одолжить')
  await admin
    .from('grammar_mistakes')
    .upsert(
      { user_id: studentId, lang: 'en', topic_id: MISTAKE_TOPIC, ex: 1 },
      { onConflict: 'user_id,lang,topic_id,ex' },
    )

  // ---- группа в расписании: оба ученика, серия по вторникам ----------------
  // карточки завела база при привязке (триггер teacher_students_card)
  const tc = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  await tc.auth.signInWithPassword({ email: T_EMAIL, password: PASSWORD })
  const { data: cardRows } = await admin.from('student_cards').select('id').eq('teacher_id', teacherId)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const series = await tc.rpc('create_series', {
    p_kind: 'group', p_weekdays: [2], p_time: '19:00', p_minutes: 60, p_every_weeks: 1,
    p_starts_on: tomorrow, p_cards: (cardRows ?? []).map((c) => c.id), p_title: GROUP_TITLE,
  })
  check('группа в расписании заведена', !series.error && (cardRows ?? []).length === 2, series.error?.message ?? `карточек: ${cardRows?.length}`)

  // ---- браузер ------------------------------------------------------------
  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('matdiag')}`,
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
  await page.bringToFront()
  await page.setViewport({ width: 900, height: 900 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))
  // окно подтверждения подвесило бы любую проверку — закрываем и считаем ошибкой
  page.on('dialog', (d) => {
    jsErrors.push(`неожиданное окно: ${d.message()}`)
    void d.dismiss()
  })

  // ПЕРЕХВАТ на уровне fetch, а НЕ setRequestInterception.
  // ⚠️ Перехват уровня puppeteer требует вручную пропускать КАЖДЫЙ запрос, и
  // dev-сервер с его websocket-ами на этом подвисал намертво (первый заход
  // смоука не завершился за 10 минут). Обёртка вокруг fetch трогает ровно один
  // адрес и ничего больше не ломает.
  await page.evaluateOnNewDocument(`
    window.__aiCalls = [];
    const orig = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.includes('/api/gemini')) {
        const body = String((init && init.body) || '');
        window.__aiCalls.push(body);
        // Генерация стоит дорогой модели и месячного лимита — до сервера не пускаем.
        // С флагом — отвечаем заготовкой: план или текст по системному промпту.
        if (localStorage.getItem('smoke.aiAnswer') !== '1') return Promise.reject(new Error('перехвачено смоуком'));
        const text = (JSON.parse(body).system || '').includes('СПЛАНИРОВАТЬ') ? ${JSON.stringify(AI_PLAN)} : ${JSON.stringify(AI_CONTENT)};
        return Promise.resolve(new Response(JSON.stringify({ text }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(input, init);
    };
  `)
  const readCalls = () => page.evaluate(() => window.__aiCalls || [])
  const clearCalls = () => page.evaluate(() => (window.__aiCalls = []))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await tap(page, 'Войти')
  await page.type('input[type=email]', T_EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4500)

  await page.goto(`${BASE}/teacher?tab=materials`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  const opened = await tap(page, 'Создать')
  check('форма создания материала открылась', opened)

  const hasPicker = await page.evaluate(() => (document.body.innerText || '').includes('Для кого'))
  check('в форме есть выбор ученика', hasPicker)

  // выбираем ученика и заполняем тему
  const picked = await tap(page, STUDENT_NAME, 'button, a, [role=button]', true)
  check('ученик выбран', picked && (await studentChosen(page)))
  check('уровень формы — уровень ученика (B2)', await chosen(page, 'B2', true))
  const hint = await page.evaluate(() =>
    (document.body.innerText || '').includes('где этот ученик ошибается'),
  )
  check('подпись объясняет, что даёт выбор', hint)

  await page.type('input[placeholder*="Путешествие"]', 'Поход в горы')
  await sleep(300)
  await tap(page, 'Составить план')
  await sleep(2500)

  const sent = await readCalls()
  check('запрос к AI ушёл', sent.length > 0, `запросов: ${sent.length}`)
  const body = sent.join('\n')
  check(
    'в промпте есть буксующее слово ученика',
    body.includes(HARD_WORD),
    body.includes(HARD_WORD) ? HARD_WORD : body.slice(0, 90),
  )
  check('в промпте есть блок диагностики', /Что известно про этого ученика/.test(body))
  check('в промпте есть слабая тема грамматики', /Слабые темы грамматики/.test(body))
  check(
    'AI получил инструкцию, как этим пользоваться',
    /буксующие слова ОБЯЗАТЕЛЬНО включи/.test(body),
  )

  // ---- и наоборот: без ученика диагностики в промпте быть НЕ должно -------
  await clearCalls()
  await page.goto(`${BASE}/teacher?tab=materials`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  // Мастер материала — черновик (Ф1.14): переход на вкладку возвращает к
  // составленному плану. С чистого листа — «Очистить»; заодно уходит и
  // выбранный ученик, он не должен перетечь в новую заявку.
  check('вернулся на вкладку — составленный план на месте', await tap(page, 'Очистить'))
  await sleep(500)
  await tap(page, 'Создать')
  check('новая заявка — без прошлого ученика', !(await studentChosen(page)))
  await page.type('input[placeholder*="Путешествие"]', 'Поход в горы')
  await sleep(300)
  await tap(page, 'Составить план')
  await sleep(2500)
  const sent2 = await readCalls()
  const plain = sent2.join('\n')
  check(
    'без выбранного ученика диагностики в промпте нет',
    sent2.length > 0 && !/Что известно про (этого ученика|этих учеников)/.test(plain),
    `запросов: ${sent2.length}`,
  )

  // ---- группа из расписания: уровень самого слабого, назначение обоим ------
  await clearCalls()
  await page.evaluate(() => localStorage.setItem('smoke.aiAnswer', '1')) // дальше AI «отвечает» заготовкой
  await page.goto(`${BASE}/teacher?tab=materials`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  await tap(page, 'Очистить')
  await sleep(500)
  await tap(page, 'Создать')
  await waitText(page, new RegExp(`Группа «${GROUP_TITLE}»`))
  check('группа из расписания — кнопкой в «Для кого»', await tap(page, `Группа «${GROUP_TITLE}»`))
  check('группа отметила обоих', (await chosen(page, STUDENT_NAME)) && (await chosen(page, SECOND_NAME)))
  check('уровень — самого слабого (B1, не B2 и не A2 по умолчанию)', await chosen(page, 'B1', true))
  const warn = await bodyText(page)
  check(
    'строка-предупреждение: уровни разные, текст под слабого',
    /Уровни разные: .*B1 · .*B2\. Текст — под самого слабого \(B1\)/.test(warn),
    (warn.match(/Уровни[^\n]*/) ?? ['нет строки'])[0],
  )
  check('подпись: материал назначится всем', /назначится всем/.test(warn))
  await page.type('input[placeholder*="Путешествие"]', 'Поход в горы')
  await sleep(300)
  await tap(page, 'Составить план')
  check('план от AI на экране', await waitText(page, /План материала от AI[\s\S]*Общее слабое место группы/))
  const groupBody = (await readCalls()).join('\n')
  check('в промпте — блок про нескольких учеников', /Что известно про этих учеников/.test(groupBody))
  check('…общее слабое место помечено «у 2 из 2»', groupBody.includes(`${HARD_WORD} (у 2 из 2)`), (groupBody.match(/Буксующие слова:[^\\]*/) ?? ['нет'])[0].slice(0, 120))
  check('…слабое место одного — тоже', groupBody.includes('borrow (у 1 из 2)'))
  check('в промпте — правило «тема → 6-8 слов»', /если указана тема — подбери 6-8 слов этой темы по уровню/.test(groupBody))
  const planText = await bodyText(page)
  const forLine = (planText.match(/B1 · для: [^\n]*/) ?? ['нет строки'])[0]
  check('план: для кого и уровень', forLine.includes(STUDENT_NAME) && forLine.includes(SECOND_NAME), forLine)

  // слова плана правятся руками, без новой генерации
  await page.evaluate(() => document.querySelector('[aria-label="Убрать «campfire»"]')?.click())
  await sleep(300)
  const wordInput = await page.$('input[aria-label="Своё слово в план"]')
  if (wordInput) await wordInput.type('lantern')
  await tap(page, 'Добавить')
  const words = await page.$eval('[data-plan-words]', (el) => el.innerText).catch(() => 'нет правки слов')
  check('слово убрано и добавлено руками', /lantern/.test(words) && !/campfire/.test(words), words.replace(/\n/g, ' '))
  check('…без запроса к AI', (await readCalls()).length === 1, `запросов: ${(await readCalls()).length}`)
  await tap(page, 'Генерировать')
  check('предпросмотр текста', await waitText(page, /A Night on the Trail/))
  const contentBody = (await readCalls())[1] ?? ''
  check('текст собран по поправленным словам', contentBody.includes('lantern') && !contentBody.includes('campfire'))
  const previewText = await bodyText(page)
  const toLine = (previewText.match(/Назначится при сохранении: [^\n]*/) ?? ['нет строки'])[0]
  check('предпросмотр: кому назначится', toLine.includes(STUDENT_NAME) && toLine.includes(SECOND_NAME), toLine)
  await tap(page, 'Сохранить')
  const savedOpen = await page
    .waitForFunction(() => location.search.includes('mat='), { polling: 250, timeout: 15000 })
    .then(() => true, () => false)
  check('«Сохранить» → карточка материала', savedOpen)
  await sleep(1500)
  const { data: mats } = await admin.from('materials').select('id, level').eq('teacher_id', teacherId)
  const mat = (mats ?? [])[0]
  const { data: asg } = await admin.from('material_assignments').select('student_id').eq('material_id', mat?.id ?? '')
  const got = new Set((asg ?? []).map((a) => a.student_id))
  check('материал на двух учеников назначен обоим', got.size === 2 && got.has(studentId) && got.has(student2Id), `назначено: ${got.size}`)
  check('…уровень материала — самого слабого (B1)', mat?.level === 'B1', `уровень: ${mat?.level}`)
  const marked = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Убрать ✓').length)
  check('блок «Назначить» заполнен: оба отмечены', marked === 2, `отмечено: ${marked}`)
  await page.evaluate(() => localStorage.removeItem('smoke.aiAnswer'))

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')

  await browser.close()
  await cleanup()

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

main()
  .catch(async (e) => {
    console.error('Смоук упал:', e)
    process.exitCode = 1
    await cleanup().catch(() => {})
  })
  // ⚠️ Без этого при ЛЮБОМ падении процесс висел: puppeteer.connect держит
  // открытый websocket к браузеру, и node не завершался — прогон выглядел как
  // «смоук работает десять минут», хотя он давно упал на второй проверке.
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 500)
  })
