/**
 * Уведомления ученику об уроках и канал push на тестовой базе (PLAN.md Ф2.9;
 * миграция 0011_lesson_notifications.sql; журнал п.38, 42, 68):
 *
 *   1. подписки push: только свои, адрес — https и доменное имя, ключи по
 *      формату, устройство сменило аккаунт — подписка переходит, больше 10 —
 *      старые забываются; учитель видит только «включены ли» у своих учеников;
 *   2. «урок через час»: ровно одно на урок и время, повтор — ноль; перенесли —
 *      новое; выключил напоминания — ничего; отмечен заранее «не был» — ничего;
 *      без тарифа учителя — ничего (п.68); отменённому — ничего;
 *   3. перенос → одно уведомление; «Отменить → Вернуть» и перенос туда-обратно,
 *      пока не отправлено, — ничего; уже отправленное — отдельное «вернули»;
 *      исправление прошедшего — ничего; отмена серии — одно на всю серию;
 *      новое расписание серии — одно, с прежним временем; убранному из серии —
 *      «отменены»; смена одной ссылки — ничего;
 *   4. ученику без приложения — ничего; учителю — ни одного уведомления об уроках;
 *   5. доставка: подписки push в теле запроса только для видов об уроках;
 *      ответ сервера разбирается — мёртвые подписки удаляются, не дошедшее
 *      возвращается в очередь (до 3 попыток); сообщения об изменениях ждут
 *      минуту; через pg_net запрос уходит по-настоящему.
 *
 * Запуск: node scripts/check-lesson-notify.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'
import { deliverySecrets } from './_vault.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты, уроки и секреты доставки — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASSWORD = 'LessonNotify!2026'
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const made = []

async function makeUser(tag, name) {
  const email = `lesson-notify-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'check-lesson-notify (временный)' })
  for (const u of await sql(`select id from auth.users where lower(email) = '${email}'`)) await deleteTestUser(admin, sql, u.id)
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: name } })
  if (error) throw new Error(error.message)
  made.push(data.user.id)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  must(await client.auth.signInWithPassword({ email, password: PASSWORD }), `вход ${tag}`)
  return { id: data.user.id, client }
}
async function teacher(tag, name) {
  const u = await makeUser(tag, name)
  must(await u.client.rpc('become_teacher'), 'режим преподавателя')
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '20 days' where id = '${u.id}'`)
  return u
}

const b64url = (n) => randomBytes(n).toString('base64url')
const endpoint = () => `https://fcm.googleapis.com/fcm/send/check-${b64url(12)}:APA91b${b64url(40)}`
const sub = (ep = endpoint()) => ({ p_endpoint: ep, p_p256dh: b64url(65), p_auth: b64url(16) })

const LESSON_KINDS = ['lesson_soon', 'lesson_moved', 'lesson_cancelled', 'lesson_restored', 'lessons_rescheduled', 'lessons_cancelled']
const notes = (uid, kinds = LESSON_KINDS) =>
  sql(`select id, kind, data, dedupe_key, sent_at, attempts from public.notifications
        where user_id = '${uid}' and kind in (${kinds.map((k) => `'${k}'`).join(',')}) order by created_at`)
const about = (list, lesson) => list.filter((n) => n.data.lesson === lesson)
const soon = async (iso) => (await sql(`select public.notify_lessons_soon('${iso}'::timestamptz) as n`))[0].n

const FAKE = 900_000_000_000 + Math.floor(Math.random() * 1_000_000)
let vault = null

try {
  // свои секреты доставки на время прогона, прежние вернутся (_vault.mjs)
  vault = await deliverySecrets(sql)
  const [{ now }] = await sql(`select now() as now`)
  const startedAt = now
  const NOW = Date.parse(now)
  const at = (h) => new Date(NOW + h * 3600_000).toISOString()
  const minus = (iso, min) => new Date(Date.parse(iso) - min * 60_000).toISOString()

  const t = await teacher('t', 'Мадина Сейткали')
  const other = await teacher('o', 'Чужой учитель')
  const s1 = await makeUser('s1', 'Айгерим')
  const s2 = await makeUser('s2', 'Тимур')
  await admin.from('teacher_students').insert([{ teacher_id: t.id, student_id: s1.id }, { teacher_id: t.id, student_id: s2.id }])
  const cards = must(await t.client.rpc('get_my_student_cards'), 'карточки')
  const c1 = cards.find((c) => c.user_id === s1.id).id
  const c2 = cards.find((c) => c.user_id === s2.id).id
  const c0 = must(await t.client.rpc('create_student_card', { p_name: 'Без приложения', p_status: 'active' }), 'карточка без приложения')
  const lesson = async (startsAt, cardIds, kind = 'individual', extra = {}) =>
    must(await t.client.rpc('create_lesson', { p_kind: kind, p_starts_at: startsAt, p_minutes: 60, p_cards: cardIds, ...(kind === 'group' ? { p_title: 'Разговорный клуб' } : {}), ...extra }), 'урок')
  const move = (id, startsAt, cardIds = [c1], extra = {}) =>
    t.client.rpc('update_lesson', { p_lesson: id, p_kind: 'individual', p_starts_at: startsAt, p_minutes: 60, p_cards: cardIds, ...extra })

  // ── 1. подписки push ─────────────────────────────────────────────────────────────
  const ep1 = endpoint()
  must(await s1.client.rpc('save_push_subscription', sub(ep1)), 'подписка');
  const direct = await s1.client.from('push_subscriptions').select('endpoint')
  check('подписки клиенту не читаются напрямую', !!direct.error || (direct.data ?? []).length === 0, code(direct))
  const bad = await Promise.all([
    'http://fcm.googleapis.com/fcm/send/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://push.local/x',
    `https://fcm.googleapis.com/${'a'.repeat(1000)}`,
  ].map((e) => s1.client.rpc('save_push_subscription', sub(e))))
  check('адрес не https, IP, localhost, .local, длиннее 1000 — RECALL_BAD_PUSH', bad.every((r) => /RECALL_BAD_PUSH/.test(code(r))), bad.map(code).join(' | '))
  const badKeys = await s1.client.rpc('save_push_subscription', { p_endpoint: endpoint(), p_p256dh: 'abc', p_auth: b64url(16) })
  check('ключи не по формату — RECALL_BAD_PUSH', /RECALL_BAD_PUSH/.test(code(badKeys)))
  for (const e of ['https://updates.push.services.mozilla.com/wpush/v2/gAAAA', 'https://web.push.apple.com/QGx', 'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA'])
    must(await s2.client.rpc('save_push_subscription', sub(e)), `адрес ${e}`)
  check('адреса Mozilla, Apple, Microsoft принимаются', true)
  const shared = endpoint()
  must(await s1.client.rpc('save_push_subscription', sub(shared)), 'общий адрес s1')
  must(await s2.client.rpc('save_push_subscription', sub(shared)), 'общий адрес s2')
  const [owner] = await sql(`select user_id from public.push_subscriptions where endpoint = '${shared}'`)
  check('устройство сменило аккаунт — подписка у нового владельца', owner?.user_id === s2.id)
  must(await s1.client.rpc('delete_push_subscription', { p_endpoint: shared }), 'чужое удаление')
  const [still] = await sql(`select count(*)::int as n from public.push_subscriptions where endpoint = '${shared}'`)
  must(await s2.client.rpc('delete_push_subscription', { p_endpoint: shared }), 'своё удаление')
  const [gone] = await sql(`select count(*)::int as n from public.push_subscriptions where endpoint = '${shared}'`)
  check('чужую подписку не удалить, свою — да', still.n === 1 && gone.n === 0)
  await sql(`delete from public.push_subscriptions where user_id = '${s2.id}'`)
  for (let i = 0; i < 12; i++) must(await s2.client.rpc('save_push_subscription', sub()), 'много устройств')
  const [cap] = await sql(`select count(*)::int as n from public.push_subscriptions where user_id = '${s2.id}'`)
  check('больше 10 устройств — старые забываются', cap.n === 10, String(cap.n))
  await sql(`delete from public.push_subscriptions where user_id = '${s2.id}'`)
  const reach = must(await t.client.rpc('get_students_push'), 'push учеников')
  check('учитель видит: у Айгерим уведомления включены, у Тимура — нет, карточки без приложения в списке нет',
    reach.find((r) => r.card_id === c1)?.push === true && reach.find((r) => r.card_id === c2)?.push === false && !reach.some((r) => r.card_id === c0),
    JSON.stringify(reach))
  const foreign = must(await other.client.rpc('get_students_push'), 'чужой')
  const asStudent = must(await s1.client.rpc('get_students_push'), 'ученик')
  check('чужой учитель и ученик — пустой список', foreign.length === 0 && asStudent.length === 0)
  const closed = await Promise.all([
    s1.client.rpc('notify_lessons_soon', { p_now: now }),
    s1.client.rpc('after_lessons_changed', { p_teacher: t.id, p_change: {} }),
    s1.client.rpc('dispatch_payload', { p_ids: [] }),
    s1.client.rpc('settle_dispatches'),
    s1.client.rpc('dispatch_notifications'),
  ])
  check('служебные функции вошедшему закрыты (5)', closed.every((r) => !!r.error), closed.map(code).join(' | '))

  // ── 2. «урок через час» ─────────────────────────────────────────────────────────────
  // уроки — дальше часа от настоящего «сейчас»: будильник тестовой базы их не тронет
  const L1 = await lesson(at(3), [c1])
  await soon(minus(at(3), 61))
  check('за 61 минуту — ещё рано', about(await notes(s1.id, ['lesson_soon']), L1).length === 0)
  await soon(minus(at(3), 50))
  let n1 = about(await notes(s1.id, ['lesson_soon']), L1)
  check('за 50 минут — ровно одно «урок через час»', n1.length === 1, JSON.stringify(n1))
  check('в нём время, имя преподавателя, ссылка на урок в приложении',
    n1[0]?.data.at && n1[0]?.data.teacher_name === 'Мадина Сейткали' && n1[0]?.data.href === `/lessons?lesson=${L1}` && n1[0]?.data.link === false, JSON.stringify(n1[0]?.data))
  await soon(minus(at(3), 45))
  await soon(minus(at(3), 10))
  check('следующие проходы будильника — ни одного нового', about(await notes(s1.id, ['lesson_soon']), L1).length === 1)
  must(await move(L1, at(4)), 'перенос L1')
  await soon(minus(at(4), 50))
  check('урок перенесли — за час до нового времени ещё одно', about(await notes(s1.id, ['lesson_soon']), L1).length === 2)

  const L2 = await lesson(at(6), [c2])
  must(await s2.client.rpc('set_lesson_reminders', { p_on: false }), 'выключить')
  await soon(minus(at(6), 50))
  check('выключил напоминания — ничего', about(await notes(s2.id, ['lesson_soon']), L2).length === 0)
  must(await s2.client.rpc('set_lesson_reminders', { p_on: true }), 'включить')
  await soon(minus(at(6), 40))
  check('включил обратно — приходит', about(await notes(s2.id, ['lesson_soon']), L2).length === 1)

  const L3 = await lesson(at(7), [c1])
  must(await t.client.rpc('mark_lesson_participant', { p_lesson: L3, p_card: c1, p_outcome: 'absent' }), 'не будет')
  await soon(minus(at(7), 50))
  check('учитель заранее отметил «не был» — ничего', about(await notes(s1.id, ['lesson_soon']), L3).length === 0)

  const G = await lesson(at(8), [c1, c2, c0], 'group')
  await soon(minus(at(8), 50))
  check('групповой: каждому ученику в приложении по одному', about(await notes(s1.id, ['lesson_soon']), G).length === 1 && about(await notes(s2.id, ['lesson_soon']), G).length === 1)

  const L4 = await lesson(at(9), [c1])
  await sql(`update public.profiles set plan_expires_at = now() - interval '1 hour' where id = '${t.id}'`)
  await sql(`update public.teacher_signups set created_at = now() - interval '25 days' where user_id = '${t.id}'`)
  await sql(`select public.recompute_teacher_trial('${t.id}')`)
  await soon(minus(at(9), 50))
  check('без тарифа учителя — ничего (журнал п.68)', about(await notes(s1.id, ['lesson_soon']), L4).length === 0)
  await sql(`update public.profiles set plan_expires_at = now() + interval '20 days' where id = '${t.id}'`)
  await soon(minus(at(9), 45))
  check('продлил — напоминания снова идут', about(await notes(s1.id, ['lesson_soon']), L4).length === 1)

  const L5 = await lesson(at(10), [c1])
  must(await t.client.rpc('cancel_lesson', { p_lesson: L5, p_charge: false }), 'отмена L5')
  await soon(minus(at(10), 50))
  check('отменённому — ничего', about(await notes(s1.id, ['lesson_soon']), L5).length === 0)

  // ── 3. перенос, отмена, возврат ────────────────────────────────────────────────────
  const CH = ['lesson_moved', 'lesson_cancelled', 'lesson_restored']
  const L6 = await lesson(at(26), [c1])
  must(await move(L6, at(27)), 'перенос')
  let m = about(await notes(s1.id, CH), L6)
  check('перенос → ровно одно «перенесён» со временем было → стало',
    m.length === 1 && m[0].kind === 'lesson_moved' && Date.parse(m[0].data.from) === Date.parse(at(26)) && Date.parse(m[0].data.to) === Date.parse(at(27)), JSON.stringify(m))
  must(await move(L6, at(27), [c1], { p_link: 'https://meet.google.com/abc-defg-hij' }), 'ссылка')
  m = about(await notes(s1.id, CH), L6)
  check('потом сменили ссылку — всё так же одно, время то же', m.length === 1 && Date.parse(m[0].data.from) === Date.parse(at(26)))
  must(await move(L6, at(26)), 'обратно')
  check('перенесли обратно, пока не отправлено, — ничего', about(await notes(s1.id, CH), L6).length === 0)

  const L7 = await lesson(at(30), [c1])
  must(await t.client.rpc('cancel_lesson', { p_lesson: L7, p_charge: false }), 'отмена')
  check('отмена → одно «отменён»', about(await notes(s1.id, CH), L7).map((x) => x.kind).join() === 'lesson_cancelled')
  must(await t.client.rpc('restore_lesson', { p_lesson: L7 }), 'вернуть')
  check('«Вернуть», пока не отправлено, — ничего', about(await notes(s1.id, CH), L7).length === 0)

  const L8 = await lesson(at(32), [c1])
  must(await t.client.rpc('cancel_lesson', { p_lesson: L8, p_charge: false }), 'отмена L8')
  await sql(`update public.notifications set sent_at = now() where user_id = '${s1.id}' and data->>'lesson' = '${L8}'`)
  must(await t.client.rpc('restore_lesson', { p_lesson: L8 }), 'вернуть L8')
  check('уже отправленное «отменён» + «Вернуть» → «вернули» отдельно', about(await notes(s1.id, CH), L8).map((x) => x.kind).join() === 'lesson_cancelled,lesson_restored')

  const L9 = await lesson(at(34), [c1])
  must(await move(L9, at(35)), 'перенос L9')
  must(await t.client.rpc('cancel_lesson', { p_lesson: L9, p_charge: false }), 'отмена L9')
  m = about(await notes(s1.id, CH), L9)
  check('перенёс и тут же отменил — одно «отменён» на прежнее время', m.length === 1 && m[0].kind === 'lesson_cancelled' && Date.parse(m[0].data.at) === Date.parse(at(34)), JSON.stringify(m))

  const L10 = await lesson(at(-5), [c1])
  must(await t.client.rpc('cancel_lesson', { p_lesson: L10, p_charge: false }), 'отмена прошедшего')
  check('отмена прошедшего урока (исправление) — ничего', about(await notes(s1.id, CH), L10).length === 0)

  const G2 = await lesson(at(36), [c1, c2, c0], 'group')
  must(await t.client.rpc('cancel_lesson', { p_lesson: G2, p_charge: false }), 'отмена группы')
  check('отмена группового — каждому в приложении по одному', about(await notes(s1.id, CH), G2).length === 1 && about(await notes(s2.id, CH), G2).length === 1)

  // серия: дни — завтра и послезавтра по Алматы, 12 недель
  const [{ d1, w1, w2 }] = await sql(`select ((now() at time zone 'Asia/Almaty')::date + 1)::text as d1,
    extract(isodow from (now() at time zone 'Asia/Almaty')::date + 1)::int as w1,
    extract(isodow from (now() at time zone 'Asia/Almaty')::date + 2)::int as w2`)
  const series = async (cardIds, kind = 'individual', time = '19:00', extra = {}) =>
    must(await t.client.rpc('create_series', { p_kind: kind, p_weekdays: [w1, w2], p_time: time, p_minutes: 60, p_every_weeks: 1, p_starts_on: d1, p_cards: cardIds, ...(kind === 'group' ? { p_title: 'Клуб' } : {}), ...extra }), 'серия')
  const seriesLessons = (id) => sql(`select id from public.lessons where series_id = '${id}' order by starts_at`)
  const before = (await notes(s1.id)).length
  const S1 = await series([c1])
  const sl = await seriesLessons(S1)
  must(await t.client.rpc('cancel_series_from', { p_lesson: sl[0].id, p_charge: false }), 'отмена серии')
  const sc = (await notes(s1.id)).slice(before)
  check(`отмена серии (в ней ${sl.length}) — ровно одно сообщение «уроки отменены»`,
    sc.length === 1 && sc[0].kind === 'lessons_cancelled' && sc[0].data.since === d1 && sc[0].data.weekdays.join() === [w1, w2].sort((a, b) => a - b).join(), JSON.stringify(sc))

  const S2 = await series([c1, c2], 'group', '18:00')
  const s2l = await seriesLessons(S2)
  const k1 = (await notes(s1.id)).length
  const k2 = (await notes(s2.id)).length
  const S2b = must(await t.client.rpc('update_series_from', { p_lesson: s2l[2].id, p_kind: 'group', p_weekdays: [w1, w2], p_time: '19:00', p_minutes: 60, p_every_weeks: 1, p_cards: [c1], p_title: 'Клуб' }), 'новое расписание')
  const r1 = (await notes(s1.id)).slice(k1)
  const r2 = (await notes(s2.id)).slice(k2)
  check('новое время серии — одно сообщение, с прежним временем',
    r1.length === 1 && r1[0].kind === 'lessons_rescheduled' && r1[0].data.time === '19:00' && r1[0].data.old?.time === '18:00' && r1[0].data.series === S2b, JSON.stringify(r1))
  check('убранному из серии — одно «уроки отменены»', r2.length === 1 && r2[0].kind === 'lessons_cancelled', JSON.stringify(r2))

  const S3 = await series([c1], 'individual', '17:00')
  const s3l = await seriesLessons(S3)
  const k3 = (await notes(s1.id)).length
  must(await t.client.rpc('update_series_from', { p_lesson: s3l[1].id, p_kind: 'individual', p_weekdays: [w1, w2], p_time: '17:00', p_minutes: 60, p_every_weeks: 1, p_cards: [c1], p_link: 'https://meet.google.com/xyz-abcd-efg' }), 'ссылка серии')
  check('у серии сменили только ссылку — ничего', (await notes(s1.id)).length === k3)

  // ── 4. без приложения и учитель ──────────────────────────────────────────────────────
  check('учителю — ни одного уведомления об уроках', (await notes(t.id)).length === 0)
  const [{ n: noApp }] = await sql(`select count(*)::int as n from public.notifications where data->>'lesson' in ('${G}', '${G2}') and user_id not in ('${s1.id}', '${s2.id}')`)
  check('по групповым урокам — никому, кроме двух учеников в приложении', noApp === 0)
  const [{ n: hookErrors }] = await sql(`select count(*)::int as n from public.events where name = 'client_error' and props->>'where' = 'база · уведомления об уроках' and created_at >= '${startedAt}'`)
  check('крючок ни разу не упал', hookErrors === 0, String(hookErrors))

  // ── 5. доставка ────────────────────────────────────────────────────────────────────
  const manual = (await sql(`select public.notify('${s1.id}', 'manual', '{}'::jsonb, 'check-notify:${Date.now()}') as ok`))[0]
  const [mrow] = await sql(`select id from public.notifications where user_id = '${s1.id}' and kind = 'manual' order by created_at desc limit 1`)
  const moved = about(await notes(s1.id, CH), L8)[1]
  const s2soon = about(await notes(s2.id, ['lesson_soon']), G)[0]
  const [{ p }] = await sql(`select public.dispatch_payload(array['${moved.id}', '${mrow.id}', '${s2soon.id}']::uuid[]) as p`)
  const byId = Object.fromEntries(p.notifications.map((x) => [x.id, x]))
  check('в теле запроса: урок → подписки ученика (ключи на месте)',
    byId[moved.id]?.push.length === 1 && byId[moved.id].push[0].endpoint === ep1 && byId[moved.id].push[0].p256dh.length >= 86, JSON.stringify(byId[moved.id]?.push))
  check('не об уроке — без push; ученик без подписок — пусто', manual.ok && byId[mrow.id]?.push.length === 0 && byId[s2soon.id]?.push.length === 0)

  // разбор ответов: настоящие ответы pg_net подменяем строками с далёкими номерами
  const ids3 = (await notes(s1.id, CH)).slice(0, 3).map((x) => x.id)
  const deadEp = endpoint()
  must(await s1.client.rpc('save_push_subscription', sub(deadEp)), 'мёртвая подписка')
  const resp = async (id, status, content, ids, age = '0 minutes', answered = true) => {
    await sql(`update public.notifications set sent_at = now(), attempts = 1 where id = any(array[${ids.map((x) => `'${x}'`).join(',')}]::uuid[]);
      insert into public.notification_dispatches (request_id, ids, created_at) values (${id}, array[${ids.map((x) => `'${x}'`).join(',')}]::uuid[], now() - interval '${age}');
      ${answered ? `insert into net._http_response (id, status_code, content, created) values (${id}, ${status}, '${content.replace(/'/g, "''")}', now());` : ''}`)
  }
  const sentOf = async (ids) => sql(`select id, sent_at is not null as sent, attempts from public.notifications where id = any(array[${ids.map((x) => `'${x}'`).join(',')}]::uuid[]) order by id`)
  await resp(FAKE, 200, JSON.stringify({ ok: true, gone: [deadEp], retry: [ids3[0], 'мусор'] }), ids3)
  await sql(`select public.settle_dispatches()`)
  let st = Object.fromEntries((await sentOf(ids3)).map((x) => [x.id, x.sent]))
  const [{ n: deadLeft }] = await sql(`select count(*)::int as n from public.push_subscriptions where endpoint = '${deadEp}'`)
  check('ответ 200: мёртвая подписка удалена, «retry» — снова в очереди, остальное отправлено', deadLeft === 0 && st[ids3[0]] === false && st[ids3[1]] === true && st[ids3[2]] === true, JSON.stringify(st))
  await resp(FAKE + 1, 500, 'oops', ids3)
  await sql(`update public.notifications set attempts = 3 where id = '${ids3[2]}'`)
  await sql(`select public.settle_dispatches()`)
  st = Object.fromEntries((await sentOf(ids3)).map((x) => [x.id, x.sent]))
  check('ответ 500: вся отправка — снова в очереди, кроме исчерпавших 3 попытки', st[ids3[0]] === false && st[ids3[1]] === false && st[ids3[2]] === true, JSON.stringify(st))
  await resp(FAKE + 2, 200, '<html>не JSON</html>', [ids3[0]])
  await resp(FAKE + 3, 0, '', [ids3[1]], '20 minutes', false)
  await resp(FAKE + 4, 0, '', [ids3[2]], '0 minutes', false)
  await sql(`update public.notifications set attempts = 1 where id = '${ids3[2]}'`)
  await sql(`select public.settle_dispatches()`)
  st = Object.fromEntries((await sentOf(ids3)).map((x) => [x.id, x.sent]))
  const [{ n: waiting }] = await sql(`select count(*)::int as n from public.notification_dispatches where request_id = ${FAKE + 4}`)
  check('ответ не JSON и ответа нет 20 минут — в очередь; свежая отправка без ответа — ждёт', st[ids3[0]] === false && st[ids3[1]] === false && st[ids3[2]] === true && waiting === 1, JSON.stringify(st))
  await sql(`delete from public.notification_dispatches where request_id = ${FAKE + 4}`)

  // настоящая отправка: адрес — корень REST тестовой базы (ответит 401 → не дошло → в очередь)
  const fresh = await lesson(at(40), [c1])
  must(await move(fresh, at(41)), 'свежий перенос')
  const [freshNote] = about(await notes(s1.id, CH), fresh)
  await vault.set(`${env.VITE_SUPABASE_URL}/rest/v1/`, randomBytes(24).toString('hex'))
  await sql(`select public.dispatch_notifications()`)
  const [f1] = await sentOf([freshNote.id])
  check('сообщение об изменении моложе минуты не отправляется («Вернуть»)', f1.sent === false)
  await sql(`update public.notifications set created_at = now() - interval '2 minutes' where id = '${freshNote.id}'`)
  await sql(`select public.dispatch_notifications()`)
  const [f2] = await sentOf([freshNote.id])
  const [disp] = await sql(`select request_id from public.notification_dispatches where '${freshNote.id}' = any(ids)`)
  check('старше минуты — отправлено, попытка учтена, отправка записана', f2.sent === true && f2.attempts === 1 && !!disp, JSON.stringify({ f2, disp }))
  let answered = null
  for (let i = 0; i < 20 && !answered; i++) {
    await sleep(1000)
    answered = (await sql(`select status_code from net._http_response where id = ${disp?.request_id ?? 0}`))[0] ?? null
  }
  await sql(`select public.settle_dispatches()`)
  const [f3] = await sentOf([freshNote.id])
  check(`pg_net ответил (${answered?.status_code ?? 'нет'}) → не 200 → снова в очереди`, !!answered && answered.status_code !== 200 && f3.sent === false)
} catch (e) {
  check('проверка дошла до конца', false, String(e?.message ?? e).split('\n')[0])
} finally {
  await vault?.restore().catch((e) => console.log(`  ⚠ секреты: ${e.message}`))
  await sql(`delete from net._http_response where id between ${FAKE} and ${FAKE + 10};
             delete from public.notification_dispatches where request_id between ${FAKE} and ${FAKE + 10}`).catch(() => {})
  for (const id of made) await deleteTestUser(admin, sql, id).catch((e) => console.log(`  ⚠ ${e.message}`))
  await admin.from('allowed_emails').delete().like('email', 'lesson-notify-%@recall.test')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
