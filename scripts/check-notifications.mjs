/**
 * Ядро уведомлений на живой ТЕСТОВОЙ базе (PLAN.md Ф1.5; архитектура §17).
 *
 * Что доказывает:
 *   1. одно уведомление на ключ: правило, прогнанное дважды, во второй раз
 *      не создаёт ничего (журнал п.29, 36: «одно на цикл» держит база);
 *   2. упавшее правило откатывает только себя и не мешает остальным, ошибка
 *      видна в реестре;
 *   3. вошедший НЕ может создать уведомление ни через notify(), ни вставкой,
 *      не может будить правила и отправку; видит и отмечает только свои;
 *      невошедший не видит ничего;
 *   4. доставка спит, пока в Vault нет адреса и секрета; с ними — запрос
 *      через pg_net действительно уходит, уведомление помечается отданным;
 *   5. будильник pg_cron заведён и включён.
 *
 * Правило для проверки создаётся на время прогона и удаляется: в миграциях
 * тестовых правил нет, и на живую базу они не попадают.
 *
 * Запуск: node scripts/check-notifications.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит временные правила и секреты — только тестовая база.')
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PASSWORD = 'NotifCheck!2026'
const USERS = { a: 'notif-check-a@recall.test', b: 'notif-check-b@recall.test' }
const KEY = `selftest:${Date.now()}`

async function makeUser(email) {
  await admin.from('allowed_emails').upsert({ email, note: 'check-notifications (временный)' })
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

async function cleanup(ids) {
  await sql(`
    delete from public.notification_rules where name in ('selftest', 'selftest_broken');
    drop function if exists public.notification_rule_selftest();
    drop function if exists public.notification_rule_selftest_broken();
    delete from vault.secrets where name in ('notify_url', 'notify_secret');
  `).catch((e) => console.log('уборка SQL:', e.message))
  for (const id of ids) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', Object.values(USERS))
}

async function run(a, b) {
  // ── 1. одно уведомление на ключ ────────────────────────────────────────────
  await sql(`
    create or replace function public.notification_rule_selftest() returns int
    language sql security definer set search_path = public as $fn$
      select count(*)::int from (
        select public.notify('${a.id}'::uuid, 'manual',
          jsonb_build_object('title', 'Проверка ядра', 'body', 'одно на ключ'), '${KEY}') as made
      ) s where s.made
    $fn$;
    revoke execute on function public.notification_rule_selftest() from public, anon, authenticated;
    insert into public.notification_rules (name, fn, about)
    values ('selftest', 'public.notification_rule_selftest', 'проверка check-notifications (временное)')
    on conflict (name) do update set fn = excluded.fn, enabled = true;
  `)
  const [first] = await sql('select public.run_notification_rules() as r')
  const [second] = await sql('select public.run_notification_rules() as r')
  check('первый прогон правила создаёт одно уведомление', first.r.selftest === 1, JSON.stringify(first.r))
  check('второй прогон — ноль новых (ключ уже был)', second.r.selftest === 0, JSON.stringify(second.r))
  const [{ n }] = await sql(`select count(*)::int as n from public.notifications where user_id = '${a.id}' and dedupe_key = '${KEY}'`)
  check('в таблице ровно одна строка на ключ', n === 1, `строк: ${n}`)
  const [dup] = await sql(`select public.notify('${a.id}'::uuid, 'manual', '{}'::jsonb, '${KEY}') as made`)
  check('notify() с тем же ключом отвечает «уже было»', dup.made === false)

  // ── 2. упавшее правило не мешает остальным ────────────────────────────────
  await sql(`
    create or replace function public.notification_rule_selftest_broken() returns int
    language plpgsql security definer set search_path = public as $fn$
    begin
      perform public.notify('${a.id}'::uuid, 'manual', '{}'::jsonb, '${KEY}:broken');
      raise exception 'сломано нарочно';
    end $fn$;
    revoke execute on function public.notification_rule_selftest_broken() from public, anon, authenticated;
    insert into public.notification_rules (name, fn, about)
    values ('selftest_broken', 'public.notification_rule_selftest_broken', 'проверка check-notifications (временное)')
    on conflict (name) do update set fn = excluded.fn, enabled = true;
  `)
  const [third] = await sql('select public.run_notification_rules() as r')
  check('упавшее правило видно в отчёте, соседнее отработало', /сломано нарочно/.test(third.r.selftest_broken) && third.r.selftest === 0, JSON.stringify(third.r))
  const [{ nb }] = await sql(`select count(*)::int as nb from public.notifications where dedupe_key = '${KEY}:broken'`)
  check('упавшее правило откатило своё уведомление', nb === 0, `строк: ${nb}`)
  const [reg] = await sql("select last_error from public.notification_rules where name = 'selftest_broken'")
  check('ошибка правила записана в реестр', /сломано нарочно/.test(reg.last_error ?? ''))
  await sql("update public.notification_rules set enabled = false where name = 'selftest_broken'")

  // ── 3. права ────────────────────────────────────────────────────────────────
  const denied = (r) => !!r.error
  check('вошедший НЕ вызывает notify()', denied(await a.client.rpc('notify', { p_user_id: b.id, p_kind: 'manual', p_data: {}, p_dedupe_key: 'x' })))
  check('вошедший НЕ будит правила', denied(await a.client.rpc('run_notification_rules')))
  check('вошедший НЕ зовёт отправку', denied(await a.client.rpc('dispatch_notifications')))
  const ins = await a.client.from('notifications').insert({ user_id: b.id, kind: 'manual', dedupe_key: 'x' })
  check('вошедший НЕ вставляет уведомление напрямую', denied(ins))
  const reg2 = await a.client.from('notification_rules').select('name')
  check('реестр правил вошедшему не виден', denied(reg2) || (reg2.data ?? []).length === 0)

  const mineA = await a.client.from('notifications').select('id, kind, data, read_at')
  const mineB = await b.client.from('notifications').select('id')
  check('владелец видит своё уведомление', (mineA.data ?? []).length === 1 && mineA.data[0].data?.title === 'Проверка ядра')
  check('другой человек чужого не видит', (mineB.data ?? []).length === 0)
  const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const an = await anon.from('notifications').select('id')
  check('без входа не видно ничего', denied(an) || (an.data ?? []).length === 0)
  check('без входа «прочитано» не работает', denied(await anon.rpc('mark_notifications_read')))

  const upd = await a.client.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', a.id).select('id')
  check('read_at напрямую не пишется (только через RPC)', denied(upd) || (upd.data ?? []).length === 0)
  const byB = await b.client.rpc('mark_notifications_read', { p_ids: [mineA.data[0].id] })
  check('чужое «прочитано» не отмечается', byB.data === 0, JSON.stringify(byB.data ?? byB.error?.message))
  const byA = await a.client.rpc('mark_notifications_read')
  check('своё отмечается прочитанным', byA.data === 1, JSON.stringify(byA.data ?? byA.error?.message))
  const again = await a.client.rpc('mark_notifications_read')
  check('повторная отметка — ноль (уже прочитано)', again.data === 0)

  // ── 4. доставка ─────────────────────────────────────────────────────────────
  await sql(`select public.notify('${a.id}'::uuid, 'manual', '{}'::jsonb, '${KEY}:send')`)
  const [d0] = await sql('select public.dispatch_notifications() as n')
  const [s0] = await sql(`select sent_at from public.notifications where dedupe_key = '${KEY}:send'`)
  check('без адреса и секрета в Vault доставка спит', d0.n === 0 && s0.sent_at === null)

  // Адрес — корень REST самой тестовой базы: он отвечает 401 без ключа. Нам
  // важен факт ухода запроса, а не ответ; секрет — одноразовый, чужим не уходит.
  const url = `${env.VITE_SUPABASE_URL}/rest/v1/`
  await sql(`
    select vault.create_secret('${url}', 'notify_url');
    select vault.create_secret('${randomBytes(24).toString('hex')}', 'notify_secret');
  `)
  const [{ before }] = await sql('select coalesce(max(id), 0)::bigint as before from net._http_response')
  const [d1] = await sql('select public.dispatch_notifications() as n')
  const [s1] = await sql(`select sent_at from public.notifications where dedupe_key = '${KEY}:send'`)
  check('с адресом и секретом — отдано на доставку', d1.n >= 1 && s1.sent_at !== null, `отдано: ${d1.n}`)
  let resp = null
  for (let i = 0; i < 20 && !resp; i++) {
    await sleep(1000)
    const rows = await sql(`select status_code, error_msg from net._http_response where id > ${before} order by id desc limit 1`)
    resp = rows[0] ?? null
  }
  check('запрос через pg_net действительно ушёл и вернулся ответ', !!resp && (resp.status_code > 0 || !!resp.error_msg), JSON.stringify(resp))
  const [d2] = await sql('select public.dispatch_notifications() as n')
  check('отданное повторно не отдаётся', d2.n === 0)

  // ── 5. будильник ────────────────────────────────────────────────────────────
  const [job] = await sql("select schedule, active, command from cron.job where jobname = 'recall-notifications'")
  check('будильник pg_cron заведён: раз в 5 минут, включён', job?.schedule === '*/5 * * * *' && job?.active === true && /run_notification_rules/.test(job?.command ?? ''))
}

async function main() {
  const made = []
  try {
    const a = await makeUser(USERS.a)
    made.push(a.id)
    const b = await makeUser(USERS.b)
    made.push(b.id)
    await run(a, b)
  } catch (e) {
    check('проверка дошла до конца', false, String(e?.message ?? e).split('\n')[0])
  } finally {
    await cleanup(made)
    console.log('Временные правила, секреты и аккаунты удалены.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

await main()
