/**
 * Журнал вызовов AI на живой ТЕСТОВОЙ базе (PLAN.md Ф1.6;
 * supabase/migrations/0003_ai_call_log.sql).
 *
 * Что доказывает:
 *   1. у вызова видны модель, итог, задержка и попытки — по номеру списания,
 *      строка одна на вызов (повтор не пишет второй);
 *   2. писать может только владелец номера и только свежего (10 минут):
 *      чужой, выдуманный, кривой, старый номер — мимо;
 *   3. без ответа итог и возврат идут одним вызовом: строка ai_calls
 *      удалена, энергия вернулась;
 *   4. мусор в попытках не доезжает до сводки: лишние поля, не-объекты,
 *      нечисловое время, больше 20 штук;
 *   5. журнал хранит 40 дней;
 *   6. читать журнал напрямую не может никто, писать — тоже; сводки — только
 *      владельцу; невошедший не зовёт ничего;
 *   7. consume_ai_quota в базе больше нет.
 *
 * Запуск: node scripts/check-ai-log.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и старит строки журнала — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const target = dbTarget([])
const sql = (q) => runSql(target, q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

const PASSWORD = 'AiLogCheck!2026'
const USERS = { a: 'ailog-check-a@recall.test', b: 'ailog-check-b@recall.test', boss: 'ailog-check-boss@recall.test' }

async function makeUser(email) {
  await admin.from('allowed_emails').upsert({ email, note: 'check-ai-log (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
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

/** Списание как у сервера: свой номер на каждый вызов. */
async function spend(user, kind = 'light', cost = 0) {
  const nonce = randomUUID()
  const { error } = await user.client.rpc('spend_energy', { p_kind: kind, p_cost: cost, p_generation: false, p_nonce: nonce })
  if (error) throw new Error(`spend_energy: ${error.message}`)
  return nonce
}

const log = (user, nonce, over = {}) =>
  user.client.rpc('log_ai_call', {
    p_nonce: nonce,
    p_task: 'word',
    p_tier: 'lite',
    p_model: 'openai/gpt-oss-20b',
    p_status: 'ok',
    p_latency_ms: 320,
    p_attempts: [{ model: 'openai/gpt-oss-20b', status: 'ok', ms: 300 }],
    ...over,
  })

const rowsOf = async (nonce) => sql(`select * from public.ai_call_log where call_token = '${nonce}'`)
const callExists = async (nonce) =>
  (await sql(`select count(*)::int as n from public.ai_calls where refund_token = '${nonce}'`))[0].n > 0

async function run(a, b, boss) {
  // ── 1. модель, итог, задержка, попытки; одна строка на вызов ─────────────────
  const n1 = await spend(a)
  const first = await log(a, n1)
  const [r1] = await rowsOf(n1)
  check('итог записан: вызов виден с моделью и итогом', first.data === true && r1?.model === 'openai/gpt-oss-20b' && r1.status === 'ok', JSON.stringify(first.error ?? r1))
  check('задача, уровень, задержка и попытки — на месте',
    r1?.task === 'word' && r1.tier === 'lite' && r1.latency_ms === 320 && r1.attempts?.[0]?.status === 'ok' && r1.attempts[0].ms === 300,
    JSON.stringify(r1))
  check('строка журнала — на владельца списания', r1?.user_id === a.id)
  await log(a, n1, { p_status: 'failed', p_model: null })
  const again = await rowsOf(n1)
  check('повтор с тем же номером не пишет вторую строку и не переписывает первую', again.length === 1 && again[0].status === 'ok', JSON.stringify(again))

  // ── 2. писать — только владелец свежего номера ─────────────────────────────
  const n2 = await spend(a)
  const foreign = await log(b, n2)
  check('чужой номер: мимо (другой человек не пишет в чужой вызов)', foreign.data === false && (await rowsOf(n2)).length === 0, JSON.stringify(foreign))
  const invented = await log(a, randomUUID())
  check('выдуманный номер: мимо', invented.data === false)
  const crooked = await log(a, 'не-номер')
  check('кривой номер: мимо, без ошибки', crooked.data === false && !crooked.error, JSON.stringify(crooked))
  await sql(`update public.ai_calls set called_at = now() - interval '11 minutes' where refund_token = '${n2}'`)
  const stale = await log(a, n2)
  check('номер старше 10 минут: мимо (как у возврата)', stale.data === false && (await rowsOf(n2)).length === 0)

  // ── 3. без ответа: итог и возврат одним вызовом ────────────────────────────
  const n3 = await spend(a, 'heavy', 1)
  check('перед вызовом строка списания есть', await callExists(n3))
  const refunded = await log(a, n3, {
    p_task: 'dialog', p_tier: 'standard', p_model: null, p_status: 'failed', p_latency_ms: 41_000,
    p_attempts: [
      { model: 'gemini-3.6-flash', status: '429', ms: 210, secret: 'лишнее поле' },
      'не объект',
      { model: 'gemini-3.5-flash', status: 'timeout', ms: 'долго' },
    ],
    p_refund: true,
  })
  const [r3] = await rowsOf(n3)
  check('итог «failed» записан', refunded.data === true && r3?.status === 'failed' && r3.model === null, JSON.stringify(refunded.error ?? r3))
  check('тем же вызовом энергия вернулась — строки списания нет', !(await callExists(n3)))

  // ── 4. мусор в попытках не доезжает ────────────────────────────────────────
  check('не-объект выброшен, лишнее поле срезано',
    r3?.attempts?.length === 2 && !('secret' in r3.attempts[0]) && r3.attempts[0].status === '429',
    JSON.stringify(r3?.attempts))
  check('нечисловое время — без поля ms, а не с мусором', r3?.attempts?.[1] && !('ms' in r3.attempts[1]), JSON.stringify(r3?.attempts?.[1]))
  const n4 = await spend(a)
  await log(a, n4, { p_attempts: Array.from({ length: 25 }, (_, i) => ({ model: 'm', status: '503', ms: i })) })
  const [r4] = await rowsOf(n4)
  check('больше 20 попыток — хранятся первые 20', r4?.attempts?.length === 20 && r4.attempts[19].ms === 19, `${r4?.attempts?.length}`)
  const n5 = await spend(a)
  await log(a, n5, { p_status: 'странный', p_latency_ms: -5, p_task: '' })
  const [r5] = await rowsOf(n5)
  check('неизвестный итог → failed, отрицательная задержка → 0, пустая задача → unknown',
    r5?.status === 'failed' && r5.latency_ms === 0 && r5.task === 'unknown', JSON.stringify(r5))

  // ── 5. хранение 40 дней ───────────────────────────────────────────────────────
  const old = randomUUID()
  await sql(`insert into public.ai_call_log (user_id, call_token, task, status, called_at)
             values ('${a.id}', '${old}', 'word', 'ok', now() - interval '41 days')`)
  await log(a, await spend(a))
  check('строки старше 40 дней уходят при следующей записи', (await rowsOf(old)).length === 0)

  // ── 6. права ────────────────────────────────────────────────────────────────
  const read = await a.client.from('ai_call_log').select('id').limit(1)
  check('вошедший не читает журнал напрямую', !!read.error, JSON.stringify(read.data))
  const insert = await a.client.from('ai_call_log').insert({ user_id: a.id, call_token: randomUUID(), task: 'x', status: 'ok' })
  check('вошедший не пишет в журнал напрямую', !!insert.error)
  const byAnon = await anon.rpc('log_ai_call', { p_nonce: n1, p_task: 'x', p_tier: null, p_model: null, p_status: 'ok', p_latency_ms: 1, p_attempts: [] })
  check('невошедший не зовёт log_ai_call', !!byAnon.error)
  const notBoss = await a.client.rpc('admin_ai_usage', { p_days: 7 })
  check('сводка по моделям — не для обычного пользователя', /RECALL_NOT_ADMIN/.test(notBoss.error?.message ?? ''), JSON.stringify(notBoss.error))
  const notBoss2 = await a.client.rpc('admin_ai_tasks', { p_days: 7 })
  check('сводка по задачам — тоже', /RECALL_NOT_ADMIN/.test(notBoss2.error?.message ?? ''))

  const usage = await boss.client.rpc('admin_ai_usage', { p_days: 1 })
  const gpt = (usage.data ?? []).find((r) => r.model === 'openai/gpt-oss-20b')
  check('владелец видит модель в сводке: попытки и ответы', !usage.error && gpt?.requests >= 3 && gpt.ok >= 3, JSON.stringify(usage.error ?? gpt))
  const flash = (usage.data ?? []).find((r) => r.model === 'gemini-3.6-flash')
  check('отказ по квоте посчитан отдельно от ответов', flash?.refused >= 1 && flash.ok === 0, JSON.stringify(flash))
  const tasks = await boss.client.rpc('admin_ai_tasks', { p_days: 1 })
  const dialog = (tasks.data ?? []).find((r) => r.task === 'dialog')
  check('сводка по задачам: вызов без ответа виден', !tasks.error && dialog?.failed >= 1, JSON.stringify(tasks.error ?? dialog))

  // ── 7. старое поколение лимитов удалено ───────────────────────────────────────
  const gone = await a.client.rpc('consume_ai_quota', { p_kind: 'heavy' })
  check('consume_ai_quota в базе больше нет', !!gone.error && /consume_ai_quota|PGRST202|find/i.test(`${gone.error.code} ${gone.error.message}`), JSON.stringify(gone.error))
}

const made = {}
try {
  made.a = await makeUser(USERS.a)
  made.b = await makeUser(USERS.b)
  made.boss = await makeUser(USERS.boss)
  await admin.from('profiles').update({ is_admin: true }).eq('id', made.boss.id)
  await run(made.a, made.b, made.boss)
} catch (e) {
  check(`прогон дошёл до конца`, false, e.message)
} finally {
  for (const u of Object.values(made)) await admin.auth.admin.deleteUser(u.id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', Object.values(USERS))
}

const failed = results.filter((r) => !r).length
console.log(`\n${failed ? '✗' : '✓'} ${results.length - failed}/${results.length}`)
process.exit(failed ? 1 : 0)
