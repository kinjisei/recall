/**
 * Смоук блоков «КЛАССЫ КВОТ» и «ЛИМИТ УЧЕНИЦ + ГОНКА КВОТЫ».
 *  A. Места тарифа: у преподавателя без плана и без триала мест 0 — привязка
 *     отклоняется; с триалом (3 места) и с teacher_mini (5) — проходит.
 *  B. Классы квот: heavy у free-аккаунта кончается на 6-м запросе, а light и
 *     speech после этого ПРОДОЛЖАЮТ работать (перевод слова и произношение
 *     больше не съедают лимит Диалога).
 * Запуск: node scripts/smoke-quota-seats.mjs
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

const T = 'seat-teacher@recall.test'
const S1 = 'seat-s1@recall.test'
const S2 = 'seat-s2@recall.test'
const PASS = 'SeatSmoke!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const past = new Date(Date.now() - 86400000).toISOString()
const future = new Date(Date.now() + 30 * 86400000).toISOString()

async function mk(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'seat-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASS, email_confirm: true,
  })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === email)?.id
  } else if (error) throw new Error(error.message)
  await admin.from('profiles').update({ role, trial_until: past }).eq('id', id)
  return id
}
async function signIn(email) {
  const c = anon()
  const { error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

let tId, s1, s2
try {
  tId = await mk(T, 'teacher')
  s1 = await mk(S1, 'learner')
  s2 = await mk(S2, 'learner')
  const teacher = await signIn(T)
  const st1 = await signIn(S1)
  const st2 = await signIn(S2)

  const { data: code } = await teacher.rpc('ensure_invite_code')
  check('код-приглашение получен', typeof code === 'string' && code.length >= 4, String(code))

  // --- A. места ---
  // у преподавателя план free и триал в прошлом → мест 0
  let r = await st1.rpc('join_teacher', { code })
  check('без плана и триала — привязка отклонена', !!r.error && r.error.message.includes('RECALL_SEATS_FULL'),
    r.error?.message?.slice(0, 60))

  // включаем триал → 3 места
  await admin.from('profiles').update({ trial_until: future }).eq('id', tId)
  r = await st1.rpc('join_teacher', { code })
  check('с триалом (3 места) — привязка прошла', !r.error, r.error?.message)

  // повторная привязка той же ученицы не должна тратить место
  r = await st1.rpc('join_teacher', { code })
  check('повторная привязка идемпотентна', !r.error, r.error?.message)

  // платный тариф → 5 мест
  await admin.from('profiles')
    .update({ plan: 'teacher_mini', plan_expires_at: future, trial_until: past })
    .eq('id', tId)
  r = await st2.rpc('join_teacher', { code })
  check('teacher_mini (5 мест) — вторая ученица прошла', !r.error, r.error?.message)

  // --- B. классы квот ---
  // s2 — ученица платного учителя → у неё платный доступ; для чистоты теста
  // проверяем классы на s1 после отвязки и сброса тарифа учителя
  await admin.from('teacher_students').delete().eq('student_id', s1)
  await admin.from('ai_calls').delete().eq('user_id', s1)

  const heavy = []
  for (let i = 0; i < 6; i++) heavy.push((await st1.rpc('consume_ai_quota', { p_kind: 'heavy' })).error)
  check('free: 5 heavy прошли, 6-й отклонён',
    heavy.slice(0, 5).every((e) => !e) && !!heavy[5] && heavy[5].message.includes('RECALL_FREE_LIMIT'),
    heavy[5]?.message?.slice(0, 50) ?? 'шестой прошёл — лимит не работает!')

  const light = await st1.rpc('consume_ai_quota', { p_kind: 'light' })
  check('light работает при исчерпанном heavy (перевод слова)', !light.error, light.error?.message)
  const speech = await st1.rpc('consume_ai_quota', { p_kind: 'speech' })
  check('speech работает при исчерпанном heavy (произношение)', !speech.error, speech.error?.message)

  const { data: plan } = await st1.rpc('get_my_plan')
  check('get_my_plan считает только heavy', plan?.ai_used_today === 5 && plan?.ai_day_limit === 5,
    JSON.stringify(plan && { used: plan.ai_used_today, lim: plan.ai_day_limit }))
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of [tId, s1, s2]) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  try {
    await admin.from('allowed_emails').delete().in('email', [T, S1, S2])
  } catch {
    /* некритично */
  }
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
