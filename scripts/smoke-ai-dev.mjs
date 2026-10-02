/**
 * dev = прод для AI (PLAN.md Ф1.6; архитектура §7): dev-сервер отвечает на
 * /api/gemini ТЕМ ЖЕ обработчиком, что Vercel, — со входом, правами и
 * энергией. Раньше в vite.config.ts жила вторая копия роутинга без них, и
 * локально ученик получал учительскую задачу, в которой прод ему отказывает.
 *
 * Отказы проверяются без единого запроса к моделям. С --call — ещё один
 * настоящий перевод слова (один запрос к Groq): ответ пришёл, а итог лёг в
 * журнал ТЕСТОВОЙ базы — dev пишет туда же, куда смотрит клиент.
 *
 * --expect-cheap — прогон перехода на платный Gemini (docs/runbooks/
 * gemini-paid.md): одна настоящая реплика Диалога, и первой в журнале должна
 * быть дешёвая модель (RECALL_CHEAP_MODELS=1 в окружении dev-сервера).
 *
 * Нужен `npm run dev:test` (порт 5174).
 * Запуск: node scripts/smoke-ai-dev.mjs [--call] [--expect-cheap]
 */
import { createClient } from '@supabase/supabase-js'
import { APP_URL, dbTarget, runSql, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}

const env = scriptEnv()
const target = dbTarget([])
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

const EMAIL = 'aidev-smoke@recall.test'
const PASSWORD = 'AiDevSmoke!2026'
const M = [{ role: 'user', content: 'apple' }]

async function post(body, jwt) {
  const res = await fetch(`${APP_URL}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(body),
  })
  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* не JSON */
  }
  return { code: res.status, payload }
}

let uid
try {
  await fetch(APP_URL).catch(() => {
    throw new Error(`${APP_URL} не отвечает — запусти npm run dev:test`)
  })
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'smoke-ai-dev (временный)' })
  const { data: made, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  uid = made?.user?.id ?? (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === EMAIL)?.id
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: session, error: e2 } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)
  const jwt = session.session.access_token

  const calls = async () =>
    (await runSql(target, `select count(*)::int as n from public.ai_calls where user_id = '${uid}'`))[0].n

  console.log(`\n— ${APP_URL}/api/gemini: отказы, как на проде`)
  const before = await calls()
  const teacherOnly = await post({ task: 'material', messages: M }, jwt)
  check('ученику учительская задача — 403, как на проде', teacherOnly.code === 403, JSON.stringify(teacherOnly))
  check('и энергия не тронута', (await calls()) === before)
  const noToken = await post({ task: 'word', messages: M })
  check('без входа — 401', noToken.code === 401, JSON.stringify(noToken))
  const unknown = await post({ task: 'superpro', messages: M }, jwt)
  check('неизвестная задача — 400', unknown.code === 400, JSON.stringify(unknown))
  const legacy = await post({ tier: 'max', messages: M }, jwt)
  check('старый путь tier без task — 400, а не модель по заказу', legacy.code === 400, JSON.stringify(legacy))
  const tooMany = await post({ task: 'word', messages: Array.from({ length: 5 }, () => M[0]) }, jwt)
  check('лёгкой задаче — потолок сообщений, как на проде', tooMany.code === 400, JSON.stringify(tooMany))

  if (process.argv.includes('--call')) {
    console.log('\n— один настоящий перевод слова')
    const word = await post({ task: 'word', messages: M, system: 'Translate to Russian, one word only.' }, jwt)
    check('ответ пришёл', word.code === 200 && !!word.payload?.text, JSON.stringify(word))
    const [row] = await runSql(
      target,
      `select task, model, status from public.ai_call_log where user_id = '${uid}' order by id desc limit 1`,
    )
    check('итог — в журнале ТЕСТОВОЙ базы, с моделью', row?.task === 'word' && row.status === 'ok' && !!row.model, JSON.stringify(row))
  }

  if (process.argv.includes('--expect-cheap')) {
    console.log('\n— платный режим: первой спрашивается дешёвая модель')
    const reply = await post({ task: 'dialog', messages: [{ role: 'user', content: 'Hi! One short sentence, please.' }] }, jwt)
    const [row] = await runSql(
      target,
      `select model, status, attempts from public.ai_call_log where user_id = '${uid}' order by id desc limit 1`,
    )
    const first = row?.attempts?.[0]
    check('реплика Диалога дошла до журнала', !!row, JSON.stringify(reply))
    check('первая попытка — gemini-2.5-flash (RECALL_CHEAP_MODELS=1)', first?.model === 'gemini-2.5-flash', JSON.stringify(row?.attempts))
    console.log(`  ответила: ${row?.model ?? 'никто'} (${row?.status}); попытки: ${row?.attempts?.map((a) => `${a.model}:${a.status}`).join(', ')}`)
  }
} catch (e) {
  check('прогон дошёл до конца', false, e.message)
} finally {
  if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
}

const failed = results.filter((r) => !r).length
console.log(`\n${failed ? '✗' : '✓'} ${results.length - failed}/${results.length}`)
process.exit(failed ? 1 : 0)
