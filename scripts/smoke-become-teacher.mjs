/**
 * Смоук самостоятельной роли преподавателя (A1).
 * Требует блока «САМОСТОЯТЕЛЬНАЯ РОЛЬ ПРЕПОДАВАТЕЛЯ» из docs/schema.sql.
 *
 *  1. Обычный пользователь включает себе роль сам (RPC become_teacher).
 *  2. Повторный вызов не ломается (идемпотентность).
 *  3. Прямая попытка выдать себе роль в обход RPC (update profiles.role) — отказ.
 *  4. Бесплатных мест ровно free_teacher_seats(): 3 ученика привязываются,
 *     четвёртый получает RECALL_SEATS_FULL.
 *  5. get_my_plan отдаёт seats/seats_used/free_seats.
 *  6. Запись о новом преподавателе попала в teacher_signups.
 *  7. teacher_seats_effective недоступна клиенту напрямую (утечка чужого тарифа).
 *
 * Запуск: node scripts/smoke-become-teacher.mjs
 * Скрипт сам создаёт и удаляет тестовые аккаунты через service_role.
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

const PASSWORD = 'BecomeSmoke!2026'
const T_EMAIL = 'become-teacher@recall.test'
const S_EMAILS = [1, 2, 3, 4].map((i) => `become-student${i}@recall.test`)

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function makeUser(email) {
  // белый список нужен, пока регистрация закрыта (allowed_emails)
  await admin.from('allowed_emails').upsert({ email, note: 'become-smoke (временный)' })
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
  // на всякий случай сбрасываем роль: аккаунт мог остаться от прошлого прогона
  await admin.from('profiles').update({ role: 'learner' }).eq('id', id)
  await admin.from('teacher_students').delete().eq('teacher_id', id)
  await admin.from('teacher_signups').delete().eq('user_id', id)
  return id
}

async function signIn(email) {
  const c = anon()
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

let tId
const sIds = []
try {
  tId = await makeUser(T_EMAIL)
  for (const e of S_EMAILS) sIds.push(await makeUser(e))
  const teacher = await signIn(T_EMAIL)
  console.log('Аккаунты готовы.\n')

  // 1. роль включается самостоятельно
  const become = await teacher.rpc('become_teacher')
  check('пользователь включает себе роль преподавателя', !become.error, become.error?.message)

  const { data: prof } = await admin.from('profiles').select('role').eq('id', tId).single()
  check('в профиле role = teacher', prof?.role === 'teacher', `сейчас: ${prof?.role}`)

  // 2. идемпотентность
  const again = await teacher.rpc('become_teacher')
  check('повторный вызов не ломается', !again.error, again.error?.message)

  // 3. прямой update роли в обход RPC запрещён грантами
  const direct = await teacher.from('profiles').update({ role: 'learner' }).eq('id', tId)
  const { data: still } = await admin.from('profiles').select('role').eq('id', tId).single()
  check(
    'прямой update profiles.role отклонён',
    !!direct.error || still?.role === 'teacher',
    direct.error?.message ?? 'роль не изменилась',
  )

  // 4. лимит бесплатных мест
  const code = (await teacher.rpc('ensure_invite_code')).data
  check('код-приглашение получен', !!code, String(code))

  const plan = (await teacher.rpc('get_my_plan')).data
  const freeSeats = plan?.free_seats
  check('get_my_plan отдаёт free_seats', typeof freeSeats === 'number', `= ${freeSeats}`)

  let joined = 0
  let refusedAt = null
  for (let i = 0; i < sIds.length; i++) {
    const st = await signIn(S_EMAILS[i])
    const r = await st.rpc('join_teacher', { code })
    if (r.error) {
      if (refusedAt === null) refusedAt = i + 1
      check(
        `ученик №${i + 1} отклонён`,
        r.error.message.includes('RECALL_SEATS_FULL'),
        r.error.message,
      )
    } else {
      joined++
      check(`ученик №${i + 1} привязан`, true)
    }
  }
  check(
    `привязалось ровно ${freeSeats} (бесплатных мест)`,
    joined === freeSeats,
    `привязано ${joined}, отказ на ${refusedAt}-м`,
  )

  // 5. места видны в get_my_plan
  const plan2 = (await teacher.rpc('get_my_plan')).data
  check(
    'get_my_plan показывает занятые места',
    plan2?.seats === freeSeats && plan2?.seats_used === joined,
    `seats=${plan2?.seats}, used=${plan2?.seats_used}`,
  )

  // 6. журнал самостоятельных включений
  const { count } = await admin
    .from('teacher_signups')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', tId)
  check('запись в teacher_signups есть', count === 1, `строк: ${count}`)

  // 7. служебная функция закрыта от клиента
  const leak = await teacher.rpc('teacher_seats_effective', { p_uid: sIds[0] })
  check('teacher_seats_effective недоступна клиенту', !!leak.error, leak.error?.message ?? 'ОТДАЛА ДАННЫЕ')
} catch (e) {
  console.error('\nОшибка прогона:', e.message)
  results.push(false)
} finally {
  // уборка: аккаунты, связи, журнал, белый список
  for (const id of [tId, ...sIds].filter(Boolean)) {
    await admin.from('teacher_students').delete().or(`teacher_id.eq.${id},student_id.eq.${id}`)
    await admin.from('teacher_signups').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  for (const e of [T_EMAIL, ...S_EMAILS]) {
    await admin.from('allowed_emails').delete().eq('email', e)
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exit(ok === results.length ? 0 : 1)
}
