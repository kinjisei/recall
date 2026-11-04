/**
 * Лимит замен упражнений в самой базе (PLAN.md Ф2.25-4а, миграция 0019;
 * журнал п.76 (22), (24)): spend_exercise_swap и my_exercise_swaps от имени
 * учителей и ученика, как из браузера.
 *
 *   • новый учитель — 25 замен, из них 5 сильных; списание — минус одна;
 *   • сильных не больше 5: 6-я — RECALL_SWAP_STRONG_LIMIT, а лёгкая ещё
 *     проходит; всего не больше 25: 26-я — RECALL_SWAP_LIMIT;
 *   • чужие замены не считаются; возврат (refund_ai_call) возвращает замену;
 *   • сутки — календарный день по Алматы: вчерашние (до полуночи по
 *     Алматы) не считаются, сегодняшние — считаются;
 *   • ученик — RECALL_NOT_TEACHER; учитель без тарифа и пробного —
 *     RECALL_PLAN_REQUIRED; p_strong пустой — RECALL_BAD_SWAP; часовой
 *     потолок — RECALL_RATE_HOUR.
 *
 * Краснеет без 0019 (функций нет) и если лимиты или сутки поменять.
 * Запуск: node scripts/check-exercise-swaps.mjs   (только тестовая база)
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и тратит замены — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}
const refused = (r, code) => !!r.error && String(r.error.message).includes(code)
const why = (r) => (r.error ? r.error.message : JSON.stringify(r.data))

const PASSWORD = 'SwapCheck!2026'
const users = []
async function user(key, patch) {
  const email = `swap-check-${key}@recall.test`
  const old = await sql(`select id from auth.users where email = '${email}'`)
  if (old[0]) await deleteTestUser(admin, sql, old[0].id)
  await admin.from('allowed_emails').upsert({ email, note: 'check-exercise-swaps (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(`аккаунт: ${error.message}`)
  users.push({ id: data.user.id, email })
  if (patch) await admin.from('profiles').update(patch).eq('id', data.user.id)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)
  return { id: data.user.id, client }
}

const spend = (u, strong, nonce = randomUUID()) => u.client.rpc('spend_exercise_swap', { p_nonce: nonce, p_strong: strong })
const left = async (u) => {
  const r = await u.client.rpc('my_exercise_swaps')
  const row = Array.isArray(r.data) ? r.data[0] : r.data
  return r.error ? `ошибка: ${r.error.message}` : `${row?.swaps_left}/${row?.strong_left}`
}
const row = (r) => (Array.isArray(r.data) ? r.data[0] : r.data)
/** Прошлые замены напрямую в журнал: n строк вида kind с временем when (SQL-выражение). */
const putSwaps = (u, n, kind, when) =>
  n > 0 && sql(`insert into public.ai_calls (user_id, kind, cost_energy, is_generation, swap, called_at)
                select '${u.id}', 'heavy', 0, false, '${kind}', ${when} from generate_series(1, ${n})`)

try {
  const t = await user('teacher', { role: 'teacher' })
  const t2 = await user('teacher2', { role: 'teacher' })
  const s = await user('student')
  const [can] = await sql(`select public.teacher_can_write('${t.id}') as t1, public.teacher_can_write('${t2.id}') as t2`)
  if (!can?.t1 || !can?.t2) throw new Error('новый учитель без пробного — проверке нечего проверять (teacher_can_write)')

  // ---- сутки — по Алматы ---------------------------------------------------
  const [mid] = await sql(`select to_char(public.recall_day_start() at time zone 'Asia/Almaty', 'HH24:MI') as hm`)
  check('сутки начинаются в 00:00 по Алматы', mid?.hm === '00:00', mid?.hm)

  // ---- новый учитель, списание ---------------------------------------------
  check('новый учитель — 25 замен, из них 5 сильных', (await left(t)) === '25/5', await left(t))
  const one = await spend(t, false)
  check('лёгкая замена — осталось 24, сильных 5', !one.error && row(one)?.swaps_left === 24 && row(one)?.strong_left === 5, why(one))
  check('счётчик экрана видит то же', (await left(t)) === '24/5', await left(t))

  // ---- сильных до 5 --------------------------------------------------------
  for (let i = 0; i < 4; i++) await spend(t, true)
  const fifth = await spend(t, true)
  check('пятая сильная проходит — сильных 0', !fifth.error && row(fifth)?.strong_left === 0, why(fifth))
  check('шестая сильная — RECALL_SWAP_STRONG_LIMIT', refused(await spend(t, true), 'RECALL_SWAP_STRONG_LIMIT'))
  const lightAfter = await spend(t, false)
  check('…а лёгкая ещё проходит', !lightAfter.error && row(lightAfter)?.swaps_left === 18, why(lightAfter))

  // ---- всего до 25 -----------------------------------------------------------
  await putSwaps(t, 17, 'light', 'now()')
  const last = await spend(t, false)
  check('25-я проходит — осталось 0', !last.error && row(last)?.swaps_left === 0 && row(last)?.strong_left === 0, why(last))
  check('26-я — RECALL_SWAP_LIMIT', refused(await spend(t, false), 'RECALL_SWAP_LIMIT'))
  check('счётчик экрана — 0/0', (await left(t)) === '0/0', await left(t))

  // ---- чужие не считаются, возврат -----------------------------------------
  check('у другого учителя свои 25 — чужие не считаются', (await left(t2)) === '25/5', await left(t2))
  const nonce = randomUUID()
  const taken = await spend(t2, true, nonce)
  check('замена другого учителя списалась', !taken.error && (await left(t2)) === '24/4', why(taken))
  const back = await t2.client.rpc('refund_ai_call', { p_nonce: nonce })
  check('возврат по номеру — замена вернулась', back.data === true && (await left(t2)) === '25/5', `${why(back)} → ${await left(t2)}`)
  check('чужой номер возврата замену не трогает', (await t.client.rpc('refund_ai_call', { p_nonce: nonce })).data !== true && (await left(t)) === '0/0')

  // ---- граница суток по Алматы ----------------------------------------------
  await putSwaps(t2, 3, 'strong', `public.recall_day_start() - interval '1 minute'`)
  await putSwaps(t2, 2, 'light', `public.recall_day_start() + interval '1 minute'`)
  check('вчерашние (до полуночи по Алматы) не считаются, сегодняшние — да', (await left(t2)) === '23/5', await left(t2))

  // ---- права и аргументы ------------------------------------------------------
  check('ученик — RECALL_NOT_TEACHER', refused(await spend(s, false), 'RECALL_NOT_TEACHER'))
  await sql(`update public.profiles set trial_until = now() - interval '1 day', plan = 'free', plan_expires_at = null where id = '${t2.id}'`)
  const [ended] = await sql(`select public.teacher_can_write('${t2.id}') as ok`)
  check('учитель без тарифа и пробного — RECALL_PLAN_REQUIRED', !ended?.ok && refused(await spend(t2, false), 'RECALL_PLAN_REQUIRED'), `teacher_can_write: ${ended?.ok}`)
  check('p_strong пустой — RECALL_BAD_SWAP', refused(await t.client.rpc('spend_exercise_swap', { p_nonce: randomUUID(), p_strong: null }), 'RECALL_BAD_SWAP'))
  const bad = await t.client.rpc('spend_exercise_swap', { p_nonce: 'не номер', p_strong: false })
  check('кривой номер — не падает (замен у него и так 0: RECALL_SWAP_LIMIT)', refused(bad, 'RECALL_SWAP_LIMIT'), why(bad))

  // ---- часовой потолок ---------------------------------------------------------
  const t3 = await user('teacher3', { role: 'teacher' })
  const [cap] = await sql(`select case when public.has_paid_access('${t3.id}') then 200 when public.has_premium_access('${t3.id}') then 90 else 40 end as n`)
  await sql(`insert into public.ai_calls (user_id, kind, cost_energy, is_generation, called_at)
             select '${t3.id}', 'heavy', 0, false, now() - interval '10 minutes' from generate_series(1, ${cap.n})`)
  check(`часовой потолок (${cap.n} вызовов за час) — RECALL_RATE_HOUR`, refused(await spend(t3, false), 'RECALL_RATE_HOUR'))
} catch (e) {
  check(`сбой: ${e.message}`, false)
} finally {
  for (const u of users) {
    await deleteTestUser(admin, sql, u.id).catch((e) => console.log(`  ⚠ ${e.message}`))
    await admin.from('allowed_emails').delete().eq('email', u.email)
  }
}
const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
