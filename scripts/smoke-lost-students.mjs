/**
 * Смоук сигнала о пропавших учениках.
 *
 * Зачем. Главная работа репетитора между уроками — заметить, что ученик
 * перестал заниматься. Приложение это ЗНАЛО (серия, отметка «сегодня»), но не
 * ГОВОРИЛО: надо было открыть список и высмотреть среди всех. При пяти
 * учениках упражнение на внимательность, при десяти лотерея.
 *
 * Сеет трёх учеников с разной давностью: сегодня, девять дней назад и «ни разу
 * не начинал» — и проверяет, что сводка называет ровно двух последних.
 *
 * Запуск: node scripts/smoke-lost-students.mjs (нужен dev-сервер на 5173).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const T = { email: 'lost-t@recall.test', pass: 'Lost!2026teach' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const day = (back) => {
  const d = new Date()
  d.setDate(d.getDate() - back)
  return d.toISOString().slice(0, 10)
}

async function mk(email, patch = {}) {
  await admin.from('allowed_emails').upsert({ email, note: 'lost-check' })
  const { data } = await admin.auth.admin.createUser({ email, password: T.pass, email_confirm: true })
  let id = data?.user?.id
  if (!id) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = l.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
  }
  await admin.from('profiles').update({ role: 'learner', ...patch }).eq('id', id)
  return id
}

const idT = await mk(T.email, { role: 'teacher', display_name: 'Учитель' })
await admin.from('activity_log').upsert(
  { user_id: idT, type: 'flashcards', day: day(0), items_done: 1 },
  { onConflict: 'user_id,type,day' },
)

// три ученика: занимался сегодня, пропал 9 дней назад, не начинал вовсе
// ⚠️ адрес строим из ЛАТИНСКОГО ключа: кириллица в локальной части почты
// не принимается, аккаунт молча не создавался и связь не появлялась
const plan = [
  ['Айгерим', 'aigerim', 0],
  ['Данияр', 'daniyar', 9],
  ['Асель', 'asel', null],
  // Ходит регулярно, но домашку не сделал и срок прошёл. Такого раньше не было
  // видно вообще: сводка про пропавших о нём молчит, а строка не знала домашки.
  ['Тимур', 'timur', 0],
]
const made = []
const byName = {}
for (const [nm, key, back] of plan) {
  const em = `lost-${key}@recall.test`
  const id = await mk(em, { display_name: nm, level: 'B1' })
  if (!id) throw new Error(`не создан ученик ${em}`)
  made.push([id, em])
  await admin.from('teacher_students').delete().eq('student_id', id)
  const { error: linkErr } = await admin.from('teacher_students').insert({ teacher_id: idT, student_id: id })
  if (linkErr) throw new Error(`связь ${em}: ${linkErr.message}`)
  if (back !== null) {
    await admin.from('activity_log').upsert(
      { user_id: id, type: 'flashcards', day: day(back), items_done: 5 },
      { onConflict: 'user_id,type,day' },
    )
  }
  // Айгерим ходит регулярно: пять дней из последней недели. Регулярность —
  // то, что показывает строка вместо суммы карточек.
  if (key === 'aigerim') {
    for (const b2 of [1, 2, 4, 6]) {
      await admin.from('activity_log').upsert(
        { user_id: id, type: 'flashcards', day: day(b2), items_done: 3 },
        { onConflict: 'user_id,type,day' },
      )
    }
  }
  byName[nm] = id
}

// ---- домашки: у Тимура просрочена, у Айгерим свежая и наполовину сделана ----
// ⚠️ Выдаём через RPC от лица преподавателя, а не вставкой в таблицу: прямая
// запись в homework отозвана у всех, и смоук обязан ходить тем же путём, что
// живой экран.
const asTeacher = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await asTeacher.auth.signInWithPassword({ email: T.email, password: T.pass })

const overdueHw = await asTeacher.rpc('create_homework', {
  p_student_id: byName['Тимур'],
  p_lang: 'en',
  // ⚠️ Минус 12 часов, а не двое суток: create_homework не принимает срок
  // старше суток (RECALL_BAD_DUE) — домашку не выдают задним числом. Полсуток
  // назад уже просрочено и при этом проходит проверку сервера.
  p_due: new Date(Date.now() - 12 * 3600_000).toISOString(),
  p_items: [
    { kind: 'free', title: 'Рассказать про выходные', target: 1, pick_group: null },
    { kind: 'free', title: 'Выписать пять слов', target: 1, pick_group: null },
  ],
  p_note: null,
})
const freshHw = await asTeacher.rpc('create_homework', {
  p_student_id: byName['Айгерим'],
  p_lang: 'en',
  p_due: new Date(Date.now() + 3 * 86400000).toISOString(),
  p_items: [
    { kind: 'free', title: 'Первое', target: 1, pick_group: null },
    { kind: 'free', title: 'Второе', target: 1, pick_group: null },
  ],
  p_note: null,
})
if (overdueHw.error || freshHw.error) {
  throw new Error(`домашка не выдана: ${overdueHw.error?.message ?? freshHw.error?.message}`)
}

// Один пункт из двух ученик отметил сам — строка должна показать «1 из 2».
const asAigerim = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await asAigerim.auth.signInWithPassword({ email: 'lost-aigerim@recall.test', password: T.pass })
const { data: myHw } = await asAigerim.rpc('get_homework', { p_student: undefined })
await asAigerim.rpc('complete_homework_item', { p_item: myHw.items[0].id })

const PORT = 9400 + Math.floor(Math.random() * 500)
spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
  `--user-data-dir=${profileDir('lost')}`, 'about:blank'],
  { detached: true, stdio: 'ignore' }).unref()
let b = null
for (let i = 0; i < 30 && !b; i++) {
  await sleep(500)
  b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 }).catch(() => null)
}
const page = await b.newPage()
await page.setViewport({ width: 390, height: 844 })
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
await sleep(400)
await page.type('#f-email', T.email)
await page.type('#f-password', T.pass)
await page.click('button[type="submit"]')
await sleep(4500)
await page.goto('http://localhost:5173/teacher', { waitUntil: 'networkidle2' })
await sleep(3000)

const txt = await page.evaluate(() => document.body.innerText)
console.log('--- экран ---')
console.log(txt.split('\n').filter(Boolean).slice(0, 22).join(' | '))
console.log('--- конец ---')
const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}
// ---- сводка: пропавшие И те, у кого домашка просрочена ---------------------
check('сводка называет всех, кому нужно внимание', /Нужно внимание: 3/.test(txt), (txt.match(/Нужно внимание: \d+/) || [''])[0])
check('назван пропавший 9 дней назад', /Данияр — не заходил 9 дней/.test(txt))
check('назван не начинавший', /Асель — ещё не начинал/.test(txt))
check('назван тот, у кого домашка просрочена', /Тимур — домашка просрочена/.test(txt))
check(
  'занимающийся и сделавший часть домашки в сводку НЕ попал',
  !/Айгерим — /.test(txt.split('Неделя без занятий')[0] ?? txt),
)

// ---- строка ученика: домашка, срок, регулярность ----------------------------
// ⚠️ Счёт ищем ВМЕСТЕ со сроком: «\d+ из \d+» само по себе ловит энергию
// студии («40 из 40») и было бы зелёным без домашки вовсе.
check(
  'в строке виден счёт домашки',
  /1 из 2 · до /.test(txt),
  (txt.match(/\d+ из \d+ · [^\n]*/) || [''])[0],
)
check('и срок днём недели', /· до \S+/.test(txt), (txt.match(/· до [^\n]*/) || [''])[0])
check('у просроченной так и написано', /· просрочена/.test(txt))
check('у кого домашки нет — сказано прямо', /Домашка не выдана/.test(txt))
check(
  'регулярность вместо объёма: «занимался 5 из 7»',
  /занимался 5 из 7/.test(txt),
  (txt.match(/занимался \d+ из \d+/) || [''])[0],
)
check('сумма карточек в строке не показывается', !/карточ/i.test(txt))
check('срок последнего занятия остался', /занимался сегодня|не заходил/.test(txt))

// ---- порядок: сперва те, кому нужно внимание --------------------------------
// ⚠️ Сверяем ПОРЯДОК ИМЁН на экране, а не факт их наличия: сортировка — это и
// есть фича, а «все четверо на месте» было бы зелёным и без неё.
// ⚠️ Ищем в части экрана ПОСЛЕ сводки: в самой сводке имена тоже перечислены,
// и поиск по всему тексту мерил бы порядок в ней, а не в списке.
const listPart = txt.split(/Неделя без занятий|Срок домашки прошёл/).pop() ?? txt
const namesOrder = ['Тимур', 'Данияр', 'Асель', 'Айгерим']
  .map((n) => [n, listPart.indexOf(n)])
  .filter(([, i]) => i >= 0)
const sorted = namesOrder.every(([, i], k) => k === 0 || i > namesOrder[k - 1][1])
check(
  'просрочка выше пропавших, пропавшие выше занимающегося',
  namesOrder.length === 4 && sorted,
  // ⚠️ Печатаем то, что РЕАЛЬНО на экране (по возрастанию позиции), а не свой
  // ожидаемый список: первая версия выводила ожидание и при провале выглядела
  // так, будто порядок верный.
  [...namesOrder].sort((a, b) => a[1] - b[1]).map(([n]) => n).join(' → '),
)

await b.close()
await admin.auth.admin.deleteUser(idT).catch(() => {})
await admin.from('allowed_emails').delete().eq('email', T.email)
for (const [id, em] of made) {
  await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', em)
}
const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
