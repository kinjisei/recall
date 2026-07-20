/**
 * Смоук AI-квестов (RPC-цепочка, без UI): требует выполненного блока
 * «AI-КВЕСТЫ» из docs/schema.sql.
 *  1. Создаёт учителя и ученицу (service_role), привязывает их.
 *  2. Учитель назначает квест (target=3); ученица видит его.
 *  3. Ученица трижды засчитывает верный ответ → progress 1,2,3 → completed.
 *  4. save_quest_messages сохраняет переписку; учитель её видит.
 *  5. Защита: чужой не видит квест; ученица не может назначить квест сама;
 *     четвёртый инкремент по завершённому квесту отклоняется.
 *  6. Учитель снимает квест; всё подчищается.
 * Запуск: node scripts/smoke-quests.mjs
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

const T_EMAIL = 'quest-teacher@recall.test'
const S_EMAIL = 'quest-student@recall.test'
const X_EMAIL = 'quest-stranger@recall.test'
const PASSWORD = 'QuestSmoke!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function makeUser(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'quest-smoke (временный)' })
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
  // 1. пользователи и связь
  tId = await makeUser(T_EMAIL, 'teacher')
  sId = await makeUser(S_EMAIL, 'learner')
  xId = await makeUser(X_EMAIL, 'learner')
  await admin.from('teacher_students').upsert(
    { teacher_id: tId, student_id: sId },
    { onConflict: 'teacher_id,student_id' },
  )
  console.log('Аккаунты готовы (учитель, ученица, посторонний).')

  const teacher = await signIn(T_EMAIL)
  const student = await signIn(S_EMAIL)
  const stranger = await signIn(X_EMAIL)

  // 2. назначение
  const { data: qid, error: aErr } = await teacher.rpc('assign_grammar_quest', {
    p_student_id: sId,
    p_lang: 'en',
    p_level: 'B1',
    p_topic: 'Past Simple',
    p_scenario: 'Побег из запертой комнаты',
    p_target: 3,
  })
  check('учитель назначает квест', !aErr && !!qid, aErr?.message)

  const { data: sQuests } = await student
    .from('grammar_quests')
    .select('*')
    .eq('id', qid)
  check('ученица видит квест', sQuests?.length === 1 && sQuests[0].target === 3)

  // 5a. защита: посторонний не видит
  const { data: xQuests } = await stranger.from('grammar_quests').select('*').eq('id', qid)
  check('посторонний НЕ видит квест', (xQuests ?? []).length === 0)

  // 5b. ученица не может назначить квест сама себе
  const { error: sAssignErr } = await student.rpc('assign_grammar_quest', {
    p_student_id: sId,
    p_lang: 'en',
    p_level: 'B1',
    p_topic: 'X',
    p_scenario: 'Y',
    p_target: 3,
  })
  check('ученица НЕ может назначать квесты', !!sAssignErr)

  // 3. прогресс: 1 → 2 → 3 (completed)
  let last = 0
  for (let i = 1; i <= 3; i++) {
    const { data: p, error } = await student.rpc('quest_correct_answer', { p_id: qid })
    if (error) {
      check(`инкремент ${i}`, false, error.message)
      break
    }
    last = p
  }
  check('прогресс дошёл до 3', last === 3)
  const { data: after } = await student.from('grammar_quests').select('*').eq('id', qid)
  check('квест completed', after?.[0]?.status === 'completed' && !!after[0].completed_at)

  // 5c. инкремент по завершённому — отклоняется
  const { error: overErr } = await student.rpc('quest_correct_answer', { p_id: qid })
  check('лишний инкремент отклонён', !!overErr)

  // 4. переписка
  const msgs = [
    { role: 'user', content: '/start' },
    { role: 'assistant', content: 'VERDICT: START\n\nYou are locked in a room…' },
    { role: 'user', content: 'I opened the door and escaped.' },
  ]
  const { error: mErr } = await student.rpc('save_quest_messages', {
    p_id: qid,
    p_messages: msgs,
  })
  const { data: tView } = await teacher.from('grammar_quests').select('messages').eq('id', qid)
  check(
    'переписка сохранена и видна учителю',
    !mErr && tView?.[0]?.messages?.length === 3,
    mErr?.message,
  )

  // 6. снятие
  const { error: dErr } = await teacher.rpc('delete_grammar_quest', { p_id: qid })
  check('учитель снимает квест', !dErr, dErr?.message)

  const failed = results.filter((r) => !r).length
  console.log(`\nИтого: ${results.length - failed}/${results.length} ок`)
  process.exitCode = failed > 0 ? 1 : 0
} catch (e) {
  console.error('Смоук упал:', e)
  process.exitCode = 1
} finally {
  for (const id of [tId, sId, xId]) {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  await admin
    .from('allowed_emails')
    .delete()
    .in('email', [T_EMAIL, S_EMAIL, X_EMAIL])
  console.log('Тестовые аккаунты удалены.')
}
