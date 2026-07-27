/**
 * Смоук захода 21 (закрытие находок аудита). Требует выполненного блока
 * «ЗАХОД 21» из docs/schema.sql. Проверяет НОВОЕ поведение:
 *   1. Аноним не может звать RPC (revoke execute from public, anon).
 *   2. log_activity: работает, инкрементит, отвергает плохой type и день вне ±1.
 *   3. Прямая запись в activity_log запрещена (только через RPC).
 *   4. materials: ученица (learner) не может вставить материал; учитель может.
 * Запуск: node scripts/smoke-zahod21.mjs
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

const T_EMAIL = 'z21-teacher@recall.test'
const S_EMAIL = 'z21-student@recall.test'
const PASSWORD = 'Z21Smoke!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const day = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function makeUser(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'z21-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
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
  const teacher = await signIn(T_EMAIL)
  const student = await signIn(S_EMAIL)
  console.log('Аккаунты готовы (учитель, ученица).')

  // 1. АНОНИМ не может звать RPC (revoke execute from public, anon)
  const anonClient = anon()
  const anonPlan = await anonClient.rpc('get_my_plan')
  check('аноним НЕ может звать get_my_plan', !!anonPlan.error, anonPlan.error?.code)
  const anonJoin = await anonClient.rpc('join_teacher', { code: 'ZZZZZZ' })
  check('аноним НЕ может звать join_teacher (нет оракула)', !!anonJoin.error, anonJoin.error?.code)

  // 2. log_activity
  const la1 = await student.rpc('log_activity', { p_type: 'reader', p_day: day(0), p_items: 3, p_sec: 60 })
  check('log_activity: валидный вызов проходит', !la1.error, la1.error?.message)
  await student.rpc('log_activity', { p_type: 'reader', p_day: day(0), p_items: 2, p_sec: 30 })
  const row = await admin
    .from('activity_log')
    .select('items_done, duration_sec')
    .eq('user_id', sId)
    .eq('day', day(0))
    .eq('type', 'reader')
    .maybeSingle()
  check(
    'log_activity: инкремент накапливается (3+2=5)',
    row.data?.items_done === 5 && row.data?.duration_sec === 90,
    `items=${row.data?.items_done}, sec=${row.data?.duration_sec}`,
  )
  const laBadType = await student.rpc('log_activity', { p_type: 'hack', p_day: day(0), p_items: 1, p_sec: 0 })
  check('log_activity: плохой type отвергнут', !!laBadType.error, laBadType.error?.message?.slice(0, 40))
  const laBadDay = await student.rpc('log_activity', { p_type: 'reader', p_day: day(-5), p_items: 1, p_sec: 0 })
  check('log_activity: день вне ±1 суток отвергнут', !!laBadDay.error, laBadDay.error?.message?.slice(0, 40))
  // ±1 в пределах окна — принимается (часовой пояс)
  const laEdge = await student.rpc('log_activity', { p_type: 'grammar', p_day: day(1), p_items: 1, p_sec: 0 })
  check('log_activity: день +1 (часовой пояс) принят', !laEdge.error, laEdge.error?.message)

  // 3. прямая запись в activity_log запрещена (revoke)
  const directLog = await student
    .from('activity_log')
    .insert({ user_id: sId, day: day(-30), type: 'reader', items_done: 999 })
  check('прямая запись в activity_log запрещена', !!directLog.error, directLog.error?.code)

  // 4. materials: роль
  const mat = {
    lang: 'en',
    level: 'B1',
    topic: 'z21',
    format: 'reading',
    length_range: 'short',
    body: 'test',
    exercises: [],
  }
  const learnerMat = await student.from('materials').insert({ ...mat, teacher_id: sId })
  check('ученица (learner) НЕ может вставить материал', !!learnerMat.error, learnerMat.error?.code)
  const teacherMat = await teacher.from('materials').insert({ ...mat, teacher_id: tId }).select('id').single()
  check('учитель может вставить материал', !teacherMat.error, teacherMat.error?.message)
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of [tId, sId]) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  try {
    await admin.from('allowed_emails').delete().in('email', [T_EMAIL, S_EMAIL])
  } catch {
    /* некритично */
  }
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
