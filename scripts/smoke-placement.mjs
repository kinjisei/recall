/**
 * Смоук «Тест уровня от преподавателя» (таблица placement_requests).
 *  1. Учитель назначает тест своей ученице; ученица его видит.
 *  2. Посторонний не видит ни просьбу, ни результат.
 *  3. Чужой учитель назначить не может.
 *  4. Ученица не может вписать просьбу или результат напрямую (только RPC).
 *  5. Ученица проходит тест → результат виден учителю.
 *  6. Повторное назначение не плодит дубли (уникальный индекс).
 *  7. Отвязка отбирает у экс-учителя доступ.
 * Запуск: node scripts/smoke-placement.mjs (ПОСЛЕ заливки schema.sql)
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

const T = 'place-teacher@recall.test'
const T2 = 'place-teacher2@recall.test'
const S = 'place-student@recall.test'
const PASS = 'Placement!2026'
const future = new Date(Date.now() + 30 * 86400000).toISOString()

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function mk(email, role, patch = {}) {
  await admin.from('allowed_emails').upsert({ email, note: 'placement-smoke (временный)' })
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

let tId, t2Id, sId
try {
  tId = await mk(T, 'teacher', { plan: 'teacher_pro', plan_expires_at: future })
  t2Id = await mk(T2, 'teacher', { plan: 'teacher_pro', plan_expires_at: future })
  sId = await mk(S, 'learner')
  const teacher = await signIn(T)
  const other = await signIn(T2)
  const student = await signIn(S)

  const { data: code } = await teacher.rpc('ensure_invite_code')
  const join = await student.rpc('join_teacher', { code })
  check('ученица привязана к преподавателю', !join.error, join.error?.message ?? '')

  // --- 1. назначение ---
  const a = await teacher.rpc('assign_placement', { p_student_id: sId, p_lang: 'es' })
  check('учитель назначил тест', !a.error && !!a.data, a.error?.message ?? '')

  const mine = await student
    .from('placement_requests')
    .select('*')
    .eq('status', 'assigned')
  check('ученица видит назначенный тест', !mine.error && (mine.data ?? []).length === 1,
    mine.error?.message ?? `строк ${(mine.data ?? []).length}`)

  // --- 2-3. чужие ---
  const strangerSee = await other.from('placement_requests').select('*')
  check('чужой учитель не видит просьбу', !strangerSee.error && (strangerSee.data ?? []).length === 0,
    `строк ${(strangerSee.data ?? []).length}`)

  const strangerAssign = await other.rpc('assign_placement', { p_student_id: sId, p_lang: 'en' })
  check('чужой учитель не может назначить', !!strangerAssign.error,
    strangerAssign.error?.message ?? 'прошло!')

  // --- 4. подделка ученицей ---
  const forgeInsert = await student
    .from('placement_requests')
    .insert({ teacher_id: tId, student_id: sId, lang: 'en', status: 'done', result_level: 'C2' })
  check('ученица не может вписать просьбу напрямую', !!forgeInsert.error,
    forgeInsert.error?.code ?? 'прошло!')

  const forgeUpdate = await student
    .from('placement_requests')
    .update({ result_level: 'C2', status: 'done' })
    .eq('student_id', sId)
  check('ученица не может вписать себе результат', !!forgeUpdate.error,
    forgeUpdate.error?.code ?? 'прошло!')

  // --- 5. прохождение ---
  const sub = await student.rpc('submit_placement', { p_lang: 'es', p_level: 'B1' })
  check('результат теста записан', !sub.error && sub.data === 1, sub.error?.message ?? `закрыто ${sub.data}`)

  const seen = await teacher.from('placement_requests').select('*').eq('status', 'done')
  check('учитель видит результат',
    !seen.error && (seen.data ?? [])[0]?.result_level === 'B1',
    seen.error?.message ?? String((seen.data ?? [])[0]?.result_level))

  const badLevel = await student.rpc('submit_placement', { p_lang: 'es', p_level: 'Z9' })
  check('выдуманный уровень отклонён', !!badLevel.error, badLevel.error?.message ?? 'прошло!')

  // --- 6. повторное назначение не плодит дубли ---
  await teacher.rpc('assign_placement', { p_student_id: sId, p_lang: 'es' })
  await teacher.rpc('assign_placement', { p_student_id: sId, p_lang: 'es' })
  const openRows = await teacher.from('placement_requests').select('*').eq('status', 'assigned')
  check('повторное назначение не плодит дубли', (openRows.data ?? []).length === 1,
    `открытых ${(openRows.data ?? []).length}`)

  // --- 7. отвязка ---
  await admin.from('teacher_students').delete().eq('teacher_id', tId).eq('student_id', sId)
  const afterUnlink = await teacher.from('placement_requests').select('*')
  check('экс-учитель после отвязки не видит тесты',
    !afterUnlink.error && (afterUnlink.data ?? []).length === 0,
    `строк ${(afterUnlink.data ?? []).length}`)
} catch (e) {
  check(`смоук упал: ${e.message}`, false)
} finally {
  for (const id of [tId, t2Id, sId]) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [T, T2, S])
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} проверок прошло`)
process.exit(failed ? 1 : 0)
