/**
 * Смоук программ обучения (study_plans): требует выполненного блока
 * «ПРОГРАММА ОБУЧЕНИЯ» из docs/schema.sql.
 *  1. Учитель сохраняет программу привязанной ученице.
 *  2. Уникальность: вторая АКТИВНАЯ на ту же пару+язык отклоняется;
 *     архивирование → новая сохраняется.
 *  3. Ученица читает свою программу; посторонний не видит; ученица не может
 *     создать программу сама (подделка teacher_id отклоняется).
 *  4. Отвязка: экс-учитель теряет доступ (чтение и правку), ученица видит
 *     программу по-прежнему.
 * AI-генерация здесь не зовётся (жжёт квоту Pro) — проверяется живым UI-тестом.
 * Запуск: node scripts/smoke-program.mjs
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

const T_EMAIL = 'plan-teacher@recall.test'
const S_EMAIL = 'plan-student@recall.test'
const X_EMAIL = 'plan-stranger@recall.test'
const PASSWORD = 'PlanSmoke!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function makeUser(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'plan-smoke (временный)' })
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

const WEEKS = [
  {
    title: 'Неделя 1: разгон',
    focus: 'Past Simple + база слов',
    items: [
      { type: 'grammar', topicId: 14, title: 'Past Simple', note: 'Пройди урок и упражнения.' },
      { type: 'words', title: '20 слов «Еда»', note: 'Добавь пак и повторяй каждый день.' },
    ],
  },
  {
    title: 'Неделя 2: закрепление',
    focus: 'Разговорная практика',
    items: [{ type: 'dialog', title: 'Расскажи о выходных', note: 'В Past Simple, 10 реплик.' }],
  },
]

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

  const row = {
    teacher_id: tId,
    student_id: sId,
    lang: 'en',
    level: 'B1',
    goal: 'смоук',
    summary: 'Тестовая программа.',
    weeks: WEEKS,
  }

  // 1. учитель сохраняет программу
  const ins = await teacher.from('study_plans').insert(row).select('id').single()
  check('учитель сохраняет программу ученице', !ins.error, ins.error?.message)
  const planId = ins.data?.id

  // 2. вторая активная на ту же пару+язык отклоняется (уникальный индекс)
  const dup = await teacher.from('study_plans').insert(row)
  check('вторая активная программа отклонена', !!dup.error)

  // архив → новая проходит
  const arch = await teacher.from('study_plans').update({ status: 'archived' }).eq('id', planId)
  const ins2 = await teacher.from('study_plans').insert(row).select('id').single()
  check(
    'после архива новая программа сохраняется',
    !arch.error && !ins2.error,
    arch.error?.message ?? ins2.error?.message,
  )
  const activeId = ins2.data?.id

  // 3. доступы
  const sRead = await student.from('study_plans').select('*').eq('status', 'active')
  check(
    'ученица видит свою активную программу',
    !sRead.error && sRead.data?.length === 1 && sRead.data[0].weeks.length === 2,
    sRead.error?.message ?? `строк: ${sRead.data?.length}`,
  )

  const xRead = await stranger.from('study_plans').select('*')
  check('посторонний НЕ видит программ', !xRead.error && xRead.data?.length === 0)

  const forge = await student
    .from('study_plans')
    .insert({ ...row, teacher_id: sId, student_id: sId })
  check('ученица не может создать программу сама', !!forge.error)

  // 4. отвязка → экс-учитель теряет доступ, ученица видит
  await admin.from('teacher_students').delete().match({ teacher_id: tId, student_id: sId })
  const tAfter = await teacher.from('study_plans').select('*').eq('student_id', sId)
  check('экс-учитель после отвязки не видит программ', !tAfter.error && tAfter.data?.length === 0)
  const tEdit = await teacher
    .from('study_plans')
    .update({ summary: 'взлом' })
    .eq('id', activeId)
    .select('id')
  check('экс-учитель не может править', !tEdit.error && (tEdit.data?.length ?? 0) === 0)
  const sAfter = await student.from('study_plans').select('*').eq('status', 'active')
  check('ученица видит программу и после отвязки', !sAfter.error && sAfter.data?.length === 1)
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of [tId, sId, xId]) {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  await admin
    .from('allowed_emails')
    .delete()
    .in('email', [T_EMAIL, S_EMAIL, X_EMAIL])
    .catch(() => {})
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
