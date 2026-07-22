/**
 * Смоук диагностической карты: требует выполненного блока «ДИАГНОСТИКА»
 * из docs/schema.sql (таблица grammar_mistakes).
 *  1. Создаёт учителя, ученицу и постороннего (service_role), привязывает пару.
 *  2. Ученица пишет ошибки грамматики (insert + upsert-дубликат), удаляет одну
 *     верным ответом.
 *  3. Учитель ЧИТАЕТ ошибки ученицы (политика is_student_of); посторонний — нет.
 *  4. Ученица не может писать ошибки от чужого имени (RLS with check).
 *  5. Отвязка ученицы отбирает у учителя доступ к её ошибкам.
 *  6. Подчистка: тестовые аккаунты удаляются, ошибки уходят каскадом.
 * Запуск: node scripts/smoke-diagnostics.mjs
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

const T_EMAIL = 'diag-teacher@recall.test'
const S_EMAIL = 'diag-student@recall.test'
const X_EMAIL = 'diag-stranger@recall.test'
const PASSWORD = 'DiagSmoke!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function makeUser(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'diag-smoke (временный)' })
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
  if (role === 'teacher') {
    await admin.from('profiles').update({ role: 'teacher' }).eq('id', id)
  }
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
  xId = await makeUser(X_EMAIL, 'learner')
  await admin
    .from('teacher_students')
    .upsert({ teacher_id: tId, student_id: sId }, { onConflict: 'teacher_id,student_id' })
  console.log('Аккаунты готовы (учитель, ученица, посторонний).')

  const teacher = await signIn(T_EMAIL)
  const student = await signIn(S_EMAIL)
  const stranger = await signIn(X_EMAIL)

  // 2. ученица пишет ошибки (как addMistake: upsert с ignoreDuplicates)
  const rows = [
    { user_id: sId, lang: 'en', topic_id: 3, ex: 1 },
    { user_id: sId, lang: 'en', topic_id: 3, ex: 4 },
    { user_id: sId, lang: 'en', topic_id: 7, ex: 2 },
  ]
  const ins = await student
    .from('grammar_mistakes')
    .upsert(rows, { onConflict: 'user_id,lang,topic_id,ex', ignoreDuplicates: true })
  check('ученица пишет свои ошибки', !ins.error, ins.error?.message)

  const dup = await student
    .from('grammar_mistakes')
    .upsert([rows[0]], { onConflict: 'user_id,lang,topic_id,ex', ignoreDuplicates: true })
  check('повторная ошибка не дублируется (upsert)', !dup.error, dup.error?.message)

  // верный ответ убирает ошибку (removeMistake — без user_id, RLS сама режет)
  const del = await student
    .from('grammar_mistakes')
    .delete()
    .match({ lang: 'en', topic_id: 3, ex: 4 })
  check('верный ответ удаляет ошибку', !del.error, del.error?.message)

  // 3. учитель читает ошибки ученицы
  const tRead = await teacher.from('grammar_mistakes').select('*').eq('user_id', sId)
  check(
    'учитель видит ошибки ученицы (ровно 2)',
    !tRead.error && tRead.data?.length === 2,
    tRead.error?.message ?? `строк: ${tRead.data?.length}`,
  )

  // посторонний не видит ничего
  const xRead = await stranger.from('grammar_mistakes').select('*').eq('user_id', sId)
  check('посторонний НЕ видит ошибки', !xRead.error && xRead.data?.length === 0)

  // 4. подделка user_id отклоняется
  const forge = await student
    .from('grammar_mistakes')
    .insert({ user_id: xId, lang: 'en', topic_id: 1, ex: 1 })
  check('запись от чужого имени отклонена', !!forge.error)

  // 5. отвязка отбирает доступ
  await admin.from('teacher_students').delete().match({ teacher_id: tId, student_id: sId })
  const tAfter = await teacher.from('grammar_mistakes').select('*').eq('user_id', sId)
  check('экс-учитель после отвязки не видит ошибки', !tAfter.error && tAfter.data?.length === 0)
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
    /* подчистка не критична */
  }
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
