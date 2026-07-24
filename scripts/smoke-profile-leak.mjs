/**
 * Смоук блока «УТЕЧКА ПРОФИЛЯ» (заход 20).
 *  A. Ученица НЕ читает секреты профиля преподавателя (invite_code, plan,
 *     trial_until, is_admin) — ни через select('*'), ни адресно по колонке.
 *  B. Имя/уровень/роль связанной стороны читаются как раньше (экраны не сломаны).
 *  C. Свои собственные секреты через REST тоже не читаются — только через RPC
 *     get_my_plan() / ensure_invite_code().
 *  D. regenerate_invite_code: доступен только преподавателю, выдаёт НОВЫЙ код,
 *     старый сразу перестаёт работать, а уже привязанная ученица не отваливается.
 * Запуск: node scripts/smoke-profile-leak.mjs (ПОСЛЕ заливки schema.sql)
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

const T = 'leak-teacher@recall.test'
const S = 'leak-student@recall.test'
const O = 'leak-outsider@recall.test'
const PASS = 'LeakSmoke!2026'
const future = new Date(Date.now() + 30 * 86400000).toISOString()

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function mk(email, role, patch = {}) {
  await admin.from('allowed_emails').upsert({ email, note: 'leak-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASS, email_confirm: true,
  })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === email)?.id
  } else if (error) throw new Error(error.message)
  await admin.from('profiles').update({ role, ...patch }).eq('id', id)
  return id
}
async function signIn(email) {
  const c = anon()
  const { error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

let tId, sId, oId
try {
  // преподаватель на платном тарифе (есть места) + ученица + посторонний
  tId = await mk(T, 'teacher', { plan: 'teacher_pro', plan_expires_at: future })
  sId = await mk(S, 'learner')
  oId = await mk(O, 'learner')
  const teacher = await signIn(T)
  const student = await signIn(S)
  const outsider = await signIn(O)

  const { data: code1 } = await teacher.rpc('ensure_invite_code')
  check('код-приглашение получен', typeof code1 === 'string' && code1.length >= 4, String(code1))

  const join = await student.rpc('join_teacher', { code: code1 })
  check('ученица привязалась по коду', !join.error, join.error?.message ?? '')

  // --- A. секреты преподавателя недоступны ученице ---
  const star = await student.from('profiles').select('*').eq('id', tId)
  const starLeaked =
    !star.error && (star.data ?? []).some((r) => 'invite_code' in r || 'plan' in r)
  check(
    "select('*') на профиль преподавателя не отдаёт секреты",
    !starLeaked,
    star.error
      ? `запрос отклонён: ${star.error.code}`
      : starLeaked
        ? 'В ОТВЕТЕ ЕСТЬ invite_code/plan!'
        : 'колонок-секретов в ответе нет',
  )

  for (const col of ['invite_code', 'plan', 'trial_until', 'is_admin']) {
    const r = await student.from('profiles').select(col).eq('id', tId)
    const got = !r.error && (r.data ?? [])[0]?.[col] !== undefined
    check(`ученица не читает ${col} преподавателя`, !got, r.error ? r.error.code : 'вернулось значение!')
  }

  // --- B. безобидные поля по-прежнему видны (экраны не сломаны) ---
  const nice = await student
    .from('profiles')
    .select('id, display_name, level, native_lang, role, created_at')
    .eq('id', tId)
  check(
    'имя/уровень/роль преподавателя читаются как раньше',
    !nice.error && (nice.data ?? []).length === 1,
    nice.error?.message ?? '',
  )

  // --- C. свои секреты через REST тоже закрыты, но RPC их отдаёт ---
  const mine = await student.from('profiles').select('plan, is_admin').eq('id', sId)
  check('свой plan/is_admin через REST не читается', !!mine.error, mine.error?.code ?? 'прочиталось!')

  const myPlan = await student.rpc('get_my_plan')
  check(
    'свой тариф отдаёт RPC get_my_plan',
    !myPlan.error && typeof myPlan.data?.plan === 'string',
    myPlan.error?.message ?? String(myPlan.data?.plan),
  )

  // посторонний вообще не видит строку преподавателя (RLS, не гранты)
  const stranger = await outsider.from('profiles').select('id, display_name').eq('id', tId)
  check(
    'посторонний не видит профиль преподавателя',
    !stranger.error && (stranger.data ?? []).length === 0,
    stranger.error?.message ?? '',
  )

  // --- D. перевыпуск кода ---
  const byStudent = await student.rpc('regenerate_invite_code')
  check('ученица не может перевыпустить код', !!byStudent.error, byStudent.error?.message ?? 'прошло!')

  const { data: code2, error: regErr } = await teacher.rpc('regenerate_invite_code')
  check(
    'преподаватель получил НОВЫЙ код',
    !regErr && typeof code2 === 'string' && code2 !== code1,
    regErr?.message ?? `${code1} → ${code2}`,
  )

  const oldCode = await outsider.rpc('join_teacher', { code: code1 })
  check('старый код больше не работает', !!oldCode.error, oldCode.error?.message ?? 'привязался по старому!')

  const newCode = await outsider.rpc('join_teacher', { code: code2 })
  check('новый код работает', !newCode.error, newCode.error?.message ?? '')

  const { data: links } = await admin
    .from('teacher_students')
    .select('student_id')
    .eq('teacher_id', tId)
  check(
    'уже привязанная ученица осталась после смены кода',
    (links ?? []).some((l) => l.student_id === sId),
  )
} catch (e) {
  check(`смоук упал: ${e.message}`, false)
} finally {
  for (const id of [tId, sId, oId]) if (id) await admin.auth.admin.deleteUser(id)
  await admin.from('allowed_emails').delete().in('email', [T, S, O])
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} проверок прошло`)
process.exit(failed ? 1 : 0)
