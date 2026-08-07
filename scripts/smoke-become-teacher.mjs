/**
 * Смоук самостоятельной роли преподавателя (A1).
 * Требует блока «САМОСТОЯТЕЛЬНАЯ РОЛЬ ПРЕПОДАВАТЕЛЯ» из docs/schema.sql.
 *
 *  1. Обычный пользователь включает себе роль сам (RPC become_teacher).
 *  2. Повторный вызов не ломается (идемпотентность).
 *  3. Прямая попытка выдать себе роль в обход RPC (update profiles.role) — отказ.
 *  4. На ТРИАЛЕ мест ровно free_teacher_seats(): 3 ученика привязываются,
 *     четвёртый получает RECALL_SEATS_FULL (их ученики наследуют повышенные
 *     лимиты AI, поэтому места считаем).
 *  5. get_my_plan отдаёт seats/seats_used/free_seats.
 *  6. ПОСЛЕ триала лимита нет (seats = null) и четвёртый ученик привязывается:
 *     ученики такого преподавателя ничего не наследуют и стоят нам столько же,
 *     сколько любые бесплатные аккаунты.
 *  7. Запись о новом преподавателе попала в teacher_signups.
 *  8. teacher_seats_effective недоступна клиенту напрямую (утечка чужого тарифа).
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
  // Аккаунт мог остаться от прошлого прогона (удаление в finally может не
  // пройти) — приводим профиль к известному состоянию, иначе тест недетерминирован:
  // остаточный тариф менял источник энергии и проверки покрытия «плавали».
  await admin
    .from('profiles')
    .update({
      role: 'learner',
      plan: 'free',
      plan_expires_at: null,
      trial_until: new Date(Date.now() + 14 * 864e5).toISOString(),
    })
    .eq('id', id)
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

  // 6. после триала лимита нет: ученики такого преподавателя не наследуют
  //    повышенных лимитов, поэтому считать места незачем
  await admin
    .from('profiles')
    .update({ trial_until: new Date(Date.now() - 864e5).toISOString() })
    .eq('id', tId)
  const planAfter = (await teacher.rpc('get_my_plan')).data
  check(
    'после триала мест без ограничения (seats = null)',
    planAfter?.seats === null,
    `seats=${planAfter?.seats}`,
  )
  const lastStudent = await signIn(S_EMAILS[3])
  const late = await lastStudent.rpc('join_teacher', { code })
  check('четвёртый ученик привязался после триала', !late.error, late.error?.message)

  // 6b. ГЛАВНОЕ: тариф покрывает только первых N по дате привязки.
  //     Воспроизводим саму дыру: набрали учеников сверх мест, пока лимита не
  //     было, потом «купили» тариф — четвёртый НЕ должен получить пул студии.
  await admin
    .from('profiles')
    .update({ trial_until: new Date(Date.now() + 7 * 864e5).toISOString() })
    .eq('id', tId)

  const covered = []
  for (let i = 0; i < 4; i++) {
    const st = await signIn(S_EMAILS[i])
    const p = (await st.rpc('get_my_plan')).data
    covered.push({ studio: p?.in_studio, max: p?.energy_max })
  }
  check(
    'первые 3 ученика покрыты тарифом (пул студии)',
    covered.slice(0, 3).every((c) => c.studio === true),
    covered
      .slice(0, 3)
      .map((c) => `${c.studio}/${c.max}`)
      .join(' '),
  )
  check(
    'четвёртый ученик СВЕРХ мест не покрыт (не в студии)',
    covered[3].studio === false,
    `in_studio=${covered[3].studio}, energy_max=${covered[3].max}`,
  )

  // 6c. расширили тариф — покрытие догоняет, руками ничего чинить не надо
  await admin
    .from('profiles')
    .update({
      plan: 'teacher_mini',
      plan_expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    })
    .eq('id', tId)
  const st4 = await signIn(S_EMAILS[3])
  const p4 = (await st4.rpc('get_my_plan')).data
  check(
    'после расширения тарифа четвёртый покрыт',
    p4?.in_studio === true,
    `in_studio=${p4?.in_studio}, energy_max=${p4?.energy_max}`,
  )

  // 6d. преподаватель сам выбирает, кто занимает место
  const teacher2 = await signIn(T_EMAIL)
  // вернём тариф в состояние «мест 3» (триал), чтобы место было дефицитным
  await admin
    .from('profiles')
    .update({ plan: 'free', plan_expires_at: null })
    .eq('id', tId)

  const free1 = await teacher2.rpc('set_student_seat', { p_student: sIds[0], p_on: false })
  check('преподаватель освобождает место у первого', !free1.error, free1.error?.message)

  const give4 = await teacher2.rpc('set_student_seat', { p_student: sIds[3], p_on: true })
  check('преподаватель отдаёт место четвёртому', !give4.error, give4.error?.message)

  const st1 = await signIn(S_EMAILS[0])
  const p1 = (await st1.rpc('get_my_plan')).data
  const st4b = await signIn(S_EMAILS[3])
  const p4b = (await st4b.rpc('get_my_plan')).data
  check(
    'покрытие переехало: первый вне тарифа, четвёртый в тарифе',
    p1?.in_studio === false && p4b?.in_studio === true,
    `первый=${p1?.in_studio}, четвёртый=${p4b?.in_studio}`,
  )

  const over = await teacher2.rpc('set_student_seat', { p_student: sIds[0], p_on: true })
  check(
    'сверх мест дать нельзя',
    !!over.error && over.error.message.includes('RECALL_SEATS_FULL'),
    over.error?.message ?? 'ПРОШЛО',
  )

    // сам себе учеником не является — проверка «не твой ученик»
  const alien = await teacher2.rpc('set_student_seat', { p_student: tId, p_on: true })
  check(
    'не своему ученику место дать нельзя',
    !!alien.error,
    alien.error?.message ?? 'ПРОШЛО',
  )

  // 6e. отвязка ученика
  const del = await teacher2
    .from('teacher_students')
    .delete()
    .eq('teacher_id', tId)
    .eq('student_id', sIds[1])
  const { count: leftLinks } = await admin
    .from('teacher_students')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', tId)
  check('преподаватель отвязал ученика', !del.error && leftLinks === 3, `связей: ${leftLinks}`)

  // 6f. РОЛЬ САМА ПО СЕБЕ НИЧЕГО НЕ ДАЁТ: пул студии и генерации на триале
  //     включаются только с первым учеником. Иначе любой аккаунт одним нажатием
  //     получал 40 ⚡/день вместо 30/15 и 10 генераций на Pro-моделях.
  const lonely = await makeUser('become-lonely@recall.test')
  await admin.from('profiles').update({ role: 'teacher' }).eq('id', lonely)
  const lonelyClient = await signIn('become-lonely@recall.test')
  const lonelyPlan = (await lonelyClient.rpc('get_my_plan')).data
  check(
    'преподаватель БЕЗ учеников: пула студии нет',
    lonelyPlan?.in_studio === false && lonelyPlan?.gen_limit === 0,
    `in_studio=${lonelyPlan?.in_studio}, gen_limit=${lonelyPlan?.gen_limit}`,
  )
  check(
    'преподаватель БЕЗ учеников: энергия как у обычного триала',
    lonelyPlan?.energy_max === 30,
    `energy_max=${lonelyPlan?.energy_max}`,
  )
  const lonelyGen = await lonelyClient.rpc('spend_energy', {
    p_kind: 'heavy', p_cost: 0, p_generation: true,
  })
  check(
    'преподаватель БЕЗ учеников: генерация отклонена',
    !!lonelyGen.error && /GEN_LIMIT/.test(lonelyGen.error.message),
    lonelyGen.error?.message ?? 'ПРОШЛА',
  )

  // привязываем одного ученика — студия оживает
  const lonelyCode = (await lonelyClient.rpc('ensure_invite_code')).data
  const someStudent = await signIn(S_EMAILS[2])
  await someStudent.rpc('join_teacher', { code: lonelyCode })
  const lonelyPlan2 = (await lonelyClient.rpc('get_my_plan')).data
  check(
    'с первым учеником: пул студии 40 и 3 генерации',
    lonelyPlan2?.energy_max === 40 && lonelyPlan2?.gen_limit === 3,
    `energy_max=${lonelyPlan2?.energy_max}, gen_limit=${lonelyPlan2?.gen_limit}`,
  )
  await admin.from('teacher_students').delete().eq('teacher_id', lonely)
  await admin.auth.admin.deleteUser(lonely).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', 'become-lonely@recall.test')

  // 7. журнал самостоятельных включений
  const { count } = await admin
    .from('teacher_signups')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', tId)
  check('запись в teacher_signups есть', count === 1, `строк: ${count}`)

  // 8. служебная функция закрыта от клиента
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
