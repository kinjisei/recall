/**
 * Смоук этапа 2: возврат энергии и пробные генерации репетитора.
 *
 * Что доказываем:
 *   1. Списание помечается серверным токеном, и по нему энергия возвращается.
 *   2. Возврат НЕ отмычка: чужой/выдуманный токен не работает, повторный
 *      возврат по тому же токену не работает, чужое списание не вернуть.
 *   3. Репетитор на триале без учеников получает 2 пробные генерации
 *      (ровно один материал: план + текст) — раньше было 0 и он читал
 *      «Лимит исчерпан» на первой же попытке.
 *   4. С появлением ученика действует обычный лимит студии.
 *
 * Запуск: node scripts/smoke-refund.mjs  (dev-сервер не нужен — только БД)
 * Требует SUPABASE_SERVICE_KEY в .env.local. Аккаунты создаёт и удаляет сам.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const admin = createClient(URL_, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

/** Клиент от имени пользователя (как настоящий браузер/сервер с его JWT). */
async function asUser(email, password) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

async function mkUser(email, password, patch = {}) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-refund (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  let id = data?.user?.id
  if (!id) {
    if (error && !/already/i.test(error.message)) throw new Error(error.message)
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    // Supabase приводит email к нижнему регистру — без toLowerCase() id
    // молча оказывался undefined, и смоук «проходил» вхолостую
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
  }
  if (!id) throw new Error(`нет id для ${email}`)
  // чистое состояние: прошлые прогоны не должны влиять на счётчики
  await admin.from('ai_calls').delete().eq('user_id', id)
  await admin.from('teacher_students').delete().eq('teacher_id', id)
  await admin
    .from('profiles')
    .update({
      role: 'learner',
      plan: 'free',
      plan_expires_at: null,
      trial_until: new Date(Date.now() + 14 * 864e5).toISOString(),
      ...patch,
    })
    .eq('id', id)
  return id
}

const A = { email: 'refund-a@recall.test', pass: 'Refund!2026a' }
const B = { email: 'refund-b@recall.test', pass: 'Refund!2026b' }
const S = { email: 'refund-student@recall.test', pass: 'Refund!2026s' }

const spent = async (id) => {
  const { data } = await admin
    .from('ai_calls')
    .select('cost_energy')
    .eq('user_id', id)
  return (data ?? []).reduce((n, r) => n + (r.cost_energy ?? 0), 0)
}

let ids = []
try {
  const idA = await mkUser(A.email, A.pass)
  const idB = await mkUser(B.email, B.pass)
  ids = [idA, idB]
  const a = await asUser(A.email, A.pass)
  const b = await asUser(B.email, B.pass)

  // --- 1. Списание с токеном и возврат по нему -----------------------------
  const tok = crypto.randomUUID()
  const { error: e1 } = await a.rpc('spend_energy', {
    p_kind: 'heavy',
    p_cost: 1,
    p_generation: false,
    p_nonce: tok,
  })
  check('списание с токеном прошло', !e1, e1?.message ?? '')
  // Без этого дальше идут ЛОЖНЫЕ зелёные: «энергия вернулась» пройдёт просто
  // потому, что её и не списывали. Лучше честно остановиться с объяснением.
  if (e1) {
    throw new Error(
      'spend_energy не принимает p_nonce — блок «ЭТАП 2 РЕМОНТА» из docs/schema.sql ещё не залит в Supabase',
    )
  }
  check('энергия списана', (await spent(idA)) === 1, `потрачено: ${await spent(idA)}`)

  const { data: r1 } = await a.rpc('refund_ai_call', { p_nonce: tok })
  check('возврат по своему токену сработал', r1 === true, `ответ: ${r1}`)
  check('энергия вернулась', (await spent(idA)) === 0, `потрачено: ${await spent(idA)}`)

  // --- 2. Возврат не должен быть отмычкой ----------------------------------
  const { data: r2 } = await a.rpc('refund_ai_call', { p_nonce: tok })
  check('повторный возврат по тому же токену отклонён', r2 === false, `ответ: ${r2}`)

  const { data: r3 } = await a.rpc('refund_ai_call', { p_nonce: crypto.randomUUID() })
  check('выдуманный токен не возвращает', r3 === false, `ответ: ${r3}`)

  const { data: r4 } = await a.rpc('refund_ai_call', { p_nonce: 'не-uuid' })
  check('мусор вместо токена не ломает функцию', r4 === false, `ответ: ${r4}`)

  // чужое списание вернуть нельзя
  const tokB = crypto.randomUUID()
  await b.rpc('spend_energy', { p_kind: 'heavy', p_cost: 1, p_generation: false, p_nonce: tokB })
  const { data: r5 } = await a.rpc('refund_ai_call', { p_nonce: tokB })
  check('чужой токен не возвращает', r5 === false, `ответ: ${r5}`)
  check('чужое списание осталось на месте', (await spent(idB)) === 1, `потрачено B: ${await spent(idB)}`)

  // списание БЕЗ токена вернуть нечем (старый сервер/клиент)
  await a.rpc('spend_energy', { p_kind: 'heavy', p_cost: 1, p_generation: false })
  const { data: r6 } = await a.rpc('refund_ai_call', { p_nonce: '' })
  check('пустой токен не возвращает', r6 === false, `ответ: ${r6}`)
  check('списание без токена осталось', (await spent(idA)) === 1, `потрачено: ${await spent(idA)}`)

  // --- 3. Две пробные генерации репетитору без учеников ---------------------
  await admin.from('ai_calls').delete().eq('user_id', idA)
  await admin.from('profiles').update({ role: 'teacher' }).eq('id', idA)

  const g1 = await a.rpc('spend_energy', { p_kind: 'heavy', p_cost: 0, p_generation: true })
  check('репетитор без учеников: 1-я генерация прошла', !g1.error, g1.error?.message ?? '')
  const g2 = await a.rpc('spend_energy', { p_kind: 'heavy', p_cost: 0, p_generation: true })
  check('репетитор без учеников: 2-я генерация прошла', !g2.error, g2.error?.message ?? '')
  const g3 = await a.rpc('spend_energy', { p_kind: 'heavy', p_cost: 0, p_generation: true })
  check(
    'третья генерация отклонена с RECALL_GEN_LIMIT',
    !!g3.error && g3.error.message.includes('RECALL_GEN_LIMIT'),
    g3.error?.message ?? 'ошибки нет',
  )

  // --- 4. С учеником действует обычный лимит студии -------------------------
  const idS = await mkUser(S.email, S.pass)
  ids.push(idS)
  await admin.from('teacher_students').insert({ teacher_id: idA, student_id: idS })
  await admin.from('ai_calls').delete().eq('user_id', idA)
  const g4 = await a.rpc('spend_energy', { p_kind: 'heavy', p_cost: 0, p_generation: true })
  check('с учеником генерации снова доступны', !g4.error, g4.error?.message ?? '')

  await a.auth.signOut()
  await b.auth.signOut()
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {})
  for (const u of [A, B, S]) await admin.from('allowed_emails').delete().eq('email', u.email)
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
// process.exit() с открытыми сокетами роняет node на Windows (libuv assert)
process.exitCode = ok === results.length ? 0 : 1
