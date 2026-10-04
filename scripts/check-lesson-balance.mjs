/**
 * Учёт уроков и «остался 1» на тестовой базе (PLAN.md Ф2.8; миграция
 * 0010_lesson_balance.sql; журнал п.29, 67):
 *
 *   1. 8 оплачено → после 7 списаний ровно одно уведомление учителю
 *      («остался 1»), восьмое списание — ни одного, новая оплата открывает
 *      новый цикл — снова одно;
 *   2. скачок через 1 (будильник списал два урока разом, 2 → 0) — одно
 *      уведомление, «осталось 0»; исправление оплаты минусом до 1 — одно;
 *   3. без отмеченных оплат и без тарифа правило молчит;
 *   4. ученику Recall об оплате сам не пишет: у ученика нет ни одного
 *      уведомления, пока учитель сам не нажал «Напомнить → В приложении»;
 *      сообщение — только своему ученику в приложении, не пустое, до 10 в день;
 *   5. дата оплаты: по умолчанию сегодня, в будущем — отказ; история карточки:
 *      оплаты с датой и уроки, страницами, чужому — отказ;
 *   6. В23: аккаунт учителя с отмеченными оплатами удаляется.
 * Краснеет, если правило не срабатывает (триггер снят) — проверено 04.10.2026.
 *
 * Запуск: node scripts/check-lesson-balance.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и уроки — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASSWORD = 'BalanceCheck!2026'
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data
}
const code = (r) => r.error?.message ?? 'ok'
const made = []

async function makeUser(tag) {
  const email = `balance-check-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'check-lesson-balance (временный)' })
  for (const u of await sql(`select id from auth.users where lower(email) = '${email}'`)) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `Проверка ${tag}` } })
  if (error) throw new Error(error.message)
  made.push(data.user.id)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  must(await client.auth.signInWithPassword({ email, password: PASSWORD }), `вход ${tag}`)
  return { id: data.user.id, client }
}
async function teacher(tag) {
  const u = await makeUser(tag)
  must(await u.client.rpc('become_teacher'), 'режим преподавателя')
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '20 days' where id = '${u.id}'`)
  return u
}

const notes = (uid, kind) =>
  sql(`select kind, data, dedupe_key from public.notifications where user_id = '${uid}'${kind ? ` and kind = '${kind}'` : ''} order by created_at`)

try {
  const [{ now }] = await sql(`select now() as now`)
  const NOW = Date.parse(now)
  const ago = (h) => new Date(NOW - h * 3600_000).toISOString()

  const t = await teacher('a')
  const st = await makeUser('student')
  // ученик в приложении: связь создаёт карточку «занимается» (0008)
  await admin.from('teacher_students').insert({ teacher_id: t.id, student_id: st.id })
  const cards = must(await t.client.rpc('get_my_student_cards'), 'карточки')
  const aCard = cards.find((c) => c.user_id === st.id).id
  const card = async (name) => must(await t.client.rpc('create_student_card', { p_name: name, p_status: 'active' }), name)
  /** n прошедших разовых уроков карточки, по часу, начиная first часов назад. */
  const pastLessons = async (cardId, n, first) => {
    const ids = []
    for (let i = 0; i < n; i++) {
      ids.push(must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: ago(first - i), p_minutes: 30, p_cards: [cardId] }), 'урок'))
    }
    return ids
  }
  const present = (lesson, cardId) => t.client.rpc('mark_lesson_participant', { p_lesson: lesson, p_card: cardId, p_outcome: 'present' })
  const low = async (cardId) => (await notes(t.id, 'lessons_low')).filter((n) => n.data.card === cardId)

  // ── 1. 8 оплачено → 7 списаний → одно; восьмое — ни одного; новая оплата — новый цикл ──
  must(await t.client.rpc('add_paid_lessons', { p_card: aCard, p_count: 8 }), '+8')
  const aLessons = await pastLessons(aCard, 12, 40)
  for (let i = 0; i < 6; i++) must(await present(aLessons[i], aCard), 'отметка')
  check('после 6 списаний (осталось 2) — уведомлений нет', (await low(aCard)).length === 0)
  must(await present(aLessons[6], aCard), 'отметка 7')
  let a = await low(aCard)
  check('после 7 списаний (остался 1) — ровно одно уведомление', a.length === 1 && a[0].data.left === 1, JSON.stringify(a))
  must(await present(aLessons[7], aCard), 'отметка 8')
  check('восьмое списание (осталось 0) — нового нет', (await low(aCard)).length === 1)
  must(await t.client.rpc('add_paid_lessons', { p_card: aCard, p_count: 4 }), '+4')
  for (let i = 8; i < 10; i++) must(await present(aLessons[i], aCard), 'отметка')
  check('новая оплата (+4): пока осталось 2 — нового нет', (await low(aCard)).length === 1)
  must(await present(aLessons[10], aCard), 'отметка 11')
  a = await low(aCard)
  check('новый цикл: остался 1 — второе уведомление, ключ другой', a.length === 2 && a[0].dedupe_key !== a[1].dedupe_key)
  check('в уведомлении — имя ученика и «в приложении»', a[1].data.name === 'Проверка student' && a[1].data.in_app === true, JSON.stringify(a[1].data))

  // ── 2. скачок через 1 и исправление минусом ─────────────────────────────────────
  const b = await card('Скачок')
  must(await t.client.rpc('add_paid_lessons', { p_card: b, p_count: 2 }), '+2')
  await pastLessons(b, 2, 30)
  await sql(`select public.schedule_tick(now())`)
  const bLow = await low(b)
  // будильник списывает урок за уроком — остаток проходит через 1
  check('будильник списал два урока за проход (2 → 0) — одно уведомление', bLow.length === 1 && bLow[0].data.left <= 1, JSON.stringify(bLow))
  const f = await card('Скачок минусом')
  must(await t.client.rpc('add_paid_lessons', { p_card: f, p_count: 3 }), '+3')
  must(await t.client.rpc('add_paid_lessons', { p_card: f, p_count: -3 }), '−3')
  const fLow = await low(f)
  check('исправление 3 → 0 (через 1 не прошёл) — одно уведомление, «осталось 0»', fLow.length === 1 && fLow[0].data.left === 0, JSON.stringify(fLow))
  const c = await card('Исправление')
  must(await t.client.rpc('add_paid_lessons', { p_card: c, p_count: 3 }), '+3')
  const [cl] = await pastLessons(c, 1, 20)
  must(await present(cl, c), 'отметка')
  check('осталось 2 — тихо', (await low(c)).length === 0)
  must(await t.client.rpc('add_paid_lessons', { p_card: c, p_count: -1 }), '−1')
  check('исправление минусом до 1 — одно уведомление', (await low(c)).length === 1)
  must(await t.client.rpc('add_paid_lessons', { p_card: c, p_count: -1 }), '−1')
  check('ещё минус — тот же цикл, нового нет', (await low(c)).length === 1)

  // ── 3. без оплат и без тарифа — молчит ──────────────────────────────────────────
  const d = await card('Без учёта')
  await pastLessons(d, 3, 15)
  await sql(`select public.schedule_tick(now())`)
  check('оплат не отмечено (учёт не ведётся) — ни одного уведомления', (await low(d)).length === 0)
  const e = await card('Без тарифа')
  must(await t.client.rpc('add_paid_lessons', { p_card: e, p_count: 1 }), '+1')
  await pastLessons(e, 1, 10)
  await sql(`update public.profiles set plan_expires_at = now() - interval '1 hour' where id = '${t.id}'`)
  await sql(`update public.teacher_signups set created_at = now() - interval '25 days' where user_id = '${t.id}'`)
  await sql(`select public.recompute_teacher_trial('${t.id}')`)
  await sql(`select public.schedule_tick(now())`)
  const [{ r }] = await sql(`select public.notify_lessons_low('${e}') as r`)
  check('без тарифа: будильник не списал, правило молчит', (await low(e)).length === 0 && r === false)
  await sql(`update public.profiles set plan_expires_at = now() + interval '20 days' where id = '${t.id}'`)

  // ── 4. ученику — ничего автоматически; «В приложении» — только по нажатию ─────────
  check('ученику Recall сам об оплате не пишет: у ученика 0 уведомлений', (await notes(st.id)).length === 0, JSON.stringify(await notes(st.id)))
  const kinds = await sql(`select distinct kind from public.notifications where user_id = '${st.id}'`)
  check('и никаких видов уведомлений ученику', kinds.length === 0)
  const msg = await t.client.rpc('send_card_message', { p_card: aCard, p_text: '  Остался один урок — пришли оплату, пожалуйста.  ' })
  const stNotes = await notes(st.id)
  check('«В приложении» → ученику одно сообщение от учителя', !msg.error && stNotes.length === 1 && stNotes[0].kind === 'teacher_message' && stNotes[0].data.text === 'Остался один урок — пришли оплату, пожалуйста.', code(msg))
  check('без приложения — отказ', code(await t.client.rpc('send_card_message', { p_card: b, p_text: 'привет' })) === 'RECALL_NOT_IN_APP')
  check('пустое — отказ', code(await t.client.rpc('send_card_message', { p_card: aCard, p_text: '   ' })) === 'RECALL_BAD_MESSAGE')
  const other = await teacher('b')
  check('чужому ученику — отказ', code(await other.client.rpc('send_card_message', { p_card: aCard, p_text: 'привет' })) === 'RECALL_CARD_NOT_FOUND')
  for (let i = 0; i < 9; i++) await t.client.rpc('send_card_message', { p_card: aCard, p_text: `сообщение ${i}` })
  check('одиннадцатое за день — отказ (не рассылка)', code(await t.client.rpc('send_card_message', { p_card: aCard, p_text: 'ещё' })) === 'RECALL_MESSAGE_LIMIT')

  // ── 5. дата оплаты и история ──────────────────────────────────────────────────────
  const [{ today, yesterday, tomorrow }] = await sql(
    `select (now() at time zone 'Asia/Almaty')::date::text as today, ((now() at time zone 'Asia/Almaty')::date - 1)::text as yesterday, ((now() at time zone 'Asia/Almaty')::date + 1)::text as tomorrow`,
  )
  must(await t.client.rpc('add_paid_lessons', { p_card: c, p_count: 5, p_paid_on: yesterday }), 'вчера')
  check('оплата в будущем — отказ', code(await t.client.rpc('add_paid_lessons', { p_card: c, p_count: 1, p_paid_on: tomorrow })) === 'RECALL_BAD_PAID_ON')
  const hist = must(await t.client.rpc('get_card_history', { p_card: c }), 'история')
  const pays = hist.filter((h) => h.item === 'payment')
  check('история: оплаты с датами (сегодня и вчера), уроки — со списанием', pays.some((p) => p.paid_on === yesterday && p.n === 5) && pays.some((p) => p.paid_on === today && p.n === 3) && hist.some((h) => h.item === 'lesson' && h.charge === 'charged'), JSON.stringify(hist.map((h) => [h.item, h.paid_on, h.n, h.charge])))
  check('история — новые сверху', hist.every((h, i) => i === 0 || hist[i - 1].at >= h.at))
  const page1 = must(await t.client.rpc('get_card_history', { p_card: aCard, p_limit: 5 }), 'страница 1')
  const page2 = must(await t.client.rpc('get_card_history', { p_card: aCard, p_limit: 5, p_before: page1[4].at }), 'страница 2')
  check('история страницами: вторая — раньше первой и без повторов', page1.length === 5 && page2.length > 0 && page2.every((h) => h.at < page1[4].at))
  check('чужому учителю история — отказ', code(await other.client.rpc('get_card_history', { p_card: c })) === 'RECALL_CARD_NOT_FOUND')

  // исправить отменённый урок задним числом (t7-2): поздняя отмена ↔ не списывать
  const g = await card('Отмена')
  must(await t.client.rpc('add_paid_lessons', { p_card: g, p_count: 5 }), '+5')
  const [gl, gl2] = await pastLessons(g, 2, 8)
  must(await t.client.rpc('cancel_lesson', { p_lesson: gl, p_charge: true }), 'поздняя отмена')
  const bal = async (cardId) => must(await t.client.rpc('get_lesson_balances'), 'остатки').find((x) => x.card_id === cardId).balance
  check('поздняя отмена списала: остаток 4', (await bal(g)) === 4)
  must(await t.client.rpc('set_cancel_charge', { p_lesson: gl, p_card: g, p_charge: false }), 'не списывать')
  check('«не списывать» задним числом: остаток 5, урок по-прежнему отменён', (await bal(g)) === 5)
  must(await t.client.rpc('set_cancel_charge', { p_lesson: gl, p_card: g, p_charge: true }), 'снова списать')
  check('и обратно: остаток 4', (await bal(g)) === 4)
  check('у неотменённого урока так нельзя', code(await t.client.rpc('set_cancel_charge', { p_lesson: gl2, p_card: g, p_charge: false })) === 'RECALL_NOT_CANCELLED')
  check('чужому учителю — отказ', code(await other.client.rpc('set_cancel_charge', { p_lesson: gl, p_card: g, p_charge: false })) === 'RECALL_LESSON_NOT_FOUND')

  // ── 6. В23: аккаунт с отмеченными оплатами удаляется ─────────────────────────────
  const del = await admin.auth.admin.deleteUser(t.id)
  check('В23: аккаунт учителя с оплатами удаляется', !del.error, del.error?.message)
  if (!del.error) made.splice(made.indexOf(t.id), 1)
  const [{ left }] = await sql(`select count(*)::int as left from public.paid_lessons where teacher_id = '${t.id}'`)
  check('его журнал оплат ушёл вместе с карточками', left === 0)
} catch (e) {
  check('проверка дошла до конца', false, e instanceof Error ? e.message : String(e))
} finally {
  for (const id of made) await deleteTestUser(admin, sql, id).catch((e) => console.log(`  ⚠ ${e.message}`))
  console.log('Временные аккаунты удалены.')
}

const passed = results.filter(Boolean).length
console.log(`\nИтог: ${passed}/${results.length}`)
process.exitCode = passed === results.length ? 0 : 1
