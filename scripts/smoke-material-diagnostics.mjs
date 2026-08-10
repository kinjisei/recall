/**
 * Смоук: задание собирается ПОД УЧЕНИКА, а не «вообще».
 *
 * Зачем. Генератор материалов знал только заявку (тема, уровень, слова,
 * грамматика) — то есть делал то же, что любой чат. Диагностика ученика при
 * этом уже собиралась в приложении и лежала рядом неиспользованной. Проверяем
 * главное: когда преподаватель выбрал ученика, в промпт РЕАЛЬНО уходят его
 * буксующие слова и темы, где он ошибается.
 *
 * ⚠️ Запрос к AI ПЕРЕХВАТЫВАЕТСЯ и отменяется: смотрим тело и не даём ему уйти.
 * Значит проверка ничего не стоит — ни энергии ученика, ни месячных генераций
 * преподавателя, ни квоты дорогих моделей.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-material-diagnostics.mjs`.
 * Аккаунты создаются и удаляются сами (service_role из .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const T_EMAIL = 'matdiag-teacher@recall.test'
const S_EMAIL = 'matdiag-student@recall.test'
const PASSWORD = 'MatDiag!2026'
// слово с срывами и тема грамматики — их и ждём в промпте
const HARD_WORD = 'whisper'
const MISTAKE_TOPIC = 0
// имя нарочно НЕ похоже ни на что в интерфейсе: «Ученик» входил в «Ученики»
const STUDENT_NAME = 'Аружан Тестовая'

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
/**
 * @param exact точное совпадение текста, а не вхождение.
 * ⚠️ Без него смоук кликал не туда: имя ученика «Ученик» входит в подпись
 * вкладки «Ученики», и первый же поиск уводил со всей формы. Проверка при
 * этом честно краснела — но на другом шаге, и причина была неочевидна.
 */
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
  if (patch) await admin.from('profiles').update(patch).eq('id', id)
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  return id
}

async function main() {
  const teacherId = await makeUser(T_EMAIL, { role: 'teacher', display_name: 'Педагог' })
  const studentId = await makeUser(S_EMAIL, { display_name: STUDENT_NAME, level: 'A2' })
  await admin.from('teacher_students').upsert(
    { teacher_id: teacherId, student_id: studentId, seat: true },
    { onConflict: 'teacher_id,student_id' },
  )

  // ---- сеем диагностику: буксующее слово + ошибка в теме грамматики -------
  const { data: deck } = await admin
    .from('decks')
    .select('id')
    .eq('owner_id', studentId)
    .eq('lang', 'en')
    .limit(1)
    .single()
  const { data: card } = await admin
    .from('cards')
    .insert({ deck_id: deck.id, front: HARD_WORD, back: 'шептать', source: 'manual' })
    .select('id')
    .single()
  await admin.from('review_states').upsert(
    {
      card_id: card.id,
      user_id: studentId,
      state: 'relearning',
      lapses: 4, // ≥2 — попадает в «буксующие»
      reps: 6,
      due: new Date().toISOString(),
    },
    { onConflict: 'card_id,user_id' },
  )
  await admin
    .from('grammar_mistakes')
    .upsert(
      { user_id: studentId, lang: 'en', topic_id: MISTAKE_TOPIC, ex: 1 },
      { onConflict: 'user_id,lang,topic_id,ex' },
    )

  // ---- браузер ------------------------------------------------------------
  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${process.env.TEMP}\\matdiag-${Date.now()}`,
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
        window.__aiCalls.push(String((init && init.body) || ''));
        // Генерация стоит дорогой модели и месячного лимита — до сервера не пускаем.
        return Promise.reject(new Error('перехвачено смоуком'));
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
  check('ученик выбран', picked)
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
  await tap(page, 'Создать')
  await page.type('input[placeholder*="Путешествие"]', 'Поход в горы')
  await sleep(300)
  await tap(page, 'Составить план')
  await sleep(2500)
  const sent2 = await readCalls()
  const plain = sent2.join('\n')
  check(
    'без выбранного ученика диагностики в промпте нет',
    sent2.length > 0 && !/Что известно про этого ученика/.test(plain),
    `запросов: ${sent2.length}`,
  )

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')

  await browser.close()
  await admin.auth.admin.deleteUser(teacherId).catch(() => {})
  await admin.auth.admin.deleteUser(studentId).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [T_EMAIL, S_EMAIL])
  console.log('Тестовые аккаунты удалены.')

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

main()
  .catch((e) => {
    console.error('Смоук упал:', e)
    process.exitCode = 1
  })
  // ⚠️ Без этого при ЛЮБОМ падении процесс висел: puppeteer.connect держит
  // открытый websocket к браузеру, и node не завершался — прогон выглядел как
  // «смоук работает десять минут», хотя он давно упал на второй проверке.
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 500)
  })
