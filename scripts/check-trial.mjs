/**
 * Пробный период репетитора и запись без тарифа на живой ТЕСТОВОЙ базе
 * (PLAN.md Ф2.2; журнал п.14, 40, 41, 60; миграция 0005_teacher_trial.sql).
 *
 * «День N» — от включения режима репетитора (teacher_signups.created_at).
 * Что доказывает:
 *   1. нет учеников → конец на 20-й день; первый ученик на 3-й день → на 17-й;
 *      на 10-й → на 20-й (потолок); по реферальной ссылке (+7) — 27, 24, 27;
 *   2. отсчёт запускает настоящая привязка по коду (join_teacher); второй
 *      ученик, отвязка и повторная привязка пробный не трогают; выключил и
 *      снова включил режим — пробный не начинается заново;
 *   3. ученик — по-прежнему 14 дней с регистрации; ученик, ставший
 *      репетитором через месяц, получает пробный от включения режима;
 *   4. после окончания запись отклоняется понятным кодом
 *      (RECALL_PLAN_REQUIRED), с тарифом репетитора — разрешена, Premium не в
 *      счёт; ученику — RECALL_NOT_TEACHER, заблокированному — RECALL_BLOCKED;
 *   5. клиент видит своё (get_my_plan: trial_started, trial_days, can_write)
 *      и не видит и не пишет служебное: колонки пробного, чужой «можно ли»,
 *      пересчёт;
 *   6. уже существующие репетиторы получили дату первого ученика.
 *
 * Запуск: node scripts/check-trial.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'

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

const PASSWORD = 'TrialCheck!2026'
const made = []

async function makeUser(tag) {
  const email = `trial-check-${tag}@recall.test`
  await admin.from('allowed_emails').upsert({ email, note: 'check-trial (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `Проверка ${tag}` },
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

/** Репетитор, включивший режим `daysAgo` дней назад (настоящий become_teacher). */
async function teacher(tag, { daysAgo = 0, bonus = 0 } = {}) {
  const u = await makeUser(tag)
  const r = await u.client.rpc('become_teacher')
  if (r.error) throw new Error(`become_teacher: ${r.error.message}`)
  if (daysAgo) await sql(`update public.teacher_signups set created_at = now() - interval '${daysAgo} days' where user_id = '${u.id}'`)
  // бонус — как поставит рефералка (Ф2.3); триггер пересчитывает сам. Без
  // бонуса пересчёт после сдвига даты — тем же путём, что и в базе
  if (bonus) await sql(`update public.profiles set trial_bonus_days = ${bonus} where id = '${u.id}'`)
  else if (daysAgo) await sql(`select public.recompute_teacher_trial('${u.id}')`)
  return u
}

/** Сколько дней от включения режима до конца пробного. */
async function trialDay(id) {
  const [r] = await sql(`
    select extract(epoch from (p.trial_until - ts.created_at)) / 86400 as d
      from public.profiles p join public.teacher_signups ts on ts.user_id = p.id
     where p.id = '${id}'`)
  return Math.round(Number(r?.d) * 1000) / 1000
}
const link = (t, s) => sql(`insert into public.teacher_students (teacher_id, student_id) values ('${t}', '${s}')`)
const profile = async (id) => (await sql(`select trial_until, first_student_at, role from public.profiles where id = '${id}'`))[0]
const code = (r) => r.error?.message ?? 'ok'

async function run() {
  const s1 = await makeUser('s1')
  const s2 = await makeUser('s2')

  // ── 1. правило ─────────────────────────────────────────────────────────────
  const a = await teacher('a')
  check('нет учеников → конец на 20-й день', (await trialDay(a.id)) === 20, `день ${await trialDay(a.id)}`)

  // день 3 — настоящая привязка по коду
  const b = await teacher('b', { daysAgo: 3 })
  const inv = await b.client.rpc('ensure_invite_code')
  const joined = await s1.client.rpc('join_teacher', { code: inv.data })
  check('ученик привязался по коду', !joined.error, code(joined))
  check('первый ученик на 3-й день → конец на 17-й', Math.abs((await trialDay(b.id)) - 17) < 0.01, `день ${await trialDay(b.id)}`)

  const c = await teacher('c', { daysAgo: 10 })
  await link(c.id, s1.id)
  check('первый ученик на 10-й день → конец на 20-й (потолок)', (await trialDay(c.id)) === 20, `день ${await trialDay(c.id)}`)

  const r0 = await teacher('r0', { bonus: 7 })
  check('по рефералке, нет учеников → 27-й день', (await trialDay(r0.id)) === 27, `день ${await trialDay(r0.id)}`)
  const r3 = await teacher('r3', { daysAgo: 3, bonus: 7 })
  await link(r3.id, s1.id)
  check('по рефералке, первый ученик на 3-й день → 24-й (21 день с ученика)', Math.abs((await trialDay(r3.id)) - 24) < 0.01, `день ${await trialDay(r3.id)}`)
  const r10 = await teacher('r10', { daysAgo: 10, bonus: 7 })
  await link(r10.id, s1.id)
  check('по рефералке, первый ученик на 10-й день → 27-й (потолок)', (await trialDay(r10.id)) === 27, `день ${await trialDay(r10.id)}`)

  // ── 2. что пробный НЕ трогает ──────────────────────────────────────────────
  const before = await profile(b.id)
  await link(b.id, s2.id)
  check('второй ученик пробный не меняет', (await profile(b.id)).trial_until === before.trial_until)
  await sql(`delete from public.teacher_students where teacher_id = '${b.id}'`)
  await link(b.id, s1.id)
  const relinked = await profile(b.id)
  check('отвязал всех и привязал снова — пробный тот же', relinked.trial_until === before.trial_until && relinked.first_student_at === before.first_student_at)

  const e = await teacher('e', { daysAgo: 25 })
  const eEnd = (await profile(e.id)).trial_until
  check('режим включён 25 дней назад без учеников — пробный кончился', new Date(eEnd).getTime() < Date.now())
  const stop = await e.client.rpc('stop_teaching')
  const again = await e.client.rpc('become_teacher')
  const e2 = await profile(e.id)
  check('выключил и снова включил режим — пробный не начался заново', !stop.error && !again.error && e2.role === 'teacher' && e2.trial_until === eEnd, `${code(stop)} / ${code(again)}`)

  // ── 3. ученики ──────────────────────────────────────────────────────────────
  const l = await makeUser('l')
  const [lt] = await sql(`select extract(epoch from (trial_until - created_at)) / 86400 as d from public.profiles where id = '${l.id}'`)
  check('ученик — 14 дней с регистрации, как раньше', Math.abs(Number(lt.d) - 14) < 0.01, `дней ${Number(lt.d).toFixed(3)}`)
  const late = await makeUser('late')
  await sql(`update public.profiles set created_at = now() - interval '40 days', trial_until = now() - interval '26 days' where id = '${late.id}'`)
  await late.client.rpc('become_teacher')
  const lateDay = await trialDay(late.id)
  check('ученик стал репетитором через 40 дней — пробный от включения режима (20 дней)', lateDay === 20, `день ${lateDay}`)

  // ── 4. запись без тарифа ─────────────────────────────────────────────────────
  const denied = await e.client.rpc('assert_teacher_can_write')
  check('пробный кончился, тарифа нет → отказ RECALL_PLAN_REQUIRED', /RECALL_PLAN_REQUIRED/.test(code(denied)), code(denied))
  const eplan = await e.client.rpc('get_my_plan')
  check('get_my_plan: can_write = false', eplan.data?.can_write === false)
  await sql(`update public.profiles set plan = 'premium', plan_expires_at = now() + interval '10 days' where id = '${e.id}'`)
  check('Premium запись в расписание не открывает', /RECALL_PLAN_REQUIRED/.test(code(await e.client.rpc('assert_teacher_can_write'))))
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() + interval '10 days' where id = '${e.id}'`)
  const paid = await e.client.rpc('assert_teacher_can_write')
  check('с тарифом репетитора запись разрешена', !paid.error, code(paid))
  check('get_my_plan: can_write = true', (await e.client.rpc('get_my_plan')).data?.can_write === true)
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = now() - interval '1 day' where id = '${e.id}'`)
  check('тариф истёк — снова отказ', /RECALL_PLAN_REQUIRED/.test(code(await e.client.rpc('assert_teacher_can_write'))))
  check('на пробном запись разрешена', !(await a.client.rpc('assert_teacher_can_write')).error)
  check('ученику — RECALL_NOT_TEACHER', /RECALL_NOT_TEACHER/.test(code(await l.client.rpc('assert_teacher_can_write'))))
  await sql(`update public.profiles set blocked = true where id = '${c.id}'`)
  check('заблокированному — RECALL_BLOCKED', /RECALL_BLOCKED/.test(code(await c.client.rpc('assert_teacher_can_write'))))
  const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  check('без входа — отказ', !!(await anon.rpc('assert_teacher_can_write')).error)

  // ── 5. что видит клиент ──────────────────────────────────────────────────────
  const pa = (await a.client.rpc('get_my_plan')).data
  const pb = (await b.client.rpc('get_my_plan')).data
  const pr = (await r0.client.rpc('get_my_plan')).data
  check('get_my_plan: до первого ученика отсчёт не пошёл, 14 дней', pa?.trial_started === false && pa?.trial_days === 14 && pa?.can_write === true)
  check('get_my_plan: после первого ученика отсчёт пошёл', pb?.trial_started === true)
  check('get_my_plan: по рефералке — 21 день', pr?.trial_days === 21)
  for (const [fn, args] of [
    ['teacher_can_write', { p_uid: b.id }],
    ['recompute_teacher_trial', { p_uid: b.id }],
    ['teacher_trial_end', { p_since: new Date().toISOString(), p_first: null, p_bonus: 0 }],
  ]) {
    check(`служебная ${fn} закрыта для вошедшего`, !!(await a.client.rpc(fn, args)).error)
  }
  const read = await a.client.from('profiles').select('first_student_at, trial_bonus_days').eq('id', a.id)
  check('колонки пробного клиенту не видны', !!read.error)
  const write = await a.client.from('profiles').update({ trial_bonus_days: 60 }).eq('id', a.id).select('id')
  const [{ bonus }] = await sql(`select trial_bonus_days as bonus from public.profiles where id = '${a.id}'`)
  check('бонус пробного себе не поставить', (!!write.error || (write.data ?? []).length === 0) && bonus === 0, code(write))

  // ── 6. уже существующие репетиторы ─────────────────────────────────────────────
  const [{ n }] = await sql(`
    select count(*)::int as n from public.profiles p
     where exists (select 1 from public.teacher_students ts where ts.teacher_id = p.id)
       and p.first_student_at is distinct from (select min(created_at) from public.teacher_students ts where ts.teacher_id = p.id)
       and p.id not in (${made.map((m) => `'${m.id}'`).join(',')})`)
  check('у существующих репетиторов с учениками дата первого ученика проставлена', n === 0, `расхождений: ${n}`)

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
