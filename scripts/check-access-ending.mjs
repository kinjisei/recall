/**
 * Напоминание о конце тарифа и пробного на живой ТЕСТОВОЙ базе (PLAN.md Ф2.4;
 * журнал п.36; архитектура §17; миграция 0007_access_ending.sql).
 *
 * Что доказывает:
 *   1. конец завтра → ровно ОДНО уведомление (вид, ключ «access_end:дата»,
 *      дата окончания, ссылка на «Как оплатить»); повторный прогон, вечер
 *      того же дня и сдвиг конца в пределах дня — ноль новых;
 *   2. не раньше и не позже: за два дня, в сам день окончания, после него и
 *      накануне до 10:00 по Алматы — ничего;
 *   3. тариф и пробный — одно правило: оплатил на пробном — у прежней даты
 *      ничего, у новой — одно «тариф закончится завтра» с тарифом;
 *   4. самоучке с Premium — да; ученику на пробном, ученику в студии
 *      репетитора, ученику о тарифе его репетитора, заблокированному и
 *      репетитору о его Premium — ничего;
 *   5. правило в реестре будильника и работает от настоящих часов;
 *   6. клиент = сервер: копия правила (accessEnd) совпадает с access_end, а
 *      плашка «закончился» видна ровно тогда, когда база запрещает запись;
 *   7. вошедший не будит правило и не зовёт служебное.
 *
 * Будильник тестовой базы тоже работает (pg_cron раз в 5 минут), поэтому
 * основные случаи — через notify_access_ending(p_now) с концом через 5 дней:
 * от настоящих часов их «завтра» во время прогона не наступит.
 *
 * Запуск: node scripts/check-access-ending.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { accessEnd, accessEndedNotice } from '../src/domains/billing/model.ts'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и двигает их даты — только тестовая база.')
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

const PASSWORD = 'AccessEnd!2026'
const made = []

async function makeUser(tag) {
  const email = `access-end-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'check-access-ending (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `Конец ${tag}` },
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

// ---- время по Алматы (UTC+5 круглый год) ------------------------------------------
const ALMATY_MS = 5 * 3600_000
/** Момент: день момента `base` + `days`, время hh:mm по Алматы. */
function almaty(base, days, hh, mm = 0) {
  const local = new Date(new Date(base).getTime() + ALMATY_MS)
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, hh, mm) - ALMATY_MS,
  ).toISOString()
}
const ymd = (ts) => new Date(new Date(ts).getTime() + ALMATY_MS).toISOString().slice(0, 10)
const same = (a, b) => new Date(a).getTime() === new Date(b).getTime()

/** Репетитор без учеников, чей пробный кончается ровно в `end` (включение = end − 20 дней). */
async function teacherEndingAt(tag, end) {
  const u = await makeUser(tag)
  const r = await u.client.rpc('become_teacher')
  if (r.error) throw new Error(`become_teacher: ${r.error.message}`)
  await setTrialEnd(u.id, end)
  return u
}
async function setTrialEnd(id, end) {
  await sql(`update public.teacher_signups set created_at = '${end}'::timestamptz - interval '20 days' where user_id = '${id}'`)
  await sql(`select public.recompute_teacher_trial('${id}')`)
  const [{ t }] = await sql(`select trial_until as t from public.profiles where id = '${id}'`)
  if (!same(t, end)) throw new Error(`пробный не встал на ${end}: ${t}`)
}

const runAt = async (iso) => Number((await sql(`select public.notify_access_ending('${iso}') as n`))[0].n)
const mine = (id) =>
  sql(`select kind, dedupe_key, data from public.notifications
        where user_id = '${id}' and kind in ('plan_ending', 'trial_ending') order by created_at`)
const count = async (id) => (await mine(id)).length

async function run() {
  // конец — через 5 дней в 15:00 по Алматы: от настоящих часов будильник
  // тестовой базы его «завтра» за время прогона не увидит
  const E = almaty(new Date(), 5, 15)
  const eve = (h, m = 0) => almaty(E, -1, h, m)

  // ── 1. ровно одно ─────────────────────────────────────────────────────────────
  const t1 = await teacherEndingAt('t1', E)
  const s1 = await makeUser('s1') // ученик t1: о тарифе своего репетитора — ничего
  await sql(`insert into public.teacher_students (teacher_id, student_id) values ('${t1.id}', '${s1.id}')`)
  await setTrialEnd(t1.id, E) // привязка пересчитала пробный — возвращаем конец на место

  await runAt(eve(9, 55))
  check('накануне до 10:00 по Алматы — ничего (ночью не будим)', (await count(t1.id)) === 0)
  await runAt(eve(10))
  const [n1] = await mine(t1.id)
  check('накануне в 10:00 — ровно одно уведомление', (await count(t1.id)) === 1)
  check(
    'это «пробный закончится завтра»: ключ — дата окончания, дата, ссылка на «Как оплатить»',
    n1?.kind === 'trial_ending' && n1?.dedupe_key === `access_end:${ymd(E)}` && same(n1?.data?.until, E) && n1?.data?.href === '/pay',
    JSON.stringify(n1),
  )
  const again = await runAt(eve(10))
  check('повторный прогон — ноль новых', again === 0 && (await count(t1.id)) === 1, `создано ${again}`)
  await runAt(eve(23, 55))
  check('вечером того же дня — ноль новых', (await count(t1.id)) === 1)
  await setTrialEnd(t1.id, almaty(E, 0, 17)) // конец сдвинулся на 2 часа — тот же день
  await runAt(eve(12))
  check('конец сдвинулся в пределах дня — ключ тот же, нового нет', (await count(t1.id)) === 1)
  check('ученику о тарифе его репетитора — ничего', (await count(s1.id)) === 0)

  // ── 2. не раньше и не позже ────────────────────────────────────────────────────
  const t2 = await teacherEndingAt('t2', E)
  await runAt(almaty(E, -2, 12))
  check('за два дня — рано, ничего', (await count(t2.id)) === 0)
  await runAt(almaty(E, 0, 12))
  check('в сам день окончания (до 15:00) — уже не «завтра», ничего', (await count(t2.id)) === 0)
  await runAt(almaty(E, 1, 12))
  check('после окончания — ничего', (await count(t2.id)) === 0)
  await runAt(eve(12))
  check('а накануне — одно (случай настоящий)', (await count(t2.id)) === 1)

  // ── 3. тариф и пробный — одно правило ───────────────────────────────────────────
  // тот же пробный, что у t2, но оплачен до вечера накануне — как после
  // confirm_payment на пробном: срок — от конца пробного
  const P = almaty(E, 31, 15)
  const t8 = await teacherEndingAt('t8', E)
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = '${P}' where id = '${t8.id}'`)
  await runAt(eve(12))
  check('оплатил на пробном — у даты конца пробного ничего (у t2 там одно)', (await count(t8.id)) === 0)
  await runAt(almaty(P, -1, 12))
  const [n2] = await mine(t8.id)
  check(
    'накануне конца тарифа — одно «тариф закончится завтра» с тарифом и датой',
    (await count(t8.id)) === 1 && n2?.kind === 'plan_ending' && n2?.data?.plan === 'teacher_mini' && same(n2?.data?.until, P) && n2?.dedupe_key === `access_end:${ymd(P)}`,
    JSON.stringify(n2),
  )
  await runAt(almaty(P, -1, 18))
  check('и его повтор — ноль новых', (await count(t8.id)) === 1)
  // продлили ещё раз — новая дата, новый цикл; старое не повторяется
  const P2 = almaty(P, 30, 15)
  await sql(`update public.profiles set plan_expires_at = '${P2}' where id = '${t8.id}'`)
  await runAt(almaty(P2, -1, 12))
  await runAt(almaty(P2, -1, 13))
  check('продлили — у новой даты своё одно, всего два', (await count(t8.id)) === 2)

  // ── 4. кому — да, кому — нет ────────────────────────────────────────────────────
  const l1 = await makeUser('l1')
  await sql(`update public.profiles set plan = 'premium', plan_expires_at = '${E}' where id = '${l1.id}'`)
  const l2 = await makeUser('l2')
  await sql(`update public.profiles set trial_until = '${E}' where id = '${l2.id}'`)
  // ученик в студии: его Premium кончается, но покрывает тариф репетитора
  const t3 = await teacherEndingAt('t3', almaty(new Date(), 15, 15))
  const l3 = await makeUser('l3')
  await sql(`update public.profiles set plan = 'premium', plan_expires_at = '${E}' where id = '${l3.id}'`)
  await sql(`insert into public.teacher_students (teacher_id, student_id) values ('${t3.id}', '${l3.id}')`)
  const [{ cov }] = await sql(`select public.covering_teacher('${l3.id}') as cov`)
  const t4 = await teacherEndingAt('t4', E)
  await sql(`update public.profiles set blocked = true where id = '${t4.id}'`)
  const t5 = await teacherEndingAt('t5', almaty(new Date(), -10, 15)) // пробный давно кончился
  await sql(`update public.profiles set plan = 'premium', plan_expires_at = '${E}' where id = '${t5.id}'`)
  await runAt(eve(12))
  const [p1] = await mine(l1.id)
  check(
    'самоучке с Premium — одно «тариф закончится завтра» про Premium',
    (await count(l1.id)) === 1 && p1?.kind === 'plan_ending' && p1?.data?.plan === 'premium' && same(p1?.data?.until, E),
    JSON.stringify(p1),
  )
  check('ученику на пробном — ничего (пробный ученика не в счёт)', (await count(l2.id)) === 0)
  check('ученику в студии репетитора — ничего: его держит студия', cov === t3.id && (await count(l3.id)) === 0, `покрывает: ${cov}`)
  check('заблокированному — ничего', (await count(t4.id)) === 0)
  check('репетитору конец Premium — не повод (расписание Premium не открывает)', (await count(t5.id)) === 0)

  // ── 5. будильник: реестр и настоящие часы ─────────────────────────────────────────
  const [rule] = await sql(`select fn, enabled from public.notification_rules where name = 'access_ending'`)
  check('правило в реестре будильника и включено', rule?.fn === 'public.rule_access_ending' && rule?.enabled === true, JSON.stringify(rule))
  const t6 = await teacherEndingAt('t6', almaty(new Date(), 1, 15)) // по-настоящему завтра
  const [{ r }] = await sql('select public.run_notification_rules() as r')
  const hour = new Date(Date.now() + ALMATY_MS).getUTCHours()
  check('будильник прогнал правило без ошибки', typeof r?.access_ending === 'number', JSON.stringify(r))
  check(
    hour >= 10 ? 'от настоящих часов (после 10:00) — одно уведомление' : 'от настоящих часов (до 10:00) — ещё ничего',
    (await count(t6.id)) === (hour >= 10 ? 1 : 0),
    `сейчас ${hour} ч по Алматы`,
  )
  await sql('select public.run_notification_rules()')
  check('второй прогон будильника — ноль новых', (await count(t6.id)) === (hour >= 10 ? 1 : 0))

  // ── 6. клиент = сервер ─────────────────────────────────────────────────────────────
  const cases = [
    ['teacher', 'free', null, E],
    ['teacher', 'teacher_mini', P, E],
    ['teacher', 'teacher_start', almaty(E, -3, 10), E],
    ['teacher', 'teacher_pro', E, E],
    ['teacher', 'premium', P, E],
    ['teacher', 'teacher_pro', P, null],
    ['teacher', 'free', null, null],
    ['learner', 'premium', E, P],
    ['learner', 'free', null, E],
    ['learner', 'teacher_mini', E, null],
    [null, 'premium', E, null],
  ]
  const lit = (v) => (v === null ? 'null' : `'${v}'`)
  const server = await sql(`
    select v.i, a.ends_at, a.source
      from (values ${cases.map((c, i) => `(${i}, ${lit(c[0])}, ${lit(c[1])}, ${lit(c[2])}::timestamptz, ${lit(c[3])}::timestamptz)`).join(', ')})
           as v(i, role, plan, ex, tr)
     cross join lateral public.access_end(v.role, v.plan, v.ex, v.tr) a
     order by v.i`)
  const diff = cases.filter((c, i) => {
    const s = server[i]
    const cl = accessEnd(c[0], { plan: c[1], plan_expires_at: c[2], trial_until: c[3] })
    return (cl?.source ?? null) !== (s?.source ?? null) || (cl ? !same(cl.until, s.ends_at) : s?.ends_at !== null)
  })
  check(`копия правила на клиенте = access_end в базе (${cases.length} случаев)`, diff.length === 0, JSON.stringify(diff))

  // плашка и запрет записи — в один момент (get_my_plan: тариф и can_write)
  const t7 = await teacherEndingAt('t7', almaty(new Date(), -2, 15))
  const ended = (await t7.client.rpc('get_my_plan')).data
  check(
    'пробный кончился: плашка «Пробный период закончился» и запись запрещена',
    accessEndedNotice('teacher', ended)?.source === 'trial' && ended?.can_write === false,
    `can_write ${ended?.can_write}`,
  )
  const live = (await t2.client.rpc('get_my_plan')).data
  check('пробный идёт: плашки нет и писать можно', accessEndedNotice('teacher', live) === null && live?.can_write === true)
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '30 days' where id = '${t7.id}'`)
  const renewed = (await t7.client.rpc('get_my_plan')).data
  check('продлили — плашка ушла, писать снова можно', accessEndedNotice('teacher', renewed) === null && renewed?.can_write === true)
  await sql(`update public.profiles set plan_expires_at = now() - interval '1 hour' where id = '${t7.id}'`)
  const lapsed = (await t7.client.rpc('get_my_plan')).data
  check(
    'тариф кончился — «Тариф закончился · Репетитор Mini» и запись запрещена',
    accessEndedNotice('teacher', lapsed)?.body.startsWith('Репетитор Mini · до ') && lapsed?.can_write === false,
    accessEndedNotice('teacher', lapsed)?.body,
  )
  const lp = (await l1.client.rpc('get_my_plan')).data
  await sql(`update public.profiles set plan_expires_at = now() - interval '1 hour' where id = '${l1.id}'`)
  const lpEnded = (await l1.client.rpc('get_my_plan')).data
  check(
    'самоучке: Premium идёт — плашки нет, кончился — «Premium · до …»',
    accessEndedNotice('learner', lp) === null && accessEndedNotice('learner', lpEnded)?.body.startsWith('Premium · до '),
  )
  await sql(`update public.profiles set plan_expires_at = now() - interval '1 hour' where id = '${l3.id}'`)
  const lc = (await l3.client.rpc('get_my_plan')).data
  check('ученику в студии, чей Premium кончился, — плашки нет', lc?.in_studio === true && accessEndedNotice('learner', lc) === null, `in_studio ${lc?.in_studio}`)

  // ── 7. права ───────────────────────────────────────────────────────────────────────
  for (const [fn, args] of [
    ['notify_access_ending', { p_now: almaty(P, -1, 12) }],
    ['rule_access_ending', {}],
    ['access_end', { p_role: 'teacher', p_plan: 'free', p_expires: null, p_trial: E }],
  ]) {
    check(`служебная ${fn} закрыта для вошедшего`, !!(await t1.client.rpc(fn, args)).error)
  }
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
