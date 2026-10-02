/**
 * Карта AI-задач снаружи — права и квоты на живом эндпоинте (заход 18, Ф1.6).
 * С Ф1.6 dev отвечает тем же обработчиком, что Vercel, поэтому проверка идёт и
 * на тестовом стенде, и на проде.
 *   1. Ученица с task:'material' → 403 (Pro-модели только преподавателю).
 *   2. Преподаватель с task:'material' → НЕ 403 (гейт пропускает). Триал у
 *      него снят — лимит генераций 0, ответ 429 до модели: Pro-запрос не тратим.
 *   3. Ученица с task:'word' → 200 (лёгкий путь работает, карман light), и
 *      вызов лёг в журнал ai_call_log с моделью (Ф1.6).
 *   4. Выдуманное имя задачи → 400 (Ф1.6: неизвестная задача не обслуживается).
 *   5. Старый клиент (tier:'max', без task) → 400 (путь tier/provider убран в Ф1.6).
 *   6. Диалог под видом task:'word' → 400 (карман квоты не подменить).
 * Запуск: node scripts/smoke-aitasks-prod.mjs          (тестовый стенд, нужен npm run dev:test)
 *         node scripts/smoke-aitasks-prod.mjs --prod   (живой сайт — только с живой базой)
 */
import { createClient } from '@supabase/supabase-js'
import { APP_URL, PROD_SITE, assertSiteMatchesDb, firstArg, scriptEnv } from './_env.mjs'

const BASE = firstArg() || (process.argv.includes('--prod') ? PROD_SITE : APP_URL)
assertSiteMatchesDb(BASE)

const env = scriptEnv()
const URL_ = env.VITE_SUPABASE_URL
const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const T = 'aitask-teacher@recall.test'
const S = 'aitask-student@recall.test'
const PASS = 'AiTask!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function mk(email, role) {
  await admin.from('allowed_emails').upsert({ email, note: 'aitask-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASS, email_confirm: true,
  })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === email)?.id
  } else if (error) throw new Error(error.message)
  // без триала: у преподавателя 0 генераций — гейт проверяется ответом 429 до
  // модели, и дефицитный Pro-запрос не тратится на каждом прогоне
  const past = new Date(Date.now() - 86_400_000).toISOString()
  await admin.from('profiles').update({ role, trial_until: past }).eq('id', id)
  return id
}
async function token(email) {
  const c = createClient(URL_, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return data.session.access_token
}

/** Короткий запрос — бережём квоту и токены. */
async function ask(tok, body) {
  const r = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Say OK.' }],
      system: 'Reply with exactly: OK',
      ...body,
    }),
  })
  let data = null
  try {
    data = await r.json()
  } catch {
    /* не JSON */
  }
  return { status: r.status, error: data?.error, text: data?.text }
}

let tId, sId
try {
  tId = await mk(T, 'teacher')
  sId = await mk(S, 'learner')
  const tTok = await token(T)
  const sTok = await token(S)
  console.log(`Хост: ${BASE}\n`)

  // 1. ученица не дотягивается до Pro
  const r1 = await ask(sTok, { task: 'material' })
  check(
    "ученица с task:'material' получает 403",
    r1.status === 403,
    `${r1.status} ${r1.error ?? ''}`,
  )

  // 2. преподаватель проходит гейт (200; 429/502 тоже означают «пропущен»)
  const r2 = await ask(tTok, { task: 'material' })
  check(
    "преподаватель с task:'material' проходит гейт",
    r2.status !== 403,
    `${r2.status} ${r2.error ?? (r2.text ?? '').slice(0, 40)}`,
  )

  // 3. лёгкий путь у ученицы работает — и попадает в журнал вызовов (Ф1.6):
  // строка с моделью доказывает, что на месте и миграция, и новый код
  const r3 = await ask(sTok, { task: 'word' })
  check('ученица с task:\'word\' → 200', r3.status === 200, `${r3.status} ${r3.error ?? ''}`)
  const { data: logged } = await admin
    .from('ai_call_log')
    .select('task, status, model')
    .eq('user_id', sId)
    .order('id', { ascending: false })
    .limit(1)
  const row = logged?.[0]
  check(
    'вызов записан в журнал: задача, итог и модель',
    row?.task === 'word' && row.status === 'ok' && !!row.model,
    JSON.stringify(row ?? 'строки нет'),
  )

  // 4. выдуманная задача не обслуживается вовсе (Ф1.6) — ни Pro, ни обычной
  const r4 = await ask(sTok, { task: 'superpro' })
  check('выдуманное имя задачи → 400, модель не зовётся', r4.status === 400, `${r4.status} ${r4.error ?? ''}`)

  // 5. путь tier/provider убран (Ф1.6): клиенты шлют task с июля 2026
  const r5 = await ask(sTok, { tier: 'max' })
  check("старый клиент (tier:'max' без task) → 400", r5.status === 400, `${r5.status} ${r5.error ?? ''}`)

  // 6. подмена кармана квоты: многорепличный Диалог под видом task:'word' —
  // отклоняется (иначе списался бы из дешёвого light вместо heavy)
  const r6 = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sTok}` },
    body: JSON.stringify({
      task: 'word',
      system: 'Ты собеседник.',
      messages: Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        content: `Реплика диалога номер ${i}, довольно длинная, чтобы это не выглядело как перевод слова.`,
      })),
    }),
  })
  check(
    "Диалог под видом task:'word' отклонён (карман квоты не подменить)",
    r6.status === 400,
    `${r6.status}`,
  )
} catch (e) {
  check(`проверка упала: ${e.message}`, false)
} finally {
  for (const id of [tId, sId]) if (id) await admin.auth.admin.deleteUser(id)
  await admin.from('allowed_emails').delete().in('email', [T, S])
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} проверок прошло`)
process.exit(failed ? 1 : 0)
