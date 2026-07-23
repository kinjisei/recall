/**
 * Смоук атомарных RPC (блок «АТОМАРНОСТЬ»):
 *  - assign_selected_words: колода+карточки+назначение одной транзакцией;
 *  - replace_study_plan: замена активной программы без «дыры»;
 *  - чужой учитель — отказ в обеих.
 * Запуск: node scripts/smoke-atomic.mjs
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

const T = 'atomic-teacher@recall.test'
const S = 'atomic-student@recall.test'
const X = 'atomic-stranger@recall.test'
const PASSWORD = 'Atomic!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function mk(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'atomic-smoke (временный)' })
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
  tId = await mk(T, 'teacher')
  sId = await mk(S, 'learner')
  xId = await mk(X, 'teacher')
  await admin
    .from('teacher_students')
    .upsert({ teacher_id: tId, student_id: sId }, { onConflict: 'teacher_id,student_id' })
  const teacher = await signIn(T)
  const student = await signIn(S)
  const stranger = await signIn(X)
  console.log('Аккаунты готовы.')

  // --- assign_selected_words ---
  const { data: added, error: awErr } = await teacher.rpc('assign_selected_words', {
    p_student_id: sId,
    p_title: 'Еда — выборка (атомик)',
    p_lang: 'en',
    p_cards: [
      { front: 'apple', back: 'яблоко', example: 'I ate an apple.' },
      { front: 'bread', back: 'хлеб', example: '' },
    ],
  })
  check('assign_selected_words: 2 карточки', !awErr && added === 2, awErr?.message ?? `added=${added}`)
  const { data: sCards } = await student
    .from('cards')
    .select('front, decks!inner(title)')
    .eq('decks.title', 'Еда — выборка (атомик)')
  check('ученица видит обе карточки выборки', sCards?.length === 2, `карточек: ${sCards?.length}`)

  const { error: xErr } = await stranger.rpc('assign_selected_words', {
    p_student_id: sId, p_title: 'x', p_lang: 'en',
    p_cards: [{ front: 'x', back: '', example: '' }],
  })
  check('чужой учитель — отказ (выборка)', !!xErr)

  // --- replace_study_plan: дважды — активная всегда одна ---
  const weeks = [{ title: 'Неделя 1', focus: 'f', items: [{ type: 'words', title: 't', note: 'n' }] }]
  const r1 = await teacher.rpc('replace_study_plan', {
    p_student_id: sId, p_lang: 'en', p_level: 'B1', p_goal: 'g1', p_summary: 's1', p_weeks: weeks,
  })
  const r2 = await teacher.rpc('replace_study_plan', {
    p_student_id: sId, p_lang: 'en', p_level: 'B1', p_goal: 'g2', p_summary: 's2', p_weeks: weeks,
  })
  const { data: active } = await student
    .from('study_plans')
    .select('goal')
    .eq('status', 'active')
  check(
    'replace_study_plan: после двух замен активная одна (последняя)',
    !r1.error && !r2.error && active?.length === 1 && active[0].goal === 'g2',
    r1.error?.message ?? r2.error?.message ?? JSON.stringify(active),
  )
  const { error: xpErr } = await stranger.rpc('replace_study_plan', {
    p_student_id: sId, p_lang: 'en', p_level: 'B1', p_goal: 'x', p_summary: 'x', p_weeks: weeks,
  })
  check('чужой учитель — отказ (программа)', !!xpErr)
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of [tId, sId, xId]) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  try {
    await admin.from('allowed_emails').delete().in('email', [T, S, X])
  } catch {
    /* некритично */
  }
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
