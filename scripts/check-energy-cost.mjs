/**
 * Цена списания энергии — в границах (PLAN.md Ф2.23; находка 3-01 Ф2.21).
 *
 * spend_energy открыта каждому вошедшему: сервер ходит в базу под токеном
 * человека, значит её зовут и из браузера (корневой CLAUDE.md, правило 3).
 * Цену p_cost она берёт от того, кто зовёт. До Ф2.23 вызов с ценой −1000
 * писал «отрицательное списание»: дневной запас уходил в плюс, AI работал
 * почти без лимита, а ученик студии так «пополнял» пул учителя.
 *
 * Что доказывает:
 *   1. цена −1 и −1000 — отказ RECALL_BAD_COST, строки нет;
 *   2. цена выше самой дорогой задачи (3, 1000) — тот же отказ, а не «энергия
 *      кончилась»: граница проверяется до бюджета;
 *   3. цены задач (0, 1, 2) проходят;
 *   4. запись с минусом в ai_calls не вставляется и напрямую — ограничение
 *      таблицы (страховка на случай новой функции-списания);
 *   5. граница в базе = самая дорогая задача сервера (api/_tasks.ts):
 *      подняли цену задачи без миграции — проверка красная.
 * Краснеет на функции до миграции 0012: −1 проходит, 1000 отказывает с
 * RECALL_FREE_LIMIT, ограничения нет.
 *
 * Запуск: node scripts/check-energy-cost.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { AI_TASKS } from '../api/_tasks.ts'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунт и пишет списания — только тестовая база.')
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
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

const EMAIL = 'energy-cost-check@recall.test'
const PASSWORD = 'EnergyCost!2026'
const MAX_COST = Math.max(...Object.values(AI_TASKS).map((t) => t.energyCost))

/** Списание как у сервера (api/_auth.ts): свой номер на каждый вызов. Возвращает текст ошибки или null. */
const spend = (client, cost) =>
  client
    .rpc('spend_energy', { p_kind: 'heavy', p_cost: cost, p_generation: false, p_nonce: randomUUID() })
    .then((r) => r.error?.message ?? null)

let id = null
try {
  const old = await sql(`select id from auth.users where email = '${EMAIL}'`)
  if (old[0]) await deleteTestUser(admin, sql, old[0].id)
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'check-energy-cost (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(`аккаунт: ${error.message}`)
  id = data.user.id
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: e2 } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)

  const rows = async () => (await sql(`select count(*)::int as n, coalesce(min(cost_energy), 0) as lo from public.ai_calls where user_id = '${id}'`))[0]

  // 1–2. вне границ — отказ своим кодом, строки нет
  for (const cost of [-1, -1000, MAX_COST + 1, 1000]) {
    const err = await spend(client, cost)
    check(`цена ${cost} — отказ RECALL_BAD_COST`, /RECALL_BAD_COST/.test(err ?? ''), err ?? 'прошло')
  }
  const after = await rows()
  check('после отказов — ни одной строки, минуса нет', after.n === 0 && Number(after.lo) >= 0, JSON.stringify(after))

  // 3. цены задач проходят
  for (const cost of [...new Set([0, ...Object.values(AI_TASKS).map((t) => t.energyCost)])].sort()) {
    const err = await spend(client, cost)
    check(`цена ${cost} (как у задачи) — проходит`, err === null, err ?? '')
  }

  // 4. напрямую в таблицу минус не вставить
  const direct = await sql(`
    do $$ begin
      begin
        insert into public.ai_calls (user_id, kind, cost_energy) values ('${id}', 'heavy', -1);
        raise exception 'MINUS_INSERTED';
      exception when check_violation then null;
      end;
    end $$`).then(() => null, (e) => String(e?.message ?? e))
  check('ai_calls: строку с минусом не вставить даже напрямую', direct === null, direct ?? '')

  // 5. граница в базе = самая дорогая задача сервера
  const [{ src }] = await sql(`select pg_get_functiondef('public.spend_energy(text,int,boolean,text)'::regprocedure) as src`)
  const bound = Number(/p_cost\s*>\s*(\d+)/.exec(src)?.[1])
  check(`граница в базе (${bound}) = самая дорогая задача api/_tasks.ts (${MAX_COST})`, bound === MAX_COST, `в базе: ${bound}`)
} catch (e) {
  check('проверка дошла до конца', false, String(e?.message ?? e))
} finally {
  if (id) await deleteTestUser(admin, sql, id)
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
}

const ok = results.filter(Boolean).length
console.log(`\n${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
