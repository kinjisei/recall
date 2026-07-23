/**
 * Смоук плана дня: требует блока «ПЛАН ДНЯ» из docs/schema.sql.
 *  1. Учитель сохраняет план привязанной ученице (RPC set_daily_plan).
 *  2. Ученица читает свой план; посторонний учитель — отказ; ученица сама
 *     задать план не может; кривой план (не объект) отклоняется.
 *  3. Сброс в null возвращает умный дефолт.
 * Запуск: node scripts/smoke-dailyplan.mjs
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

const T_EMAIL = 'dplan-teacher@recall.test'
const S_EMAIL = 'dplan-student@recall.test'
const X_EMAIL = 'dplan-stranger@recall.test'
const PASSWORD = 'DplanSmoke!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function makeUser(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'dplan-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
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

let tId, sId, xId
try {
  tId = await makeUser(T_EMAIL, 'teacher')
  sId = await makeUser(S_EMAIL, 'learner')
  xId = await makeUser(X_EMAIL, 'teacher')
  await admin
    .from('teacher_students')
    .upsert({ teacher_id: tId, student_id: sId }, { onConflict: 'teacher_id,student_id' })
  const teacher = await signIn(T_EMAIL)
  const student = await signIn(S_EMAIL)
  const stranger = await signIn(X_EMAIL)
  console.log('Аккаунты готовы.')

  const plan = { kinds: ['reader', 'conversation'], auto: true }

  const set = await teacher.rpc('set_daily_plan', { p_student_id: sId, p_plan: plan })
  check('учитель сохраняет план', !set.error, set.error?.message)

  const sRead = await student
    .from('teacher_students')
    .select('daily_plan')
    .eq('student_id', sId)
    .not('daily_plan', 'is', null)
    .maybeSingle()
  check(
    'ученица читает свой план',
    !sRead.error && sRead.data?.daily_plan?.kinds?.length === 2,
    sRead.error?.message ?? JSON.stringify(sRead.data?.daily_plan),
  )

  const xSet = await stranger.rpc('set_daily_plan', { p_student_id: sId, p_plan: plan })
  check('чужой учитель — отказ', !!xSet.error)

  const selfSet = await student.rpc('set_daily_plan', { p_student_id: sId, p_plan: plan })
  check('ученица сама — отказ', !!selfSet.error)

  const bad = await teacher.rpc('set_daily_plan', { p_student_id: sId, p_plan: [1, 2, 3] })
  check('кривой план (массив) отклонён', !!bad.error)

  const clear = await teacher.rpc('set_daily_plan', { p_student_id: sId, p_plan: null })
  const after = await student
    .from('teacher_students')
    .select('daily_plan')
    .eq('student_id', sId)
    .maybeSingle()
  check('сброс в null (умный дефолт)', !clear.error && after.data?.daily_plan === null)
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of [tId, sId, xId]) {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  try {
    await admin.from('allowed_emails').delete().in('email', [T_EMAIL, S_EMAIL, X_EMAIL])
  } catch {
    /* некритично */
  }
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
