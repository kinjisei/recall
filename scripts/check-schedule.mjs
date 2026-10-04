/**
 * Расписание на живой ТЕСТОВОЙ базе (PLAN.md Ф2.6; журнал п.26–33, 39, 41, 43,
 * 65; миграция 0009_schedule.sql).
 *
 * Что доказывает — все условия «Готово, когда» пункта Ф2.6 и решения п.65:
 *   1. серия на 2 дня недели даёт верные уроки (даты, время по Алматы, состав;
 *      шаг 2 недели; без конца — на 12 недель); правило дней = копии клиента;
 *   2. «только этот»: перенос одного урока не рвёт серию (тот же день серии,
 *      второго урока на старом месте нет), отмена и возврат одного;
 *   3. «этот и все следующие»: до урока — как было, с него — новое время;
 *      отдельно перенесённый впереди — по новому расписанию, отменённый —
 *      остаётся отменённым; деление с первого урока не оставляет пустой серии;
 *   4. автосписание после конца; пробный (тип урока и статус карточки к началу
 *      урока) не списывается — правило самой базы; поздняя отмена списывается;
 *   5. исправление задним числом пересчитывает остаток; остаток = оплачено −
 *      списано (журнал только дописывается); ученику — без минуса;
 *   6. ученик видит только свои уроки, без других участников; отвязался —
 *      ничего; чужой учитель не видит и не меняет ничего;
 *   7. пауза и архив убирают будущие уроки ученика, возврат — возвращает;
 *   8. без тарифа запись отклоняется, автосписание стоит, после оплаты
 *      пропущенное задним числом не списывается, окно уроков не растёт;
 *   9. версия растёт при переносе, отмене, возврате, смене ссылки — и не
 *      растёт от отметок и будильника; служебные функции и таблицы закрыты;
 *      потолки строк одного учителя держат.
 *
 * Запуск: node scripts/check-schedule.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'
import { addDays, HORIZON_DAYS, isoWeekday, isSeriesSlot, seriesDays } from '../src/domains/schedule/model.ts'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты, уроки и двигает будильник — только тестовая база.')
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

const PASSWORD = 'ScheduleCheck!2026'
const made = []

async function makeUser(tag, name = `Проверка ${tag}`) {
  const email = `schedule-check-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'check-schedule (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: name } })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = data?.user?.id
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
  }
  made.push({ id, email })
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход ${email}: ${e2.message}`)
  return { id, client }
}

async function teacher(tag, { plan = null } = {}) {
  const u = await makeUser(tag)
  const r = await u.client.rpc('become_teacher')
  if (r.error) throw new Error(`become_teacher: ${r.error.message}`)
  if (plan) await sql(`update public.profiles set plan = '${plan}', plan_expires_at = now() + interval '20 days' where id = '${u.id}'`)
  return u
}

const code = (r) => r.error?.message ?? 'ok'
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data
}
const ms = (s) => Date.parse(s)
let NOW = 0 // время сервера, мс
let TODAY = '' // сегодня по Алматы на сервере
const at = (min) => new Date(NOW + min * 60_000).toISOString()
/** День и время по Алматы (UTC+5, без перехода на летнее) → мс. */
const almaty = (day, hhmm) => Date.parse(`${day}T${hhmm}:00+05:00`)

const card = async (u, name, status = 'active') => must(await u.client.rpc('create_student_card', { p_name: name, p_status: status }), `карточка ${name}`)
const setStatus = (u, c, s) => u.client.rpc('set_student_card_status', { p_card: c, p_status: s })
const series = (u, a) => u.client.rpc('create_series', { p_title: null, p_link: null, p_ends_on: null, ...a })
const lesson = (u, a) => u.client.rpc('create_lesson', { p_title: null, p_link: null, ...a })
const tick = (expr = 'now()') => sql(`select public.schedule_tick(${expr}) as r`).then((r) => r[0].r)

/** Уроки учителя (−2 … +98 дней) с участниками. */
async function schedule(u) {
  const data = must(await u.client.rpc('get_schedule', { p_from: at(-2 * 1440), p_to: at(98 * 1440) }), 'get_schedule')
  const m = new Map()
  for (const r of data) {
    if (!m.has(r.lesson_id)) m.set(r.lesson_id, { ...r, id: r.lesson_id, parts: [] })
    if (r.card_id) m.get(r.lesson_id).parts.push(r)
  }
  return [...m.values()]
}
const ofSeries = (ls, sid) => ls.filter((l) => l.series_id === sid).sort((a, b) => (a.series_date < b.series_date ? -1 : 1))
const byId = async (u, id) => (await schedule(u)).find((l) => l.id === id)
const part = (l, c) => l?.parts.find((p) => p.card_id === c)
/** Остаток по базе и «руками» из фактов — для сверки. */
async function balance(u, c) {
  const b = (must(await u.client.rpc('get_lesson_balances'), 'остатки')).find((x) => x.card_id === c)
  const [raw] = await sql(`select
      (select coalesce(sum(n), 0)::int from public.paid_lessons where card_id = '${c}') as paid,
      (select count(*)::int from public.lesson_participants where card_id = '${c}' and charge in ('charged', 'late_cancel')) as charged`)
  return { ...b, raw: raw.paid - raw.charged, rawOk: b.paid === raw.paid && b.charged === raw.charged && b.balance === raw.paid - raw.charged }
}

async function run() {
  const [srv] = await sql(`select now() as now, (now() at time zone 'Asia/Almaty')::date::text as today`)
  NOW = ms(srv.now)
  TODAY = srv.today

  // ── 1. правило дней: копия клиента = база ─────────────────────────────────────────
  const rules = [
    { weekdays: [2, 4], everyWeeks: 1, startsOn: '2026-10-08', endsOn: null },
    { weekdays: [1, 3], everyWeeks: 2, startsOn: '2026-10-05', endsOn: '2026-12-20' },
    { weekdays: [4, 6], everyWeeks: 2, startsOn: '2026-12-31', endsOn: null },
    { weekdays: [1, 2, 3, 4, 5, 6, 7], everyWeeks: 2, startsOn: '2027-02-27', endsOn: '2027-04-04' },
  ]
  let diff = 0
  let total = 0
  for (const r of rules) {
    const rows = await sql(`select d::date::text as day, public.series_slot('{${r.weekdays}}'::smallint[], ${r.everyWeeks}::smallint,
        '${r.startsOn}', ${r.endsOn ? `'${r.endsOn}'` : 'null'}, d::date) as s
        from generate_series('${addDays(r.startsOn, -10)}'::date, '${addDays(r.startsOn, 130)}'::date, interval '1 day') d`)
    total += rows.length
    diff += rows.filter((x) => x.s !== isSeriesSlot(r, x.day)).length
  }
  check('копия правила дней (isSeriesSlot) = series_slot', diff === 0 && total > 500, `дней ${total}, расхождений ${diff}`)

  // ── 1. серия на 2 дня недели ──────────────────────────────────────────────────────────
  const A = await teacher('a', { plan: 'teacher_mini' })
  const tim = await card(A, 'Тимур')
  const aig = await card(A, 'Айгерим')
  const dan = await card(A, 'Данияр', 'trial')
  let start = addDays(TODAY, 2)
  while (isoWeekday(start) !== 1) start = addDays(start, 1)
  const end = addDays(start, 27)
  const s1 = await series(A, { p_kind: 'individual', p_weekdays: [2, 4], p_time: '19:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: start, p_ends_on: end, p_cards: [tim] })
  check('серию можно создать', !s1.error, code(s1))
  let L = ofSeries(await schedule(A), s1.data)
  const want = [1, 3, 8, 10, 15, 17, 22, 24].map((n) => addDays(start, n))
  check('вт и чт на 4 недели — ровно 8 уроков на нужные даты', JSON.stringify(L.map((l) => l.series_date)) === JSON.stringify(want), L.map((l) => l.series_date).join(' '))
  check('копия клиента (seriesDays) даёт те же даты', JSON.stringify(seriesDays({ weekdays: [2, 4], everyWeeks: 1, startsOn: start, endsOn: end }, start, end)) === JSON.stringify(want))
  check('время — 19:00 по Алматы, час, индивидуальный, запланирован, версия 1',
    L.every((l) => ms(l.starts_at) === almaty(l.series_date, '19:00') && ms(l.ends_at) - ms(l.starts_at) === 3_600_000 && l.kind === 'individual' && l.status === 'planned' && l.version === 1))
  check('в каждом уроке — Тимур, и только он', L.every((l) => l.parts.length === 1 && l.parts[0].card_id === tim && l.parts[0].charge === null))

  const s2 = await series(A, { p_kind: 'group', p_title: 'B1 утро', p_weekdays: [1, 3], p_time: '09:30', p_minutes: 90, p_every_weeks: 2, p_starts_on: start, p_ends_on: end, p_cards: [aig, dan] })
  const G = ofSeries(await schedule(A), s2.data)
  check('группа пн и ср через неделю — 4 урока, 1-я и 3-я недели', JSON.stringify(G.map((l) => l.series_date)) === JSON.stringify([0, 2, 14, 16].map((n) => addDays(start, n))), `${code(s2)} ${G.map((l) => l.series_date).join(' ')}`)
  check('группа: название, 1,5 часа, двое; пробный Данияр — пробное участие',
    G.every((l) => l.title === 'B1 утро' && ms(l.ends_at) - ms(l.starts_at) === 5_400_000 && l.parts.length === 2 && part(l, dan)?.trial === true && part(l, aig)?.trial === false))

  const s3 = await series(A, { p_kind: 'individual', p_weekdays: [3, 5], p_time: '16:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: TODAY, p_cards: [aig] })
  const rule3 = { weekdays: [3, 5], everyWeeks: 1, startsOn: TODAY, endsOn: null }
  const open = ofSeries(await schedule(A), s3.data)
  const wantOpen = seriesDays(rule3, TODAY, addDays(TODAY, HORIZON_DAYS)).filter((d) => almaty(d, '16:00') > NOW)
  check('без конца — уроки на 12 недель вперёд, прошедших нет', JSON.stringify(open.map((l) => l.series_date)) === JSON.stringify(wantOpen), `${open.length} из ${wantOpen.length}`)

  // ── 2. «только этот» ───────────────────────────────────────────────────────────────────
  const [l1, , l3, l4] = L
  const newAt = new Date(almaty(addDays(l3.series_date, 1), '18:00')).toISOString()
  const mv = await A.client.rpc('update_lesson', { p_lesson: l3.id, p_kind: 'individual', p_starts_at: newAt, p_minutes: 90, p_cards: [tim] })
  let L2 = ofSeries(await schedule(A), s1.data)
  const m3 = L2.find((l) => l.id === l3.id)
  check('перенос одного: новое время, «перенесён с», версия 2', !mv.error && ms(m3.starts_at) === ms(newAt) && ms(m3.moved_from) === ms(l3.starts_at) && m3.version === 2, code(mv))
  check('перенос не рвёт серию: тот же день серии, остальные 7 не тронуты',
    m3.series_id === s1.data && m3.series_date === l3.series_date && L2.length === 8 && L2.filter((l) => l.id !== l3.id).every((l) => l.version === 1 && ms(l.starts_at) === almaty(l.series_date, '19:00')))
  const refill = await sql(`select public.series_fill('${s1.data}', null, now()) as n`)
  check('окно не создаёт второй урок на старом месте', refill[0].n === 0 && ofSeries(await schedule(A), s1.data).length === 8, `создано ${refill[0].n}`)
  await A.client.rpc('update_lesson', { p_lesson: l3.id, p_kind: 'individual', p_starts_at: l3.starts_at, p_minutes: 60, p_cards: [tim] })
  const back = await byId(A, l3.id)
  check('вернули на место — «перенесён с» снят, версия 3', back.moved_from === null && back.version === 3)
  const c4 = await A.client.rpc('cancel_lesson', { p_lesson: l4.id, p_charge: false })
  const x4 = await byId(A, l4.id)
  check('отмена одного: отменён, не списан, версия 2', !c4.error && x4.status === 'cancelled' && part(x4, tim).charge === 'not_charged' && x4.version === 2, code(c4))
  await A.client.rpc('restore_lesson', { p_lesson: l4.id })
  const r4 = await byId(A, l4.id)
  check('возврат одного: запланирован, отметки сброшены, версия 3', r4.status === 'planned' && part(r4, tim).charge === null && r4.version === 3)
  check('отметка до начала урока «был» — нельзя', /RECALL_LESSON_NOT_STARTED/.test(code(await A.client.rpc('mark_lesson_participant', { p_lesson: l1.id, p_card: tim, p_outcome: 'present' }))))

  // ── 3. «этот и все следующие» ───────────────────────────────────────────────────────────
  const [, , , , l5, l6, l7, l8] = L
  await A.client.rpc('update_lesson', { p_lesson: l6.id, p_kind: 'individual', p_starts_at: new Date(ms(l6.starts_at) + 3_600_000).toISOString(), p_minutes: 60, p_cards: [tim] })
  await A.client.rpc('cancel_lesson', { p_lesson: l7.id, p_charge: false })
  const sp = await A.client.rpc('update_series_from', { p_lesson: l5.id, p_kind: 'individual', p_weekdays: [2, 4], p_time: '20:00', p_minutes: 60, p_every_weeks: 1, p_ends_on: end, p_cards: [tim] })
  const all = await schedule(A)
  const before = ofSeries(all, s1.data)
  const after = ofSeries(all, sp.data)
  check('деление: до урока — старая серия, 4 урока как были', !sp.error && before.map((l) => l.id).join() === L.slice(0, 4).map((l) => l.id).join(), code(sp))
  check('с урока — новая серия, 4 урока в 20:00', after.length === 4 && after.every((l) => l.status === 'cancelled' || ms(l.starts_at) === almaty(l.series_date, '20:00')), after.map((l) => `${l.series_date} ${l.status}`).join(' '))
  check('перенесённый отдельно — по новому расписанию (решение 3)', after.some((l) => l.series_date === l6.series_date && l.moved_from === null && ms(l.starts_at) === almaty(l6.series_date, '20:00')))
  check('отменённый (праздник) остался отменённым и в новой серии', after.some((l) => l.id === l7.id && l.status === 'cancelled'))
  check('уроков по-прежнему 8, лишних нет', before.length + after.length === 8 && !all.some((l) => l.id === l8.id))
  const mySeries = must(await A.client.rpc('get_my_series'), 'серии')
  const oldS = mySeries.find((s) => s.id === s1.data)
  const newS = mySeries.find((s) => s.id === sp.data)
  check('старая серия кончается накануне, новая помнит, от какой отделилась', oldS?.ends_on === addDays(l5.series_date, -1) && newS?.split_from === s1.data && newS?.start_time === '20:00:00')
  const firstFri = ofSeries(await schedule(A), s3.data)[0]
  const sp2 = await A.client.rpc('update_series_from', { p_lesson: firstFri.id, p_kind: 'individual', p_weekdays: [3, 5], p_time: '17:00', p_minutes: 60, p_every_weeks: 1, p_cards: [aig] })
  const ser2 = must(await A.client.rpc('get_my_series'), 'серии')
  check('деление с первого урока — пустой старой серии не остаётся', !sp2.error && !ser2.some((s) => s.id === s3.data) && ser2.some((s) => s.id === sp2.data && s.split_from === null), code(sp2))
  const open2 = ofSeries(await schedule(A), sp2.data)
  check('…и все её уроки — в 17:00', open2.length === open.length && open2.every((l) => ms(l.starts_at) === almaty(l.series_date, '17:00')))

  // ── ссылка и версия ─────────────────────────────────────────────────────────────────────
  check('ссылка не на сайт — отказ', /RECALL_BAD_LINK/.test(code(await A.client.rpc('set_default_lesson_link', { p_link: 'javascript:alert(1)' }))))
  await A.client.rpc('set_default_lesson_link', { p_link: '  meet.google.com/abc-defg-hij ' })
  const withLink = await byId(A, l1.id)
  check('ссылка по умолчанию дополнена https:// и видна у урока', withLink.link === 'https://meet.google.com/abc-defg-hij', withLink.link)
  await A.client.rpc('update_lesson', { p_lesson: l1.id, p_kind: 'individual', p_starts_at: l1.starts_at, p_minutes: 60, p_cards: [tim], p_link: 'https://zoom.us/j/1' })
  const own = await byId(A, l1.id)
  check('своя ссылка урока — версия растёт', own.link === 'https://zoom.us/j/1' && own.version === 2)

  // ── проверки ввода ─────────────────────────────────────────────────────────────────────
  const bad = { p_kind: 'individual', p_weekdays: [2], p_time: '19:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: start, p_cards: [tim] }
  check('ввод: пустые дни, 8-й день, шаг 3, конец раньше урока — RECALL_BAD_REPEAT', (await Promise.all([
    series(A, { ...bad, p_weekdays: [] }), series(A, { ...bad, p_weekdays: [8] }), series(A, { ...bad, p_every_weeks: 3 }), series(A, { ...bad, p_ends_on: start }),
  ])).every((r) => /RECALL_BAD_REPEAT/.test(code(r))))
  check('ввод: группа без названия, двое в индивидуальном, 10 минут, серия «пробный»', [
    /RECALL_GROUP_TITLE/.test(code(await series(A, { ...bad, p_kind: 'group', p_cards: [aig, dan] }))),
    /RECALL_LESSON_CARDS/.test(code(await series(A, { ...bad, p_cards: [aig, dan] }))),
    /RECALL_BAD_TIME/.test(code(await series(A, { ...bad, p_minutes: 10 }))),
    /RECALL_BAD_KIND/.test(code(await series(A, { ...bad, p_kind: 'trial' }))),
  ].every(Boolean))
  check('период чтения больше 100 дней — отказ', /RECALL_BAD_RANGE/.test(code(await A.client.rpc('get_schedule', { p_from: at(0), p_to: at(101 * 1440) }))))

  // ── 4. автосписание, пробный, поздняя отмена ───────────────────────────────────────────────
  const bTim0 = (await balance(A, tim)).balance
  const auto = must(await lesson(A, { p_kind: 'individual', p_starts_at: at(10), p_minutes: 60, p_cards: [tim] }), 'урок')
  const trialL = must(await lesson(A, { p_kind: 'trial', p_starts_at: at(12), p_minutes: 60, p_cards: [aig] }), 'пробный')
  const grp = must(await lesson(A, { p_kind: 'group', p_title: 'Разовая', p_starts_at: at(15), p_minutes: 60, p_cards: [aig, dan] }), 'группа')
  const late = must(await lesson(A, { p_kind: 'individual', p_starts_at: at(3 * 60), p_minutes: 60, p_cards: [tim] }), 'поздно')
  check('пробному в группе поздняя отмена — RECALL_TRIAL_FREE', /RECALL_TRIAL_FREE/.test(code(await A.client.rpc('mark_lesson_participant', { p_lesson: grp, p_card: dan, p_outcome: 'late_cancel' }))))
  const t1 = await tick(`now() + interval '2 hours'`)
  const a1 = await byId(A, auto)
  check('после конца урок «проведён», Тимур «был, списан» автоматически', a1.status === 'done' && part(a1, tim).attended === true && part(a1, tim).charge === 'charged' && part(a1, tim).charge_auto === true, JSON.stringify(t1))
  check('будильник версию не трогает', a1.version === 1)
  check('ещё не закончившийся урок не тронут', (await byId(A, late)).status === 'planned')
  const tr = await byId(A, trialL)
  check('урок «пробный» не списывается', tr.status === 'done' && part(tr, aig).attended === true && part(tr, aig).charge === 'not_charged')
  const g1 = await byId(A, grp)
  check('пробный ученик в обычном групповом уроке не списывается, сосед — да (решение 4)', part(g1, dan).charge === 'not_charged' && part(g1, aig).charge === 'charged')
  const forged = await sql(`do $t$ begin update public.lesson_participants set charge = 'charged' where lesson_id = '${grp}' and card_id = '${dan}'; exception when check_violation then raise notice 'ok'; end $t$; select charge from public.lesson_participants where lesson_id = '${grp}' and card_id = '${dan}'`)
  check('списать пробного нельзя даже прямой записью — правило базы', forged[0]?.charge === 'not_charged')
  const bTim1 = await balance(A, tim)
  check('автосписание: остаток Тимура −1', bTim1.balance === bTim0 - 1 && bTim1.rawOk, `${bTim0} → ${bTim1.balance}`)
  await A.client.rpc('cancel_lesson', { p_lesson: late, p_charge: true })
  const lt = await byId(A, late)
  const bTim2 = await balance(A, tim)
  check('поздняя отмена: «не был, поздняя отмена», списан', lt.status === 'cancelled' && part(lt, tim).attended === false && part(lt, tim).charge === 'late_cancel' && bTim2.balance === bTim1.balance - 1)

  // пробный «к началу урока»: стал «занимается» до начала — списывается, после — нет
  const n1 = await card(A, 'Новичок 1', 'trial')
  const n2 = await card(A, 'Новичок 2', 'trial')
  const before1 = must(await lesson(A, { p_kind: 'individual', p_starts_at: at(20), p_minutes: 60, p_cards: [n1] }), 'урок н1')
  const started2 = must(await lesson(A, { p_kind: 'individual', p_starts_at: at(-30), p_minutes: 60, p_cards: [n2] }), 'урок н2')
  await setStatus(A, n1, 'active')
  await setStatus(A, n2, 'active')
  await tick(`now() + interval '2 hours'`)
  check('«пробный → занимается» до начала урока — урок списывается', part(await byId(A, before1), n1).charge === 'charged')
  check('…после начала — урок остаётся пробным, не списан', part(await byId(A, started2), n2).charge === 'not_charged')

  // ── 5. исправление задним числом, остаток ────────────────────────────────────────────────
  const past = must(await lesson(A, { p_kind: 'individual', p_starts_at: at(-180), p_minutes: 60, p_cards: [tim] }), 'прошедший')
  await tick()
  const b0 = await balance(A, tim)
  check('прошедший урок списан будильником', part(await byId(A, past), tim).charge === 'charged')
  const steps = []
  for (const [outcome, delta] of [['absent', 1], ['present_free', 1], ['present', 0]]) {
    const r = await A.client.rpc('mark_lesson_participant', { p_lesson: past, p_card: tim, p_outcome: outcome })
    const b = await balance(A, tim)
    steps.push(!r.error && b.balance === b0.balance + delta && b.rawOk)
  }
  check('исправление задним числом: «не был» и «был, не списывать» возвращают урок, «был» — снова списан', steps.every(Boolean), steps.join())
  await A.client.rpc('cancel_lesson', { p_lesson: past, p_charge: false })
  const bc = await balance(A, tim)
  await A.client.rpc('restore_lesson', { p_lesson: past })
  await tick()
  const br = await balance(A, tim)
  check('отмена задним числом возвращает урок, возврат — будильник списывает снова', bc.balance === b0.balance + 1 && br.balance === b0.balance && part(await byId(A, past), tim).charge_auto === true)

  const pay = await A.client.rpc('add_paid_lessons', { p_card: tim, p_count: 8, p_note: 'наличными' })
  await A.client.rpc('add_paid_lessons', { p_card: tim, p_count: -1, p_note: 'ошибся' })
  const bp = await balance(A, tim)
  check('оплата +8 и исправление −1: оплачено 7, остаток = оплачено − списано', !pay.error && bp.paid === 7 && bp.balance === 7 - bp.charged && bp.rawOk, `${bp.paid} − ${bp.charged} = ${bp.balance}`)
  check('снять больше, чем отмечено, и ноль — RECALL_BAD_COUNT', [
    await A.client.rpc('add_paid_lessons', { p_card: tim, p_count: -8 }),
    await A.client.rpc('add_paid_lessons', { p_card: tim, p_count: 0 }),
  ].every((r) => /RECALL_BAD_COUNT/.test(code(r))))
  const [{ upd }] = await sql(`do $t$ begin update public.paid_lessons set n = 100 where card_id = '${tim}'; exception when others then null; end $t$; select coalesce(sum(n), 0)::int as upd from public.paid_lessons where card_id = '${tim}'`)
  check('журнал оплат только дописывается — правка отклонена', upd === 7)

  // ── 6. ученик видит только свои уроки ─────────────────────────────────────────────────────
  const sTim = await makeUser('stim', 'Timur K')
  const sAig = await makeUser('saig', 'Aigerim N')
  must(await sTim.client.rpc('join_teacher', { code: must(await A.client.rpc('student_card_invite', { p_card: tim }), 'код') }), 'join tim')
  must(await sAig.client.rpc('join_teacher', { code: must(await A.client.rpc('student_card_invite', { p_card: aig }), 'код') }), 'join aig')
  const my = (u) => u.client.rpc('get_my_lessons', { p_from: at(-2 * 1440), p_to: at(98 * 1440) })
  const myTim = must(await my(sTim), 'мои уроки')
  const myAig = must(await my(sAig), 'мои уроки')
  const schedA = await schedule(A)
  const timIds = schedA.filter((l) => part(l, tim)).map((l) => l.id).sort()
  const aigIds = schedA.filter((l) => part(l, aig)).map((l) => l.id).sort()
  check('ученик видит ровно свои уроки', JSON.stringify(myTim.map((l) => l.lesson_id).sort()) === JSON.stringify(timIds) && JSON.stringify(myAig.map((l) => l.lesson_id).sort()) === JSON.stringify(aigIds), `${myTim.length}/${timIds.length}, ${myAig.length}/${aigIds.length}`)
  check('в групповом — название и время, без других участников и отметок',
    myAig.some((l) => l.title === 'B1 утро') && myAig.every((l) => !('card_id' in l) && !('card_name' in l) && !('charge' in l) && !('attended' in l)))
  check('ссылка учителя по умолчанию доходит до ученика', myTim.some((l) => l.link === 'https://meet.google.com/abc-defg-hij'))
  const balTim = must(await sTim.client.rpc('get_my_lesson_balances'), 'остаток ученика')
  const balAig = must(await sAig.client.rpc('get_my_lesson_balances'), 'остаток ученика')
  const aigTeacher = await balance(A, aig)
  check('ученику остаток одним числом; учёт без оплат — tracked = false', balTim[0]?.lessons_left === Math.max(0, bp.balance) && balTim[0]?.tracked === true && balAig[0]?.tracked === false)
  check('минус видит только учитель — ученику 0', aigTeacher.balance < 0 && balAig[0]?.lessons_left === 0, `у учителя ${aigTeacher.balance}`)
  check('ученику расписание учителя и запись недоступны', must(await sAig.client.rpc('get_schedule', { p_from: at(-1440), p_to: at(1440 * 30) }), 'чужое').length === 0 &&
    /RECALL_NOT_TEACHER/.test(code(await lesson(sAig, { p_kind: 'individual', p_starts_at: at(60), p_minutes: 60, p_cards: [aig] }))))
  await sql(`delete from public.teacher_students where teacher_id = '${A.id}' and student_id = '${sTim.id}'`)
  check('отвязался — уроков и остатка не видит', must(await my(sTim), 'мои').length === 0 && must(await sTim.client.rpc('get_my_lesson_balances'), 'ост').length === 0)

  // ── 6. чужой учитель ────────────────────────────────────────────────────────────────────
  const B = await teacher('b', { plan: 'teacher_mini' })
  check('чужой учитель: расписание, серии, остатки — пусто', (await schedule(B)).length === 0 && must(await B.client.rpc('get_my_series'), 'с').length === 0 && must(await B.client.rpc('get_lesson_balances'), 'о').length === 0)
  const foreign = [
    await B.client.rpc('update_lesson', { p_lesson: l1.id, p_kind: 'individual', p_starts_at: at(60), p_minutes: 60, p_cards: [tim] }),
    await B.client.rpc('cancel_lesson', { p_lesson: l1.id, p_charge: true }),
    await B.client.rpc('restore_lesson', { p_lesson: l4.id }),
    await B.client.rpc('mark_lesson_participant', { p_lesson: auto, p_card: tim, p_outcome: 'absent' }),
    await B.client.rpc('update_series_from', { p_lesson: l1.id, p_kind: 'individual', p_weekdays: [2], p_time: '10:00', p_minutes: 60, p_every_weeks: 1, p_cards: [tim] }),
    await B.client.rpc('cancel_series_from', { p_lesson: l1.id, p_charge: false }),
  ]
  check('чужой учитель не меняет чужие уроки — RECALL_LESSON_NOT_FOUND', foreign.every((r) => /RECALL_LESSON_NOT_FOUND/.test(code(r))), foreign.map(code).join(' | '))
  check('чужие карточки не вписать и не оплатить — RECALL_CARD_NOT_FOUND', [
    await lesson(B, { p_kind: 'individual', p_starts_at: at(60), p_minutes: 60, p_cards: [tim] }),
    await B.client.rpc('add_paid_lessons', { p_card: tim, p_count: 5 }),
  ].every((r) => /RECALL_CARD_NOT_FOUND/.test(code(r))))
  // потолки строк (PLAN.md Ф2.15, А3): пробный аккаунт не раздует базу
  const capCard = await card(B, 'Потолок')
  await sql(`insert into public.lesson_series (teacher_id, kind, weekdays, start_time, minutes, starts_on)
      select '${B.id}', 'individual', '{1}', '10:00', 60, current_date from generate_series(1, 60);
    insert into public.lessons (teacher_id, kind, starts_at, ends_at)
      select '${B.id}', 'individual', now() + interval '1 day', now() + interval '25 hours' from generate_series(1, 500);
    insert into public.paid_lessons (teacher_id, card_id, n) select '${B.id}', '${capCard}', 1 from generate_series(1, 500)`)
  const caps = [
    await series(B, { p_kind: 'individual', p_weekdays: [2], p_time: '10:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: TODAY, p_cards: [capCard] }),
    await lesson(B, { p_kind: 'individual', p_starts_at: at(600), p_minutes: 60, p_cards: [capCard] }),
    await B.client.rpc('add_paid_lessons', { p_card: capCard, p_count: 1 }),
  ]
  check('потолки: 60 серий, 500 разовых уроков, 500 оплат — RECALL_SCHEDULE_LIMIT', caps.every((r) => /RECALL_SCHEDULE_LIMIT/.test(code(r))), caps.map(code).join(' | '))
  const direct = await Promise.all(['lessons', 'lesson_series', 'series_participants', 'lesson_participants', 'paid_lessons', 'schedule_settings'].map((t) => A.client.from(t).select('*').limit(1)))
  check('таблицы закрыты даже для своего учителя — только RPC', direct.every((r) => r.error || (r.data ?? []).length === 0), direct.map((r) => r.error?.code ?? r.data?.length).join(' '))
  for (const [fn, args] of [
    ['card_lesson_balance', { p_card: tim }],
    ['schedule_tick', { p_now: at(0) }],
    ['series_fill', { p_series: s2.data, p_from: null, p_now: at(0) }],
    ['schedule_cards', { p_teacher: A.id, p_kind: 'individual', p_cards: [tim] }],
    ['lesson_join_cards', { p_lesson: l1.id, p_cards: [tim] }],
    ['lesson_cancel', { p_lesson: l1.id, p_charge: true }],
    ['after_lessons_changed', { p_teacher: A.id, p_change: {} }],
  ]) {
    check(`служебная ${fn} закрыта для вошедшего`, !!(await B.client.rpc(fn, args)).error)
  }

  // ── 7. пауза и архив (решение 1) ──────────────────────────────────────────────────────────
  const P = await card(A, 'Пауза')
  const nb = await card(A, 'Сосед')
  const sP = must(await series(A, { p_kind: 'individual', p_weekdays: [1, 4], p_time: '12:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: TODAY, p_cards: [P] }), 'серия П')
  const sG = must(await series(A, { p_kind: 'group', p_title: 'Группа П', p_weekdays: [2], p_time: '12:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: TODAY, p_cards: [P, nb] }), 'группа П')
  let S = await schedule(A)
  const nP = ofSeries(S, sP).length
  const firstP = ofSeries(S, sP)[0]
  await A.client.rpc('mark_lesson_participant', { p_lesson: firstP.id, p_card: P, p_outcome: 'late_cancel' })
  await setStatus(A, P, 'paused')
  S = await schedule(A)
  check('пауза: будущие уроки ученика ушли, отмеченная поздняя отмена — осталась', ofSeries(S, sP).length === 1 && ofSeries(S, sP)[0].id === firstP.id && nP > 3, `было ${nP}, стало ${ofSeries(S, sP).length}`)
  check('пауза: в группе уроки идут без него', ofSeries(S, sG).length > 0 && ofSeries(S, sG).every((l) => l.parts.length === 1 && l.parts[0].card_id === nb))
  check('ученика на паузе в новый урок не вписать — RECALL_CARD_PAUSED', /RECALL_CARD_PAUSED/.test(code(await lesson(A, { p_kind: 'individual', p_starts_at: at(600), p_minutes: 60, p_cards: [P] }))))
  await setStatus(A, P, 'active')
  S = await schedule(A)
  check('вернулся — уроки серии снова на месте, без дублей', ofSeries(S, sP).length === nP && new Set(ofSeries(S, sP).map((l) => l.series_date)).size === nP)
  check('…и в группе снова он', ofSeries(S, sG).every((l) => l.parts.length === 2))
  await setStatus(A, P, 'archived')
  S = await schedule(A)
  check('архив — так же, как пауза', ofSeries(S, sP).length === 1 && /RECALL_CARD_ARCHIVED/.test(code(await lesson(A, { p_kind: 'individual', p_starts_at: at(600), p_minutes: 60, p_cards: [P] }))))

  // ── отмена серии с урока ───────────────────────────────────────────────────────────────────
  const Gs = ofSeries(await schedule(A), s2.data)
  const cs = await A.client.rpc('cancel_series_from', { p_lesson: Gs[1].id, p_charge: false })
  const Gc = ofSeries(await schedule(A), s2.data)
  check('отмена серии с урока: он отменён, следующих нет, серия кончается в его день',
    !cs.error && Gc.length === 2 && Gc[1].status === 'cancelled' && must(await A.client.rpc('get_my_series'), 'с').find((s) => s.id === s2.data)?.ends_on === Gs[1].series_date, code(cs))

  // ── 8. без тарифа + окно будильника ────────────────────────────────────────────────────────
  const N = await teacher('n')
  const nc = await card(N, 'Ученик Н')
  const nS = must(await series(N, { p_kind: 'individual', p_weekdays: [1, 2, 3, 4, 5, 6, 7], p_time: '08:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: TODAY, p_cards: [nc] }), 'серия Н')
  const nL = must(await lesson(N, { p_kind: 'individual', p_starts_at: at(10), p_minutes: 60, p_cards: [nc] }), 'урок Н')
  await sql(`update public.profiles set trial_until = now() - interval '1 day' where id = '${N.id}'`)
  const denied = [
    await lesson(N, { p_kind: 'individual', p_starts_at: at(60), p_minutes: 60, p_cards: [nc] }),
    await series(N, { p_kind: 'individual', p_weekdays: [1], p_time: '10:00', p_minutes: 60, p_every_weeks: 1, p_starts_on: TODAY, p_cards: [nc] }),
    await N.client.rpc('update_lesson', { p_lesson: nL, p_kind: 'individual', p_starts_at: at(70), p_minutes: 60, p_cards: [nc] }),
    await N.client.rpc('update_series_from', { p_lesson: ofSeries(await schedule(N), nS)[1].id, p_kind: 'individual', p_weekdays: [1], p_time: '10:00', p_minutes: 60, p_every_weeks: 1, p_cards: [nc] }),
    await N.client.rpc('cancel_lesson', { p_lesson: nL, p_charge: false }),
    await N.client.rpc('cancel_series_from', { p_lesson: ofSeries(await schedule(N), nS)[1].id, p_charge: false }),
    await N.client.rpc('restore_lesson', { p_lesson: nL }),
    await N.client.rpc('mark_lesson_participant', { p_lesson: nL, p_card: nc, p_outcome: 'absent' }),
    await N.client.rpc('add_paid_lessons', { p_card: nc, p_count: 4 }),
    await N.client.rpc('set_default_lesson_link', { p_link: 'https://meet.google.com/x' }),
  ]
  check('без тарифа каждая запись — RECALL_PLAN_REQUIRED (10 функций)', denied.every((r) => /RECALL_PLAN_REQUIRED/.test(code(r))), denied.map(code).join(' | '))
  const nBefore = ofSeries(await schedule(N), nS).length
  check('без тарифа расписание и остатки видны', nBefore > 0 && must(await N.client.rpc('get_lesson_balances'), 'о').length === 1)
  const openBefore = ofSeries(await schedule(A), sp2.data).length
  await tick(`now() + interval '2 hours'`)
  const nl1 = await byId(N, nL)
  check('без тарифа автосписание стоит: урок «не отмечен»', nl1.status === 'planned' && nl1.settled === true && part(nl1, nc).charge === null)
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '20 days' where id = '${N.id}'`)
  await tick(`now() + interval '3 hours'`)
  const nl2 = await byId(N, nL)
  check('после оплаты пропущенное задним числом не списывается (решение 2)', nl2.status === 'planned' && part(nl2, nc).charge === null)
  await N.client.rpc('update_lesson', { p_lesson: nL, p_kind: 'individual', p_starts_at: at(4 * 60), p_minutes: 60, p_cards: [nc] })
  const nl3 = await byId(N, nL)
  await tick(`now() + interval '6 hours'`)
  check('пропущенный урок перенесли на будущее — будильник спишет его после конца', nl3.settled === false && part(await byId(N, nL), nc).charge === 'charged')
  await sql(`update public.profiles set plan = 'free', plan_expires_at = null where id = '${N.id}'`)
  // мерить здесь, а не в nBefore: с тарифом будильник на +3 и +6 часов законно
  // растит окно, если «сейчас» позже 18:00 по Алматы (переход через полночь) —
  // проверка краснела вечером на исправной базе (04.10.2026)
  const [{ n: nFree }] = await sql(`select count(*)::int as n from public.lessons where series_id = '${nS}'`)
  await tick(`now() + interval '7 days'`)
  const grown = seriesDays({ weekdays: [3, 5], everyWeeks: 1, startsOn: TODAY, endsOn: null }, addDays(TODAY, HORIZON_DAYS + 1), addDays(TODAY, HORIZON_DAYS + 7)).length
  const [{ n: openNow }] = await sql(`select count(*)::int as n from public.lessons where series_id = '${sp2.data}'`)
  check('будильник двигает окно: +неделя уроков серии без конца', grown > 0 && openNow === openBefore + grown, `${openBefore} → ${openNow}, ждали +${grown}`)
  check('без тарифа окно не растёт', (await sql(`select count(*)::int as n from public.lessons where series_id = '${nS}'`))[0].n === nFree)
}

async function main() {
  try {
    await run()
  } catch (e) {
    check('проверка дошла до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
  } finally {
    for (const m of made) await deleteTestUser(admin, sql, m.id).catch((e) => console.log(`  ⚠ ${e.message}`))
    await admin.from('allowed_emails').delete().in('email', made.map((m) => m.email))
    console.log('Временные аккаунты удалены.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

await main()
