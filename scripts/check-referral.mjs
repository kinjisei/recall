/**
 * Рефералка на живой ТЕСТОВОЙ базе (PLAN.md Ф2.3; журнал п.16, 62; миграция
 * 0006_referrals.sql). Что доказывает:
 *   1. сценарий «Готово, когда»: А приглашает Б → Б включает режим по ссылке
 *      (пробный 21 день с первого ученика, потолок 27) → владелец
 *      подтверждает оплату Б → у А +1 месяц по Алматы, счётчик обновился,
 *      А пришло «Подарок за коллегу»; вторая оплата Б и повтор нажатия —
 *      второго месяца нет;
 *   2. «пригласить себя» выгоды не даёт: свой код не засчитывается; второй
 *      аккаунт на тарифе дешевле приносит дни не дороже его оплаты (Pro за
 *      Mini — 7 дней, Start за Mini — 18), и даже две оплаты одновременно —
 *      один подарок;
 *   3. у пригласившего нет тарифа — подарок ждёт и добавляется к его первой
 *      оплате (+ месяц, если коллега оплатил тариф не дешевле); «Оплата
 *      получена» называет итоговую дату;
 *   4. не засчитывается: Premium, уже репетитор, повторное включение режима,
 *      чужой код ученика, кривой и несуществующий код, заблокированный;
 *   5. подсветка подарка — после оплаты тарифа, один раз;
 *   6. закрыто: таблица приглашений, служебные функции, колонка подсветки;
 *      счётчик — только репетитору;
 *   7. правило подарка и цены в базе = копия клиента.
 *
 * Запуск: node scripts/check-referral.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { addMonthsAlmaty, PLANS } from '../src/domains/billing/model.ts'
import { referralReward } from '../src/domains/billing/referral.ts'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и подтверждает оплаты — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const PASSWORD = 'ReferralCheck!2026'
const made = []
const ms = (iso) => new Date(iso).getTime()
const same = (a, b) => a && b && Math.abs(ms(a) - ms(b)) < 1000
const DAY = 86400000
const day = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : String(iso))
const price = (id) => PLANS.find((p) => p.id === id).price

async function makeUser(tag) {
  const email = `referral-check-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'check-referral (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `Реф ${tag}` } })
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

/** Включить режим репетитора настоящим become_teacher — с кодом из ссылки или без. */
async function enable(u, ref) {
  const r = await u.client.rpc('become_teacher', ref === undefined ? {} : { p_ref: ref })
  if (r.error) throw new Error(`become_teacher: ${r.error.message}`)
}
async function teacher(tag, ref) {
  const u = await makeUser(tag)
  await enable(u, ref)
  return u
}
let owner
async function pay(u, plan, amount = price(plan), request = randomUUID()) {
  const r = await owner.client.rpc('confirm_payment', { p_user: u.id, p_plan: plan, p_months: 1, p_amount: amount, p_request: request })
  if (r.error) throw new Error(`confirm_payment: ${r.error.message}`)
  return r.data[0]
}
const prof = async (u) =>
  (await sql(`select plan, plan_expires_at, trial_until, trial_bonus_days from public.profiles where id = '${u.id}'`))[0]
const refOf = async (u) => (await sql(`select * from public.referrals where referee_id = '${u.id}'`))[0] ?? null
const stats = async (u) => (await u.client.rpc('get_my_referral')).data?.[0]
const notes = (u, kind) => sql(`select data from public.notifications where user_id = '${u.id}' and kind = '${kind}' order by created_at`)

async function run() {
  owner = await makeUser('owner')
  await sql(`update public.profiles set is_admin = true where id = '${owner.id}'`)

  // ── 1. А приглашает Б ─────────────────────────────────────────────────────
  const A = await teacher('a')
  await pay(A, 'teacher_mini')
  const zero = await stats(A)
  check('счётчик до приглашений: код есть, 0 · 0 · 0', /^[A-Z]{2,8}[2-9]{1,4}$/.test(zero?.code ?? '') && zero.invited === 0 && zero.paid === 0 && zero.reward_months === 0, JSON.stringify(zero))
  const code = zero.code

  const B = await teacher('b', code.toLowerCase())
  const rb = await refOf(B)
  check('Б по ссылке (код строчными): приглашение записано, статус registered', rb?.status === 'registered' && rb.code === code, rb?.status)
  const pb = await prof(B)
  const [{ created_at: signupB }] = await sql(`select created_at from public.teacher_signups where user_id = '${B.id}'`)
  check('Б: +7 дней пробного — потолок 27 дней от включения режима', pb.trial_bonus_days === 7 && same(pb.trial_until, new Date(ms(signupB) + 27 * DAY).toISOString()), day(pb.trial_until))
  const planB = (await B.client.rpc('get_my_plan')).data
  check('Б видит у себя «21 день с первого ученика»', planB?.trial_days === 21, String(planB?.trial_days))
  check('у А счётчик: приглашено 1, оплатили 0', (await stats(A)).invited === 1 && (await stats(A)).paid === 0)

  const beforeA = await prof(A)
  await pay(B, 'teacher_mini')
  const afterA = await prof(A)
  const wantA = addMonthsAlmaty(new Date(beforeA.plan_expires_at), 1).toISOString()
  check('оплата Б → у А +1 месяц по Алматы', same(afterA.plan_expires_at, wantA), `${day(beforeA.plan_expires_at)} → ${day(afterA.plan_expires_at)}`)
  const rb2 = await refOf(B)
  check('приглашение Б: rewarded, месяц, тариф А', rb2.status === 'rewarded' && rb2.reward_months === 1 && rb2.reward_days === 0 && rb2.reward_plan === 'teacher_mini' && rb2.referee_plan === 'teacher_mini')
  const sA = await stats(A)
  check('у А счётчик: 1 · 1 · 1 месяц, ждущих нет', sA.invited === 1 && sA.paid === 1 && sA.reward_months === 1 && sA.reward_days === 0 && sA.pending === 0, JSON.stringify(sA))
  const nA = await notes(A, 'referral_rewarded')
  check('А: одно «Подарок за коллегу» с новой датой', nA.length === 1 && nA[0].data.months === 1 && same(nA[0].data.until, afterA.plan_expires_at))

  await pay(B, 'teacher_mini')
  const again = await prof(A)
  check('вторая оплата Б — у А ничего не прибавилось', same(again.plan_expires_at, afterA.plan_expires_at))
  const req = randomUUID()
  const B2 = await teacher('b2', code)
  await pay(B2, 'teacher_mini', 3900, req)
  const once = await prof(A)
  await pay(B2, 'teacher_mini', 3900, req) // ответ потерялся — то же нажатие ещё раз
  check('повтор того же нажатия «Подтвердить» — один подарок', same((await prof(A)).plan_expires_at, once.plan_expires_at) && (await stats(A)).reward_months === 2)

  // ── 2. пригласить себя ─────────────────────────────────────────────────────
  const C = await makeUser('c')
  const own = (await C.client.rpc('get_pay_info')).data[0].code
  await enable(C, own)
  check('свой код при включении режима — не засчитан, бонуса нет', !(await refOf(C)) && (await prof(C)).trial_bonus_days === 0)
  await enable(A, code)
  check('А включает режим по своей же ссылке — ничего', !(await refOf(A)))

  const P = await teacher('p')
  await pay(P, 'teacher_pro')
  const D = await teacher('d', (await stats(P)).code)
  const beforeP = await prof(P)
  // второй аккаунт Pro-репетитора платит Mini — дважды и одновременно
  await Promise.all([pay(D, 'teacher_mini'), pay(D, 'teacher_mini')])
  const afterP = await prof(P)
  const gotDays = Math.round((ms(afterP.plan_expires_at) - ms(beforeP.plan_expires_at)) / DAY)
  const value = Math.round((gotDays * price('teacher_pro')) / 30)
  check('второй аккаунт на Mini у Pro — 7 дней, не месяц (даже две оплаты сразу — один подарок)', gotDays === 7, `${gotDays} дн. ≈ ${value} ₸ < 3 900 ₸`)
  const S = await teacher('s')
  await pay(S, 'teacher_start')
  const DS = await teacher('ds', (await stats(S)).code)
  const beforeS = await prof(S)
  await pay(DS, 'teacher_mini')
  const sDays = Math.round((ms((await prof(S)).plan_expires_at) - ms(beforeS.plan_expires_at)) / DAY)
  check('Start за коллегу на Mini — 18 дней, счётчик в днях', sDays === 18 && (await stats(S)).reward_days === 18 && (await stats(S)).reward_months === 0, `${sDays}`)

  // ── 3. у пригласившего нет тарифа ───────────────────────────────────────────
  const E = await teacher('e')
  const F = await teacher('f', (await stats(E)).code)
  const beforeE = await prof(E)
  await pay(F, 'teacher_pro')
  const midE = await prof(E)
  check('коллега оплатил, а у Е тарифа нет — тариф Е не тронут, подарок ждёт', midE.plan === 'free' && same(midE.trial_until, beforeE.trial_until) && (await refOf(F)).status === 'paid' && (await stats(E)).pending === 1)
  check('Е: «По твоей ссылке оплатили тариф»', (await notes(E, 'referral_paid')).length === 1)
  const payE = await pay(E, 'teacher_mini')
  const endE = await prof(E)
  const termE = addMonthsAlmaty(new Date(beforeE.trial_until), 1)
  check('первая оплата Е: срок оплаты — от конца пробного, +1 месяц', same(payE.ends_at, termE.toISOString()), day(payE.ends_at))
  check('…и к нему ждавший месяц (коллега на Pro ≥ Mini)', same(endE.plan_expires_at, addMonthsAlmaty(termE, 1).toISOString()) && (await refOf(F)).status === 'rewarded', day(endE.plan_expires_at))
  const paidE = await notes(E, 'plan_paid')
  check('«Оплата получена» у Е — итоговая дата, с подарком', paidE.length === 1 && same(paidE[0].data.until, endE.plan_expires_at), day(paidE[0]?.data.until))

  // ── 4. что не засчитывается ─────────────────────────────────────────────────
  const G = await teacher('g', code)
  const beforeG = await prof(A)
  await pay(G, 'premium')
  check('коллега оплатил Premium — не в счёт', (await refOf(G)).status === 'registered' && same((await prof(A)).plan_expires_at, beforeG.plan_expires_at))
  const H = await teacher('h')
  await enable(H, code)
  check('уже репетитор открыл ссылку — ничего', !(await refOf(H)) && (await prof(H)).trial_bonus_days === 0)
  const I = await teacher('i')
  await I.client.rpc('stop_teaching')
  await enable(I, code)
  check('выключил и снова включил режим по ссылке — не засчитано', !(await refOf(I)) && (await prof(I)).trial_bonus_days === 0)
  const L = await makeUser('l')
  const learnerCode = (await L.client.rpc('get_pay_info')).data[0].code
  const K = await teacher('k', learnerCode)
  check('код ученика (не репетитора) — не засчитан', !(await refOf(K)))
  const J = await teacher('j', 'ZZQQ99')
  const J2 = await teacher('j2', "x'; drop table referrals; --")
  check('несуществующий и кривой код — не засчитаны, ошибки нет', !(await refOf(J)) && !(await refOf(J2)))
  await sql(`update public.profiles set blocked = true where id = '${A.id}'`)
  const M = await teacher('m', code)
  await sql(`update public.profiles set blocked = false where id = '${A.id}'`)
  check('код заблокированного репетитора — не засчитан', !(await refOf(M)))

  // ── 5. разовая подсветка ─────────────────────────────────────────────────────
  check('подсветка: у оплатившего репетитора — да', (await A.client.rpc('referral_hint')).data === true)
  check('подсветка: у репетитора без оплаты и у ученика — нет', (await H.client.rpc('referral_hint')).data === false && (await L.client.rpc('referral_hint')).data === false)
  await A.client.rpc('dismiss_referral_hint')
  check('закрыл — больше не показывается', (await A.client.rpc('referral_hint')).data === false)

  // ── 6. закрыто ────────────────────────────────────────────────────────────────
  const read = await A.client.from('referrals').select('*')
  check('таблицу приглашений не прочитать', !!read.error || (read.data ?? []).length === 0, read.error?.message ?? 'пусто')
  const ins = await A.client.from('referrals').insert({ referrer_id: A.id, referee_id: L.id, code })
  check('и не записать', !!ins.error)
  const col = await A.client.from('profiles').select('referral_hint_seen_at').eq('id', A.id)
  check('колонку подсветки не прочитать', !!col.error)
  const calls = await Promise.all([
    A.client.rpc('attach_referral', { p_uid: L.id, p_code: code }),
    A.client.rpc('apply_referral_rewards', { p_referrer: A.id }),
    A.client.rpc('after_payment_confirmed', { p_payment: randomUUID() }),
    A.client.rpc('plan_price', { p_plan: 'teacher_pro' }),
    A.client.rpc('referral_reward', { p_referee_plan: 'teacher_pro', p_referrer_plan: 'teacher_mini' }),
  ])
  check('служебные функции закрыты (attach, apply, крючок, цены, правило)', calls.every((r) => !!r.error), calls.map((r) => (r.error ? 'закрыта' : 'ОТКРЫТА')).join(', '))
  const notT = await L.client.rpc('get_my_referral')
  check('счётчик ученику — RECALL_NOT_TEACHER', /RECALL_NOT_TEACHER/.test(notT.error?.message ?? ''))

  // ── 7. база = клиент ─────────────────────────────────────────────────────────
  const plans = ['teacher_mini', 'teacher_start', 'teacher_pro']
  const rows = await sql(`select a.p as referee, b.p as referrer, public.plan_price(a.p) as pa, r.months, r.days
    from unnest(array['teacher_mini','teacher_start','teacher_pro']) a(p)
    cross join unnest(array['teacher_mini','teacher_start','teacher_pro']) b(p)
    cross join lateral public.referral_reward(a.p, b.p) r`)
  const off = rows.filter((r) => {
    const c = referralReward(price(r.referee), price(r.referrer))
    return c.months !== r.months || c.days !== r.days || r.pa !== price(r.referee)
  })
  check('правило подарка и цены: база = клиент на всех 9 парах', rows.length === plans.length ** 2 && off.length === 0, off.map((r) => `${r.referee}→${r.referrer}`).join(', '))
}

async function cleanup() {
  const list = made.map((u) => `'${u.id}'`).join(',')
  if (list) {
    await sql(`
      delete from public.referrals where referrer_id in (${list}) or referee_id in (${list});
      delete from public.payments where user_id in (${list}) or confirmed_by in (${list});
      delete from public.events where user_id in (${list}) and name = 'payment_activated';
    `).catch((e) => console.log('уборка SQL:', e.message))
  }
  for (const u of made) await admin.auth.admin.deleteUser(u.id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', made.map((u) => u.email))
}

try {
  await run()
} catch (e) {
  check('проверка дошла до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
} finally {
  await cleanup()
  console.log('Временные аккаунты, приглашения, оплаты и события удалены.')
}
const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
