/**
 * Прод-проверка карты AI-задач (заход 18). Локально не запускается: dev-эндпоинт
 * в vite.config вообще не авторизует, а вся суть — в правах и квотах.
 *   1. Ученица с task:'material' → 403 (Pro-модели только преподавателю).
 *   2. Преподаватель с task:'material' → НЕ 403 (гейт пропускает).
 *   3. Ученица с task:'word' → 200 (лёгкий путь работает, карман light).
 *   4. Выдуманное имя задачи → обрабатывается как обычная (standard), не как Pro.
 *   5. Старый клиент (tier:'max', без task) → пропускается, но НЕ на Pro-уровне
 *      (снаружи видно только то, что запрос принят — модель проверяем по коду).
 * Запуск: node scripts/smoke-aitasks-prod.mjs
 *         node scripts/smoke-aitasks-prod.mjs http://localhost:3000  (иной хост)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] || 'https://recall-pgkz.vercel.app'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const admin = createClient(URL_, env.SUPABASE_SERVICE_KEY, {
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
  await admin.from('profiles').update({ role }).eq('id', id)
  return id
}
async function token(email) {
  const c = createClient(URL_, env.VITE_SUPABASE_ANON_KEY, {
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

  // 3. лёгкий путь у ученицы работает
  const r3 = await ask(sTok, { task: 'word' })
  check('ученица с task:\'word\' → 200', r3.status === 200, `${r3.status} ${r3.error ?? ''}`)

  // 4. выдуманная задача не даёт Pro и не ломает эндпоинт
  const r4 = await ask(sTok, { task: 'superpro' })
  check(
    'выдуманное имя задачи не даёт прав (не 403, обычная модель)',
    r4.status === 200,
    `${r4.status} ${r4.error ?? ''}`,
  )

  // 5. старый клиент из кэша PWA не ломается
  const r5 = await ask(sTok, { tier: 'max' })
  check(
    "старый клиент (tier:'max') принят как обычный запрос",
    r5.status === 200,
    `${r5.status} ${r5.error ?? ''}`,
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
