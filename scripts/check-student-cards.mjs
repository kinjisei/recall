/**
 * Карточки учеников на живой ТЕСТОВОЙ базе (PLAN.md Ф2.5; журнал п.25, 28,
 * 41, 64; миграция 0008_student_cards.sql).
 *
 * Что доказывает:
 *   1. у каждой связи учитель — ученик есть карточка (в т.ч. перенесённые);
 *      привязка по общему коду заводит карточку «занимается» с именем ученика;
 *   2. карточку без аккаунта можно создать, пригласить своим кодом и связать:
 *      та же карточка (id, дата, заметка), код погас; ушёл и вернулся по
 *      общему коду — снова его карточка, из архива — «занимается»;
 *   3. места: пробный и архив не занимают и не покрываются; «занимается» и
 *      «пауза» — да; архив отдаёт место следующему; пробный → «занимается» при
 *      полных местах не вытесняет покрытого; общий код при полных местах —
 *      отказ, код пробной карточки — пускает; ручной выбор и get_my_plan
 *      считают по тому же правилу; клиентская копия статусов = базе;
 *   4. второй учитель чужих карточек не видит и не меняет; таблица закрыта;
 *   5. без тарифа после пробного — создать, изменить, сменить статус нельзя
 *      (RECALL_PLAN_REQUIRED), пригласить и привязаться — можно;
 *   6. служебные функции с чужим uid закрыты; свой код — «к себе нельзя»;
 *      код учителя и код карточки не совпадают.
 *
 * Запуск: node scripts/check-student-cards.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { CARD_STATUSES, cardTakesSeat } from '../src/domains/students/model.ts'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и двигает тарифы — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const target = dbTarget([])
const sql = (q) => runSql(target, q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const PASSWORD = 'CardsCheck!2026'
const made = []

async function makeUser(tag, name = `Проверка ${tag}`) {
  const email = `cards-check-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'check-student-cards (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = data?.user?.id
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
  }
  made.push({ id, email })
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход ${email}: ${e2.message}`)
  return { id, client }
}

/** Репетитор: настоящий become_teacher; plan — тариф репетитора на 20 дней. */
async function teacher(tag, { plan = null } = {}) {
  const u = await makeUser(tag)
  const r = await u.client.rpc('become_teacher')
  if (r.error) throw new Error(`become_teacher: ${r.error.message}`)
  if (plan) await sql(`update public.profiles set plan = '${plan}', plan_expires_at = now() + interval '20 days' where id = '${u.id}'`)
  return u
}

const code = (r) => r.error?.message ?? 'ok'
const cards = async (u) => (await u.client.rpc('get_my_student_cards')).data ?? []
const cardOf = async (u, id) => (await cards(u)).find((c) => c.id === id)
const byUser = async (u, uid) => (await cards(u)).find((c) => c.user_id === uid)
const cover = async (s) => (await sql(`select public.covering_teacher('${s}') as t`))[0].t
const plan = async (u) => (await u.client.rpc('get_my_plan')).data
const create = (u, name, status = 'trial', extra = {}) =>
  u.client.rpc('create_student_card', { p_name: name, p_contact: extra.contact ?? null, p_note: extra.note ?? null, p_status: status })
const setStatus = (u, card, status) => u.client.rpc('set_student_card_status', { p_card: card, p_status: status })
const invite = (u, card) => u.client.rpc('student_card_invite', { p_card: card })
const join = (s, c) => s.client.rpc('join_teacher', { code: c })
// связь с явной датой: ранг «первых N» зависит от даты привязки
const linkAt = (t, s, daysAgo) =>
  sql(`insert into public.teacher_students (teacher_id, student_id, created_at) values ('${t}', '${s}', now() - interval '${daysAgo} days')`)

async function run() {
  // ── 6 (часть). клиентская копия статусов = базе ──────────────────────────────
  const rows = await sql(`select s, public.card_takes_seat(s) as takes from unnest(array['${CARD_STATUSES.join("','")}']) s`)
  check(
    'копия правила (cardTakesSeat) = card_takes_seat на всех статусах',
    rows.length === CARD_STATUSES.length && rows.every((r) => r.takes === cardTakesSeat(r.s)),
    rows.map((r) => `${r.s}:${r.takes}`).join(' '),
  )

  // ── 1. инвариант: у каждой связи — карточка ─────────────────────────────────
  const [inv] = await sql(`select
      (select count(*)::int from public.teacher_students) as links,
      (select count(*)::int from public.teacher_students ts join public.student_cards c
         on c.teacher_id = ts.teacher_id and c.user_id = ts.student_id) as with_card`)
  check('у каждой связи в базе есть карточка', inv.links === inv.with_card, `связей ${inv.links}, с карточкой ${inv.with_card}`)

  const A = await teacher('a', { plan: 'teacher_mini' }) // 5 мест
  const sGen = await makeUser('gen', 'Айгерим Нурланова')
  const gcode = (await A.client.rpc('ensure_invite_code')).data
  const j0 = await join(sGen, gcode)
  const gCard = await byUser(A, sGen.id)
  check('общий код → карточка «занимается» с именем ученика', !j0.error && gCard?.status === 'active' && gCard?.name === 'Айгерим Нурланова' && gCard?.in_app === true, code(j0))
  check('ученик на тарифе держит место и покрыт', gCard?.holds_seat === true && (await cover(sGen.id)) === A.id)

  // ── 2. создать → пригласить → связать: история на месте ─────────────────────────
  const c1 = await create(A, '  Тимур Ким  ', 'active', { contact: '+7 701 123 45 67', note: 'IELTS, цель 7.0' })
  check('карточку без аккаунта можно создать', !c1.error && typeof c1.data === 'string', code(c1))
  const tim0 = await cardOf(A, c1.data)
  check('имя обрезано, контакт и заметка сохранены, в приложении — нет',
    tim0?.name === 'Тимур Ким' && tim0?.contact === '+7 701 123 45 67' && tim0?.note === 'IELTS, цель 7.0' && tim0?.in_app === false && tim0?.user_id === null)
  check('карточка без приложения места не занимает', (await plan(A)).seats_used === 1, `занято ${(await plan(A)).seats_used}`)
  const inv1 = await invite(A, c1.data)
  const inv1b = await invite(A, c1.data)
  check('у карточки свой код из 6 знаков, повторный показ — тот же', /^[A-Z2-9]{6}$/.test(inv1.data ?? '') && inv1b.data === inv1.data && inv1.data !== gcode, code(inv1))
  const sTim = await makeUser('tim', 'Timur K')
  const j1 = await join(sTim, `  ${inv1.data.toLowerCase()} `)
  const tim1 = await cardOf(A, c1.data)
  check('ученик вошёл по коду карточки — та же карточка, история на месте',
    !j1.error && j1.data === 'Проверка a' && tim1?.in_app === true && tim1?.created_at === tim0.created_at && tim1?.note === tim0.note && tim1?.name === 'Тимур Ким',
    code(j1))
  check('второй карточки не появилось', (await cards(A)).filter((c) => c.user_id === sTim.id).length === 1 && (await cards(A)).length === 2)
  const [{ ic }] = await sql(`select invite_code as ic from public.student_cards where id = '${c1.data}'`)
  check('код карточки погас после привязки', ic === null)
  const sOther = await makeUser('other')
  check('погасший код больше не пускает', /не найден/.test(code(await join(sOther, inv1.data))))
  check('ученику в приложении код не выдаётся', /RECALL_CARD_IN_APP/.test(code(await invite(A, c1.data))))

  // ушёл и вернулся по общему коду — снова его карточка
  await sTim.client.from('teacher_students').delete().eq('teacher_id', A.id).eq('student_id', sTim.id)
  const left = await cardOf(A, c1.data)
  check('ученик отвязался — карточка осталась без приложения', left?.in_app === false && left?.user_id === null && left?.note === tim0.note)
  await setStatus(A, c1.data, 'archived')
  const back = await join(sTim, gcode)
  const tim2 = await cardOf(A, c1.data)
  check('вернулся по общему коду — та же карточка, из архива — «занимается»',
    !back.error && tim2?.in_app === true && tim2?.status === 'active' && (await cards(A)).length === 2, code(back))

  // ── 3. места ────────────────────────────────────────────────────────────────
  // T: Mini (5 мест), четверо «занимается» по дате + пробный — самый старый
  const T = await teacher('t', { plan: 'teacher_mini' })
  const s = []
  for (let i = 0; i < 6; i++) s.push(await makeUser(`s${i}`))
  for (let i = 0; i < 5; i++) await linkAt(T.id, s[i].id, 30 - i)
  const trialCard = (await byUser(T, s[0].id)).id
  check('связь без карточки получила «занимается»', (await byUser(T, s[0].id))?.status === 'active')
  const st0 = await setStatus(T, trialCard, 'trial')
  check('пробный в приложении места не держит и тарифом не покрыт',
    !st0.error && (await byUser(T, s[0].id))?.holds_seat === false && (await cover(s[0].id)) === null && (await plan(T)).seats_used === 4, code(st0))
  await setStatus(T, (await byUser(T, s[1].id)).id, 'paused')
  check('пауза держит место', (await byUser(T, s[1].id))?.holds_seat === true && (await cover(s[1].id)) === T.id)

  // занять пятое место через код карточки «занимается»
  const c5 = await create(T, 'Пятый', 'active')
  const j5 = await join(s[5], (await invite(T, c5.data)).data)
  check('код карточки «занимается» при свободном месте — пускает, место занято', !j5.error && (await plan(T)).seats_used === 5, code(j5))
  // места полны: общий код — отказ, код пробной карточки — пускает
  const sLate = await makeUser('late')
  const tcode = (await T.client.rpc('ensure_invite_code')).data
  check('места полны: общий код — отказ RECALL_SEATS_FULL', /RECALL_SEATS_FULL/.test(code(await join(sLate, tcode))))
  const cTrial = await create(T, 'Пробник', 'trial')
  const jT = await join(sLate, (await invite(T, cTrial.data)).data)
  const lateCard = await cardOf(T, cTrial.data)
  check('места полны: код пробной карточки пускает, место не занято',
    !jT.error && lateCard?.in_app === true && lateCard?.holds_seat === false && (await plan(T)).seats_used === 5, code(jT))

  // пробный (самая старая привязка) → «занимается» при полных местах: никого не вытеснил
  const coveredBefore = []
  for (const x of [s[1], s[2], s[3], s[4], s[5]]) coveredBefore.push(await cover(x.id))
  const act = await setStatus(T, trialCard, 'active')
  const coveredAfter = []
  for (const x of [s[1], s[2], s[3], s[4], s[5]]) coveredAfter.push(await cover(x.id))
  check('пробный → «занимается» при полных местах: покрытые остались покрыты',
    !act.error && coveredBefore.every((c) => c === T.id) && coveredAfter.every((c) => c === T.id), code(act))
  check('…а перешедший — «вне мест тарифа», без покрытия',
    (await byUser(T, s[0].id))?.holds_seat === false && (await cover(s[0].id)) === null)

  // архив отдаёт место; вернуть — снова претендует
  const arch = await setStatus(T, (await byUser(T, s[2].id)).id, 'archived')
  check('архив: место освобождено, ученик без покрытия, связь и карточка на месте',
    !arch.error && (await cover(s[2].id)) === null && (await byUser(T, s[2].id))?.in_app === true && (await byUser(T, s[2].id))?.status === 'archived')
  check('ручной выбор: «дать место» пробному и архиву нельзя', /RECALL_CARD_NO_SEAT/.test(code(await T.client.rpc('set_student_seat', { p_student: s[2].id, p_on: true }))))
  const give = await T.client.rpc('set_student_seat', { p_student: s[0].id, p_on: true })
  check('освободившееся место можно отдать руками', !give.error && (await cover(s[0].id)) === T.id && (await plan(T)).seats_used === 5, code(give))

  // без ручного выбора: архив отдаёт место следующему по дате
  const U = await teacher('u', { plan: 'teacher_mini' })
  const u = []
  for (let i = 0; i < 6; i++) u.push(await makeUser(`u${i}`))
  for (let i = 0; i < 6; i++) await linkAt(U.id, u[i].id, 30 - i)
  check('шестой при пяти местах — вне мест', (await cover(u[5].id)) === null && (await cover(u[4].id)) === U.id)
  await setStatus(U, (await byUser(U, u[0].id)).id, 'archived')
  check('первого в архив — место перешло к шестому', (await cover(u[0].id)) === null && (await cover(u[5].id)) === U.id)

  // ── 4. чужие карточки ─────────────────────────────────────────────────────────
  const B = await teacher('b', { plan: 'teacher_mini' })
  await create(B, 'Ученик Б', 'trial')
  const bList = await cards(B)
  check('второй учитель видит только свои карточки', bList.length === 1 && bList[0].name === 'Ученик Б')
  const direct = await B.client.from('student_cards').select('id')
  check('таблица карточек напрямую закрыта', !!direct.error || (direct.data ?? []).length === 0, code(direct))
  check('чужую карточку не изменить', /RECALL_CARD_NOT_FOUND/.test(code(await B.client.rpc('update_student_card', { p_card: c1.data, p_name: 'Взлом' }))))
  check('чужой карточке не сменить статус', /RECALL_CARD_NOT_FOUND/.test(code(await setStatus(B, c1.data, 'archived'))))
  check('чужой карточке не выдать код', /RECALL_CARD_NOT_FOUND/.test(code(await invite(B, c1.data))))
  check('ученик чужие карточки не видит', (await cards(sGen)).length === 0)
  const ins = await B.client.from('student_cards').insert({ teacher_id: B.id, name: 'Мимо RPC' }).select('id')
  check('мимо RPC карточку не вставить', !!ins.error, code(ins))
  check('пустое имя — отказ', /RECALL_CARD_NAME/.test(code(await create(B, '   ', 'active'))))
  check('при создании — только «пробный» или «занимается»', /RECALL_BAD_STATUS/.test(code(await create(B, 'Икс', 'archived'))))

  // ── 5. без тарифа после пробного ──────────────────────────────────────────────
  const N = await teacher('n')
  const nCard = await create(N, 'Пока можно', 'trial') // пробный идёт
  await sql(`update public.profiles set trial_until = now() - interval '1 day' where id = '${N.id}'`)
  check('без тарифа: создать — RECALL_PLAN_REQUIRED', /RECALL_PLAN_REQUIRED/.test(code(await create(N, 'Новый', 'trial'))))
  check('без тарифа: изменить — RECALL_PLAN_REQUIRED', /RECALL_PLAN_REQUIRED/.test(code(await N.client.rpc('update_student_card', { p_card: nCard.data, p_name: 'Икс' }))))
  check('без тарифа: сменить статус — RECALL_PLAN_REQUIRED', /RECALL_PLAN_REQUIRED/.test(code(await setStatus(N, nCard.data, 'archived'))))
  check('без тарифа: карточки видны', (await cards(N)).length === 1)
  const nInv = await invite(N, nCard.data)
  const sN = await makeUser('sn')
  const jN = await join(sN, nInv.data)
  check('без тарифа: пригласить и привязаться можно', !nInv.error && !jN.error && (await cardOf(N, nCard.data))?.in_app === true, `${code(nInv)} / ${code(jN)}`)

  // ── 6. служебное и коды ───────────────────────────────────────────────────────
  for (const [fn, args] of [
    ['holds_seat', { p_teacher: A.id, p_student: sGen.id }],
    ['seat_links', { p_teacher: A.id }],
    ['covering_teacher', { p_student: sGen.id }],
    ['pin_default_seats', { p_teacher: A.id }],
    ['lock_teacher_seats', { p_teacher: A.id }],
    ['new_invite_code', {}],
  ]) {
    check(`служебная ${fn} закрыта для вошедшего`, !!(await B.client.rpc(fn, args)).error)
  }
  const own = await create(A, 'Сам себе', 'trial')
  check('свой код карточки — «к себе нельзя»', /собственный код/.test(code(await join(A, (await invite(A, own.data)).data))))
  check('ученику, который не учитель, кодов карточек не выдают', /RECALL_NOT_TEACHER/.test(code(await invite(sGen, own.data))))
  const [{ clash }] = await sql(`select count(*)::int as clash from public.student_cards c join public.profiles p on p.invite_code = c.invite_code`)
  check('коды учителей и карточек не совпадают', clash === 0)
}

async function main() {
  try {
    await run()
  } catch (e) {
    check('проверка дошла до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
  } finally {
    for (const m of made) await admin.auth.admin.deleteUser(m.id).catch(() => {})
    await admin.from('allowed_emails').delete().in('email', made.map((m) => m.email))
    console.log('Временные аккаунты удалены.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

await main()
