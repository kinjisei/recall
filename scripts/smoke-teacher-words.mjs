/**
 * Смоук: преподаватель выдаёт ученику слова из ГОТОВОГО пака и удаляет лишние.
 *
 * Зачем. Раньше учитель мог выдать только СВОИ слова, а выданное жило в
 * колоде-копии учителя — и не попадало ни в раздел «Слова», ни в перепроверку:
 * lib/wordChecks.getStudentWords читает только колоды с owner_id = ученик.
 * То есть учитель выдавал слова и больше их не видел.
 *
 * Проверяется весь путь и три вещи, которые ломаются молча:
 *   • слова легли в ЛИЧНУЮ колоду ученика с source='teacher';
 *   • дубли не добавляются повторно (иначе в колоде два одинаковых слова с
 *     разным прогрессом, и повторение ломается тихо);
 *   • удалить карточку ЧУЖОГО ученика нельзя.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-teacher-words.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const T_EMAIL = 'tw-teacher@recall.test'
const S_EMAIL = 'tw-student@recall.test'
const O_EMAIL = 'tw-other@recall.test'
const PASSWORD = 'TeachWords!2026'
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
const tap = async (page, text, exact = false) => {
  const ok = await page.evaluate(
    (t, ex) => {
      const el = [...document.querySelectorAll('button, a, [role=button]')].find((e) => {
        const txt = (e.textContent || '').trim()
        return ex ? txt === t : txt.includes(t)
      })
      if (el) el.click()
      return !!el
    },
    text,
    exact,
  )
  await sleep(800)
  return ok
}
const seen = (page, t) => page.evaluate((x) => (document.body.innerText || '').includes(x), t)

/**
 * Шторка выбора слов открыта порталом ПОВЕРХ карточки ученика, но кнопки самой
 * карточки остаются в DOM. ⚠️ Из-за этого поиск «по всей странице» находил
 * «+ Выдать слова» под шторкой вместо «Выдать N слов» внутри неё — смоук жал
 * не туда и уверял, что выдача не сработала. Всё, что про шторку, ищем ТОЛЬКО
 * внутри неё.
 */
const SHEET = '[class*="z-50"]'
const tapSheet = async (page, text) => {
  const ok = await page.evaluate(
    (sel, t) => {
      const root = document.querySelector(sel)
      if (!root) return false
      const el = [...root.querySelectorAll('button')].find((b) =>
        (b.textContent || '').trim().includes(t),
      )
      if (el) el.click()
      return !!el
    },
    SHEET,
    text,
  )
  await sleep(900)
  return ok
}

async function makeUser(email, patch) {
  await admin.from('allowed_emails').upsert({ email, note: 'tw-smoke (временный)' })
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

/** Слова ученика в его СОБСТВЕННЫХ колодах (то же, что видит преподаватель). */
async function ownWords(studentId) {
  const { data: decks } = await admin.from('decks').select('id').eq('owner_id', studentId)
  const ids = (decks ?? []).map((d) => d.id)
  if (ids.length === 0) return []
  const { data } = await admin.from('cards').select('id, front, source, deck_id').in('deck_id', ids)
  return data ?? []
}

async function main() {
  let browser = null
  const teacherId = await makeUser(T_EMAIL, { role: 'teacher', display_name: 'Педагог' })
  const studentId = await makeUser(S_EMAIL, { display_name: STUDENT_NAME, level: 'B1' })
  const otherId = await makeUser(O_EMAIL, { display_name: 'Чужой ученик' })
  await admin.from('teacher_students').upsert(
    { teacher_id: teacherId, student_id: studentId, seat: true },
    { onConflict: 'teacher_id,student_id' },
  )

  // у ученика уже есть слово из пака — оно должно показаться «уже учит» и
  // НЕ добавиться повторно
  const { data: sDeck } = await admin
    .from('decks')
    .select('id')
    .eq('owner_id', studentId)
    .eq('lang', 'en')
    .limit(1)
    .single()
  await admin
    .from('cards')
    .insert({ deck_id: sDeck.id, front: 'apply for a job', back: 'подавать заявку', source: 'manual' })

  // карточка ЧУЖОГО ученика — её удалить не должно получиться
  const { data: oDeck } = await admin
    .from('decks')
    .select('id')
    .eq('owner_id', otherId)
    .eq('lang', 'en')
    .limit(1)
    .single()
  const { data: oCard } = await admin
    .from('cards')
    .insert({ deck_id: oDeck.id, front: 'stranger word', back: 'чужое', source: 'manual' })
    .select('id')
    .single()

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('tw')}`,
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
  await page.setViewport({ width: 900, height: 950 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await tap(page, 'Войти')
  await page.type('input[type=email]', T_EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4500)

  await page.goto(`${BASE}/teacher?student=${studentId}`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  check('карточка ученика открылась', await seen(page, STUDENT_NAME))
  check('раздела «Наборы слов» больше нет', !(await seen(page, 'Наборы слов')))
  check('домашка стоит первой в карточке', await seen(page, 'Домашк'))

  // Раздел стал адресуемым: ?sec=words открывает «Слова» сразу, без клика по
  // «Ещё». Так проверка заодно сторожит саму адресуемость — потерять её при
  // следующей перестройке экрана легко и незаметно.
  await page.goto(`${BASE}/teacher?student=${studentId}&sec=words`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  const hasGive = await seen(page, 'Выдать слова')
  check('в «Словах» есть выдача', hasGive)

  await tap(page, 'Выдать слова')
  await sleep(1200)
  check('шторка выбора открылась', await seen(page, 'Готовые наборы'))

  // раскрываем уровень ученика и берём тему
  const opened = await page
    .waitForFunction(() => (document.body.innerText || '').includes('уровень ученика'), {
      timeout: 8000,
      polling: 200,
    })
    .then(() => true)
    .catch(() => false)
  check('уровень ученика раскрыт сразу', opened)

  const topic = await tap(page, 'Работа и карьера', true)
  check('тема открылась', topic)
  await sleep(1500)

  const state = await page.evaluate((sel) => {
    const root = document.querySelector(sel)
    const boxes = [...(root?.querySelectorAll('input[type=checkbox]') ?? [])]
    return {
      body: root?.innerText ?? '',
      boxes: boxes.length,
      checked: boxes.filter((b) => b.checked).length,
    }
  }, SHEET)
  check('состав темы виден', state.boxes > 5, `слов: ${state.boxes}`)
  check('уже известное слово помечено', /уже учит/.test(state.body))
  check(
    'по умолчанию отмечено всё, кроме известного',
    state.checked === state.boxes - 1,
    `${state.checked} из ${state.boxes}`,
  )

  // снимаем ещё одну галку — она не должна попасть ученику
  const removedFront = await page.evaluate((sel) => {
    const root = document.querySelector(sel)
    const labels = [...(root?.querySelectorAll('label') ?? [])].filter(
      (l) => l.querySelector('input[type=checkbox]')?.checked,
    )
    const l = labels[0]
    if (!l) return null
    l.querySelector('input[type=checkbox]').click()
    return (l.textContent || '').trim().split('\n')[0]
  }, SHEET)
  check('галку можно снять', !!removedFront, String(removedFront))
  await sleep(400)

  const wantAdd = await page.evaluate(
    (sel) =>
      [...(document.querySelector(sel)?.querySelectorAll('input[type=checkbox]') ?? [])].filter(
        (b) => b.checked,
      ).length,
    SHEET,
  )
  await tapSheet(page, 'Выдать')
  await page
    .waitForFunction(() => /Выдано слов/.test(document.body.innerText || ''), {
      timeout: 15000,
      polling: 300,
    })
    .catch(() => {})
  check('показано подтверждение выдачи', await seen(page, 'Выдано слов'))

  // ---- база: слова у УЧЕНИКА, с пометкой источника, без дублей -------------
  const words = await ownWords(studentId)
  const fromTeacher = words.filter((w) => w.source === 'teacher')
  check(
    'слова легли в колоду ученика',
    fromTeacher.length === wantAdd,
    `выдано ${fromTeacher.length}, выбрано ${wantAdd}`,
  )
  check(
    'снятое слово ученику не ушло',
    !fromTeacher.some((w) => w.front === removedFront),
    String(removedFront),
  )
  check(
    'дубль не задвоился',
    words.filter((w) => w.front === 'apply for a job').length === 1,
    `копий: ${words.filter((w) => w.front === 'apply for a job').length}`,
  )

  // повторная выдача той же темы не должна добавить ничего
  const before = (await ownWords(studentId)).length
  await tap(page, 'Выдать слова')
  await sleep(1200)
  await tapSheet(page, 'Работа и карьера')
  await sleep(1500)
  const nothingLeft = await page.evaluate(
    (sel) =>
      [...(document.querySelector(sel)?.querySelectorAll('input[type=checkbox]') ?? [])].filter(
        (b) => b.checked,
      ).length,
    SHEET,
  )
  check('во второй раз отмечать нечего', nothingLeft <= 1, `отмечено: ${nothingLeft}`)
  const after = (await ownWords(studentId)).length
  check('повторный заход не наплодил слов', after === before, `${before} → ${after}`)
  await page.keyboard.press('Escape')
  await tapSheet(page, '← к наборам')

  // ---- удаление ------------------------------------------------------------
  await page.goto(`${BASE}/teacher?student=${studentId}&sec=words`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  check('видно происхождение слова', await seen(page, 'выдал я'))

  const del = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') || '').startsWith('Удалить '),
    )
    if (b) b.click()
    return b ? (b.getAttribute('aria-label') || '').replace('Удалить ', '') : null
  })
  await sleep(700)
  check('удаление предупреждает про прогресс', await seen(page, 'пропадёт весь прогресс'))
  await tap(page, 'Удалить', true)
  await page
    .waitForFunction(() => /удалено/.test(document.body.innerText || ''), {
      timeout: 10000,
      polling: 300,
    })
    .catch(() => {})
  const left = await ownWords(studentId)
  check('слово удалено из колоды ученика', !left.some((w) => w.front === del), String(del))

  // ---- чужого ученика трогать нельзя --------------------------------------
  const asTeacher = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await asTeacher.auth.signInWithPassword({ email: T_EMAIL, password: PASSWORD })
  const { error: hackErr } = await asTeacher.rpc('teacher_delete_student_cards', {
    p_student_id: otherId,
    p_card_ids: [oCard.id],
  })
  check(
    'удалить слово чужого ученика нельзя',
    /RECALL_NOT_YOUR_STUDENT/.test(hackErr?.message ?? ''),
    hackErr?.message ?? 'ошибки не было',
  )
  const { data: stillThere } = await admin.from('cards').select('id').eq('id', oCard.id)
  check('чужая карточка на месте', (stillThere ?? []).length === 1)

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')

  await browser.close()
  for (const id of [teacherId, studentId, otherId]) {
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  await admin.from('allowed_emails').delete().in('email', [T_EMAIL, S_EMAIL, O_EMAIL])
  console.log('Тестовые аккаунты удалены (колоды и карточки ушли каскадом).')

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
