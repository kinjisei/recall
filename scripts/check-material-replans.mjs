/**
 * Бесплатный «Пересоставить план» в самой базе (PLAN.md Ф2.17-4в-2б,
 * миграция 0014). Обе функции открыты каждому вошедшему — сервер ходит в базу
 * под токеном человека (корневой CLAUDE.md, правило 3), — поэтому проверяем
 * их так, как позвал бы браузер.
 *
 * Что доказывает:
 *   1. право выдаётся только по номеру СВОЕЙ строки-генерации не старше 10
 *      минут: чужой номер, случайный номер и старая генерация — null;
 *   2. повторный запрос права тем же номером — то же право, не второе;
 *   3. 3 повтора по праву (осталось 2, 1, 0), четвёртый — RECALL_REPLAN_LIMIT;
 *   4. повтор не тратит генерацию (is_generation = false);
 *   5. возврат повтора (refund_ai_call по номеру) возвращает его;
 *   6. чужим правом и без права — RECALL_REPLAN_NONE.
 * Краснеет без миграции 0014 (функций нет).
 *
 * Запуск: node scripts/check-material-replans.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и пишет списания — только тестовая база.')
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

const PASSWORD = 'Replans!2026'
const users = []
async function user(key) {
  const email = `replan-check-${key}@recall.test`
  const old = await sql(`select id from auth.users where email = '${email}'`)
  if (old[0]) await deleteTestUser(admin, sql, old[0].id)
  await admin.from('allowed_emails').upsert({ email, note: 'check-material-replans (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(`аккаунт: ${error.message}`)
  users.push({ id: data.user.id, email })
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)
  return { id: data.user.id, client }
}
/** Строка оплаченной генерации — как её пишет spend_energy (номер знает только сервер). */
const paidCall = async (uid, ago = '0 minutes') => {
  const nonce = randomUUID()
  await sql(`insert into public.ai_calls (user_id, kind, cost_energy, is_generation, refund_token, called_at)
    values ('${uid}', 'heavy', 0, true, '${nonce}', now() - interval '${ago}')`)
  return nonce
}
const grant = async (client, nonce) => (await client.rpc('grant_material_replans', { p_nonce: nonce })).data ?? null
const replan = async (client, id, nonce = randomUUID()) => {
  const r = await client.rpc('spend_replan', { p_replan: id, p_nonce: nonce })
  return r.error ? r.error.message : r.data
}

try {
  const t = await user('teacher')
  const other = await user('other')

  // 1. только по номеру своей свежей генерации
  const nonce = await paidCall(t.id)
  const g = await grant(t.client, nonce)
  check('1. право за свою свежую генерацию', typeof g === 'string', String(g))
  check('1. случайный номер — без права', (await grant(t.client, randomUUID())) === null)
  check('1. чужой номер — без права', (await grant(other.client, nonce)) === null)
  const stale = await paidCall(t.id, '11 minutes')
  check('1. генерация старше 10 минут — без права', (await grant(t.client, stale)) === null)
  // 2. тот же номер — то же право
  check('2. повторный запрос — то же право', (await grant(t.client, nonce)) === g)

  // 3. три повтора, четвёртый — отказ
  const gens = async () => (await sql(`select count(*)::int as n from public.ai_calls where user_id = '${t.id}' and is_generation`))[0].n
  const before = await gens()
  const n1 = randomUUID()
  const left = [await replan(t.client, g, n1), await replan(t.client, g), await replan(t.client, g)]
  check('3. осталось 2, 1, 0', JSON.stringify(left) === '[2,1,0]', JSON.stringify(left))
  const fourth = await replan(t.client, g)
  check('3. четвёртый — RECALL_REPLAN_LIMIT', /RECALL_REPLAN_LIMIT/.test(String(fourth)), String(fourth))
  // 4. генерацию не тратит
  check('4. повторы — не генерации', (await gens()) === before, `${before} → ${await gens()}`)
  // 5. возврат по номеру возвращает повтор
  const refunded = (await t.client.rpc('refund_ai_call', { p_nonce: n1 })).data
  check('5. возврат повтора по номеру', refunded === true && (await replan(t.client, g)) === 0, String(refunded))
  // 6. чужое право и без права
  check('6. чужим правом — RECALL_REPLAN_NONE', /RECALL_REPLAN_NONE/.test(String(await replan(other.client, g))))
  check('6. без права — RECALL_REPLAN_NONE', /RECALL_REPLAN_NONE/.test(String(await replan(t.client, randomUUID()))))
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
