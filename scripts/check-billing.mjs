/**
 * Оплата тарифа на живой ТЕСТОВОЙ базе (PLAN.md Ф2.1; архитектура §9;
 * миграция 0004_billing.sql).
 *
 * Что доказывает:
 *   1. продление верное во всех случаях: истёкший тариф — от сегодня,
 *      действующий — от даты окончания, на пробном — от конца пробного;
 *      месяцы по календарю Алматы (31 января → 28 февраля; ночь 1 марта по
 *      Алматы — это ещё 28 февраля по UTC); и ровно так же считает клиентская
 *      копия правила (domains/billing/model.ts) — пара сверяется на каждом случае;
 *   2. не-владелец получает отказ: confirm_payment и все admin_* — и ничего не
 *      пишется; таблицы оплат, заявок и кодов закрыты для чтения и записи;
 *      служебные функции (код по чужому uid, крючок рефералки) закрыты;
 *   3. строка оплаты создаётся со всеми полями; заявка закрывается;
 *      человеку — одно уведомление «Оплата получена»; воронка получает
 *      событие от имени ПЛАТЕЛЬЩИКА;
 *   4. повтор того же нажатия (и параллельный) не продлевает второй раз;
 *      закрытую заявку не подтвердить; неверные срок, сумма, тариф, способ —
 *      отказ без записи;
 *   5. «Оплата отправлена»: одна открытая заявка на человека, повтор её
 *      обновляет, владельцу — одно уведомление, даже при двух нажатиях разом;
 *      «деньги не пришли» убирает заявку;
 *   6. личный код: из имени латиницей (казахские буквы тоже), не меняется,
 *      по нему находит поиск админки.
 *
 * Аккаунты, оплаты и события создаются на время прогона и удаляются.
 * Запуск: node scripts/check-billing.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { addMonthsAlmaty, termAfterPayment } from '../src/domains/billing/model.ts'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и оплаты — только тестовая база.')
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

const PASSWORD = 'BillingCheck!2026'
const USERS = {
  teacher: { email: 'billing-check-t@recall.test', name: 'Мадина Проверка' },
  learner: { email: 'billing-check-l@recall.test', name: 'Әйгерім' },
  owner: { email: 'billing-check-a@recall.test', name: 'Владелец Проверка' },
}

async function makeUser({ email, name }) {
  await admin.from('allowed_emails').upsert({ email, note: 'check-billing (временный)' })
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
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход ${email}: ${e2.message}`)
  return { id, client }
}

async function cleanup(ids) {
  const list = ids.filter(Boolean).map((id) => `'${id}'`).join(',')
  if (list) {
    // оплаты переживают удаление аккаунта (учёт выручки) — убрать руками
    await sql(`
      delete from public.payments where user_id in (${list}) or confirmed_by in (${list});
      delete from public.events where user_id in (${list}) and name = 'payment_activated';
    `).catch((e) => console.log('уборка SQL:', e.message))
  }
  for (const id of ids) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', Object.values(USERS).map((u) => u.email))
}

const denied = (r) => !!r.error
const errText = (r) => r.error?.message ?? ''
const ms = (iso) => new Date(iso).getTime()
const same = (a, b) => Math.abs(ms(a) - ms(b)) < 1000

async function profile(id) {
  const [p] = await sql(`select plan, plan_expires_at, trial_until from public.profiles where id = '${id}'`)
  return p
}
async function setPlan(id, plan, expiresSql, trialSql) {
  await sql(`update public.profiles set plan = '${plan}', plan_expires_at = ${expiresSql}, trial_until = ${trialSql} where id = '${id}'`)
}
async function count(q) {
  const [{ n }] = await sql(`select count(*)::int as n from (${q}) s`)
  return n
}

async function run(t, l, a) {
  await sql(`update public.profiles set is_admin = true where id = '${a.id}'`)

  // ── 6. личный код ──────────────────────────────────────────────────────────
  const info1 = await t.client.rpc('get_pay_info')
  const info2 = await t.client.rpc('get_pay_info')
  const code = info1.data?.[0]?.code
  check('личный код — из имени латиницей и цифр 2–9', /^MADINA[2-9]{1,4}$/.test(code ?? ''), code ?? errText(info1))
  check('код не меняется между заходами', info2.data?.[0]?.code === code)
  const lInfo = await l.client.rpc('get_pay_info')
  check('казахские буквы в коде латиницей (Әйгерім → AYGERIM…)', /^AYGERIM[2-9]{1,4}$/.test(lInfo.data?.[0]?.code ?? ''), lInfo.data?.[0]?.code)
  const found = await a.client.rpc('admin_find_user', { q: code.toLowerCase() })
  check('поиск админки находит человека по коду из сообщения', (found.data ?? []).some((u) => u.id === t.id && u.code === code))

  // ── 2. права ───────────────────────────────────────────────────────────────
  await setPlan(t.id, 'free', 'null', "now() - interval '1 day'")
  const before = await profile(t.id)
  const self = await t.client.rpc('confirm_payment', { p_user: t.id, p_plan: 'teacher_pro', p_months: 12, p_amount: 1 })
  check('не-владелец: confirm_payment — отказ RECALL_NOT_ADMIN', /RECALL_NOT_ADMIN/.test(errText(self)), errText(self))
  const after = await profile(t.id)
  check('после отказа тариф не изменился', after.plan === before.plan && after.plan_expires_at === before.plan_expires_at)
  check('после отказа строки оплаты нет', (await count(`select 1 from public.payments where user_id = '${t.id}'`)) === 0)
  for (const [fn, args] of [
    ['admin_payment_claims', {}],
    ['admin_recent_payments', {}],
    ['admin_dismiss_payment_claim', { p_claim: randomUUID() }],
  ]) {
    const r = await t.client.rpc(fn, args)
    check(`не-владелец: ${fn} — отказ`, /RECALL_NOT_ADMIN/.test(errText(r)), errText(r))
  }
  for (const [fn, args] of [
    ['ensure_personal_code', { p_user: l.id }],
    ['after_payment_confirmed', { p_payment: randomUUID() }],
    ['latin_letters', { p: 'тест' }],
  ]) {
    check(`служебная ${fn} закрыта для вошедшего`, denied(await t.client.rpc(fn, args)))
  }
  for (const table of ['payments', 'payment_claims', 'personal_codes']) {
    const r = await t.client.from(table).select('*')
    check(`таблица ${table} не читается напрямую`, denied(r) || (r.data ?? []).length === 0)
  }
  const ins = await t.client.from('payments').insert({
    user_id: t.id, plan: 'teacher_pro', months: 12, amount: 1, method: 'card',
    starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 1e10).toISOString(),
  })
  check('оплату не вставить напрямую', denied(ins))
  const insC = await t.client.from('payment_claims').insert({ user_id: t.id, plan: 'teacher_pro' })
  check('заявку не вставить мимо RPC', denied(insC))

  // ── 5. «Оплата отправлена» ─────────────────────────────────────────────────
  const notesFor = (uid, kind) => count(`select 1 from public.notifications where user_id = '${uid}' and kind = '${kind}'`)
  const [r1, r2] = await Promise.all([
    t.client.rpc('report_payment_sent', { p_plan: 'teacher_mini' }),
    t.client.rpc('report_payment_sent', { p_plan: 'teacher_mini' }),
  ])
  const claimId = r1.data?.[0]?.id
  check('два нажатия разом — одна заявка', !!claimId && r2.data?.[0]?.id === claimId, errText(r1) || errText(r2))
  check('владельцу — одно уведомление о заявке', (await notesFor(a.id, 'payment_reported')) === 1)
  const r3 = await t.client.rpc('report_payment_sent', { p_plan: 'teacher_start' })
  check('повтор с другим тарифом обновляет ту же заявку', r3.data?.[0]?.id === claimId && r3.data?.[0]?.plan === 'teacher_start')
  check('после повтора уведомление владельцу всё ещё одно', (await notesFor(a.id, 'payment_reported')) === 1)
  const [note] = await sql(`select data from public.notifications where user_id = '${a.id}' and kind = 'payment_reported'`)
  check('в уведомлении имя и ссылка в админку', note?.data?.name === 'Мадина Проверка' && note?.data?.href === '/admin')
  const tInfo = await t.client.rpc('get_pay_info')
  check('экран видит свою открытую заявку', tInfo.data?.[0]?.claim_id === claimId && tInfo.data?.[0]?.claim_plan === 'teacher_start')
  const bad = await t.client.rpc('report_payment_sent', { p_plan: 'free' })
  check('заявка на «free» — отказ', /RECALL_BAD_PLAN/.test(errText(bad)))
  const claims = await a.client.rpc('admin_payment_claims')
  const row = (claims.data ?? []).find((c) => c.id === claimId)
  check('владелец видит заявку с кодом и тарифом', row?.code === code && row?.claim_plan === 'teacher_start' && row?.email === USERS.teacher.email)

  // ── 1 + 3. истёкший тариф — от сегодня ────────────────────────────────────
  await setPlan(t.id, 'teacher_mini', "now() - interval '5 days'", "now() - interval '20 days'")
  const st1 = await profile(t.id)
  const [{ now: n1 }] = await sql('select now() as now')
  const req1 = randomUUID()
  const c1 = await a.client.rpc('confirm_payment', {
    p_user: t.id, p_plan: 'teacher_start', p_months: 1, p_amount: 6500, p_claim: claimId, p_request: req1,
  })
  const p1 = c1.data?.[0]
  check('истёкший тариф продлевается от сегодня', !!p1 && Math.abs(ms(p1.starts_at) - ms(n1)) < 30_000, errText(c1) || p1?.starts_at)
  const want1 = termAfterPayment(st1, 1, new Date(p1?.starts_at ?? 0))
  check('конец срока = +1 месяц по Алматы (как считает клиент)', !!p1 && same(p1.ends_at, want1.end.toISOString()), `${p1?.ends_at} / ${want1.end.toISOString()}`)
  const prof1 = await profile(t.id)
  check('тариф включён: Start до конца срока', prof1.plan === 'teacher_start' && same(prof1.plan_expires_at, p1?.ends_at))
  const [pay1] = await sql(`select * from public.payments where id = '${p1?.id}'`)
  check(
    'строка оплаты создана со всеми полями',
    pay1?.user_id === t.id && pay1.plan === 'teacher_start' && pay1.months === 1 && pay1.amount === 6500 &&
      pay1.method === 'kaspi_gold' && pay1.confirmed_by === a.id && pay1.request_id === req1,
    JSON.stringify(pay1),
  )
  const [cl1] = await sql(`select outcome, payment_id from public.payment_claims where id = '${claimId}'`)
  check('заявка закрыта этой оплатой', cl1?.outcome === 'confirmed' && cl1.payment_id === p1?.id)
  check('человеку — одно уведомление «Оплата получена»', (await notesFor(t.id, 'plan_paid')) === 1)
  const [ev] = await sql(`select user_id, props from public.events where name = 'payment_activated' and user_id = '${t.id}'`)
  check('воронка: событие оплаты от имени плательщика', ev?.props?.plan === 'teacher_start' && ev?.props?.amount === 6500)
  check('у владельца событий оплаты нет', (await count(`select 1 from public.events where name = 'payment_activated' and user_id = '${a.id}'`)) === 0)

  // ── 4. повтор, закрытая заявка, неверные данные ───────────────────────────
  const again = await a.client.rpc('confirm_payment', {
    p_user: t.id, p_plan: 'teacher_start', p_months: 1, p_amount: 6500, p_claim: claimId, p_request: req1,
  })
  check('то же нажатие ещё раз — та же оплата, помечено повтором', again.data?.[0]?.id === p1?.id && again.data?.[0]?.repeated === true, errText(again))
  check('повтор не продлил второй раз', same((await profile(t.id)).plan_expires_at, p1?.ends_at) && (await count(`select 1 from public.payments where user_id = '${t.id}'`)) === 1)
  const closed = await a.client.rpc('confirm_payment', {
    p_user: t.id, p_plan: 'teacher_start', p_months: 1, p_amount: 6500, p_claim: claimId, p_request: randomUUID(),
  })
  check('закрытую заявку не подтвердить', /уже закрыта/.test(errText(closed)), errText(closed))
  for (const [what, args] of [
    ['срок 0', { p_months: 0 }],
    ['срок 13', { p_months: 13 }],
    ['сумма 0', { p_amount: 0 }],
    ['тариф free', { p_plan: 'free' }],
    ['способ «наличные»', { p_method: 'cash' }],
  ]) {
    const r = await a.client.rpc('confirm_payment', {
      p_user: t.id, p_plan: 'teacher_mini', p_months: 1, p_amount: 3900, p_request: randomUUID(), ...args,
    })
    check(`неверно (${what}) — отказ`, denied(r), errText(r))
  }
  check('после отказов оплат не прибавилось', (await count(`select 1 from public.payments where user_id = '${t.id}'`)) === 1)

  // ── 1. действующий — от даты окончания; параллельный повтор ────────────────
  const st2 = await profile(t.id)
  const req2 = randomUUID()
  const args2 = { p_user: t.id, p_plan: 'teacher_start', p_months: 2, p_amount: 13000, p_request: req2 }
  const [c2a, c2b] = await Promise.all([a.client.rpc('confirm_payment', args2), a.client.rpc('confirm_payment', args2)])
  const p2 = c2a.data?.[0]
  check('два одинаковых нажатия разом — одна оплата', !!p2 && c2b.data?.[0]?.id === p2.id && (c2a.data[0].repeated !== c2b.data[0].repeated), errText(c2a) || errText(c2b))
  check('действующий тариф продлевается от даты окончания', !!p2 && same(p2.starts_at, st2.plan_expires_at), `${p2?.starts_at} / ${st2.plan_expires_at}`)
  const want2 = termAfterPayment(st2, 2)
  check('+2 месяца от окончания — как считает клиент', !!p2 && same(p2.ends_at, want2.end.toISOString()), `${p2?.ends_at} / ${want2.end.toISOString()}`)

  // ── 1. на пробном — от конца пробного; граница месяца по Алматы ───────────
  for (const [what, trial, months] of [
    ['на пробном — от конца пробного', "now() + interval '5 days'", 1],
    ['31 января → 28 февраля', "'2027-01-31 23:30+05'", 1],
    ['ночь 1 марта по Алматы → 1 апреля (а не 29 марта, как по UTC)', "'2027-03-01 02:00+05'", 1],
    ['12 месяцев', "'2027-02-28 12:00+05'", 12],
  ]) {
    await setPlan(l.id, 'free', 'null', trial)
    const st = await profile(l.id)
    const r = await a.client.rpc('confirm_payment', {
      p_user: l.id, p_plan: 'premium', p_months: months, p_amount: 1990 * months, p_request: randomUUID(), p_method: 'card',
    })
    const p = r.data?.[0]
    const want = termAfterPayment(st, months)
    check(
      `${what}: сервер и клиент совпали`,
      !!p && same(p.starts_at, st.trial_until) && same(p.ends_at, want.end.toISOString()),
      errText(r) || `${p?.starts_at} → ${p?.ends_at} / клиент ${want.end.toISOString()}`,
    )
  }
  check('пара addMonthsAlmaty: 31.01 23:30 → 28.02 23:30 по Алматы', addMonthsAlmaty(new Date('2027-01-31T23:30:00+05:00'), 1).toISOString() === new Date('2027-02-28T23:30:00+05:00').toISOString())

  // ── 5. «деньги не пришли» ───────────────────────────────────────────────────
  const lc = await l.client.rpc('report_payment_sent', { p_plan: 'premium' })
  const lClaim = lc.data?.[0]?.id
  const dis = await a.client.rpc('admin_dismiss_payment_claim', { p_claim: lClaim })
  const [lcRow] = await sql(`select outcome from public.payment_claims where id = '${lClaim}'`)
  check('владелец убирает заявку: она закрыта как «не пришло»', !denied(dis) && lcRow?.outcome === 'dismissed', errText(dis))
  const dis2 = await a.client.rpc('admin_dismiss_payment_claim', { p_claim: lClaim })
  check('убрать уже закрытую — понятный отказ', /уже закрыта/.test(errText(dis2)))
  const lInfo2 = await l.client.rpc('get_pay_info')
  check('у человека заявки больше нет', !lInfo2.data?.[0]?.claim_id)

  // ── последние оплаты ────────────────────────────────────────────────────────
  const recent = await a.client.rpc('admin_recent_payments', { p_limit: 50 })
  const mine = (recent.data ?? []).filter((p) => p.user_id === t.id || p.user_id === l.id)
  check('владелец видит последние оплаты с суммами', mine.length === 6 && mine.some((p) => p.amount === 13000 && p.email === USERS.teacher.email), `оплат: ${mine.length}`)
}

async function main() {
  const made = []
  try {
    const t = await makeUser(USERS.teacher)
    made.push(t.id)
    const l = await makeUser(USERS.learner)
    made.push(l.id)
    const a = await makeUser(USERS.owner)
    made.push(a.id)
    await run(t, l, a)
  } catch (e) {
    check('проверка дошла до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
  } finally {
    await cleanup(made)
    console.log('Временные аккаунты, оплаты и события удалены.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

await main()
