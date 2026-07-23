/**
 * Смоук выборочного назначения слов (Заход 2): учитель видит слова набора и
 * назначает ученице выборку из 3 слов — у ученицы появляется колода-выборка
 * ровно с 3 карточками. Повторяет логику lib/teacher.assignSelectedWords
 * теми же запросами (insert deck → копии карточек → deck_assignments).
 * Запуск: node scripts/smoke-deck-picker.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const admin = createClient(URL_, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = () =>
  createClient(URL_, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const T_EMAIL = 'picker-teacher@recall.test'
const S_EMAIL = 'picker-student@recall.test'
const PASSWORD = 'PickerSmoke!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function makeUser(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'picker-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === email)?.id
  } else if (error) throw new Error(error.message)
  if (role === 'teacher') await admin.from('profiles').update({ role: 'teacher' }).eq('id', id)
  return id
}

async function signIn(email) {
  const c = anon()
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

let tId, sId
try {
  tId = await makeUser(T_EMAIL, 'teacher')
  sId = await makeUser(S_EMAIL, 'learner')
  await admin
    .from('teacher_students')
    .upsert({ teacher_id: tId, student_id: sId }, { onConflict: 'teacher_id,student_id' })
  const teacher = await signIn(T_EMAIL)
  const student = await signIn(S_EMAIL)
  console.log('Аккаунты готовы.')

  // исходный набор учителя с 5 словами
  const { data: src, error: dErr } = await teacher
    .from('decks')
    .insert({ owner_id: tId, title: 'Еда (смоук)', lang: 'en' })
    .select()
    .single()
  if (dErr) throw new Error(dErr.message)
  const words = ['apple', 'bread', 'cheese', 'milk', 'egg'].map((w, i) => ({
    deck_id: src.id,
    front: w,
    back: `перевод-${i}`,
    source: 'manual',
  }))
  const ins = await teacher.from('cards').insert(words)
  check('учитель создал набор с 5 словами', !ins.error, ins.error?.message)

  // учитель ЧИТАЕТ слова набора (как DeckWordsPicker)
  const list = await teacher.from('cards').select('*').eq('deck_id', src.id)
  check('учитель видит слова набора (5)', !list.error && list.data?.length === 5)

  // выборка из 3 слов → новая колода + копии + назначение
  const picked = list.data.slice(0, 3)
  const { data: sel, error: selErr } = await teacher
    .from('decks')
    .insert({ owner_id: tId, title: 'Еда (смоук) — выборка для Ученицы', lang: 'en' })
    .select()
    .single()
  if (selErr) throw new Error(selErr.message)
  const copy = await teacher.from('cards').insert(
    picked.map((c) => ({ deck_id: sel.id, front: c.front, back: c.back, source: 'manual' })),
  )
  const asg = await teacher
    .from('deck_assignments')
    .insert({ deck_id: sel.id, student_id: sId })
  check('выборка создана и назначена', !copy.error && !asg.error,
    copy.error?.message ?? asg.error?.message)

  // ученица видит колоду-выборку и РОВНО 3 карточки в очереди
  const sDecks = await student.from('decks').select('*').eq('id', sel.id)
  check('ученица видит колоду-выборку', !sDecks.error && sDecks.data?.length === 1)
  const sCards = await student.from('cards').select('*').eq('deck_id', sel.id)
  check(
    'у ученицы ровно 3 карточки',
    !sCards.error && sCards.data?.length === 3,
    `карточек: ${sCards.data?.length}`,
  )
  // исходный набор ученице НЕ виден (назначена только выборка)
  const sSrc = await student.from('cards').select('*').eq('deck_id', src.id)
  check('исходный набор ученице не виден', !sSrc.error && sSrc.data?.length === 0)
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of [tId, sId]) {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  try {
    await admin.from('allowed_emails').delete().in('email', [T_EMAIL, S_EMAIL])
  } catch {
    /* некритично */
  }
  console.log('Тестовые аккаунты удалены (колоды ушли каскадом).')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
