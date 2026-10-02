/**
 * Смоук: «Диалог» отдаёт ответ ПОТОКОМ, а не одним куском.
 *
 * Зачем отдельно. smoke-chat-history проверяет, что переписка цела; здесь —
 * что ответ действительно СТРИМИТСЯ: приходит как text/plain по кускам, а не
 * ждётся целиком и не откачен обратно на JSON `{text}`.
 *
 * Умеет краснеть: откати стриминг на прежний `{text}` — Content-Type станет
 * application/json, и проверка «ответ — поток» упадёт. Просит длинный ответ
 * (счёт до 60), чтобы кусков было заведомо несколько и шли они во времени:
 * на счёте до 15 (35 символов) модель 28.09 отдала оба куска разом, и
 * проверка «первый раньше последнего» краснела на исправном потоке. Что сам
 * сервер поток не копит, доказывает test-ai-timeouts.mjs без модели.
 *
 * С Ф1.6 dev отвечает тем же обработчиком, что прод, — со входом и энергией,
 * поэтому смоук заводит временного ученика и спрашивает от его имени (1 ⚡ на
 * тестовой базе и один настоящий запрос к модели).
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем `node scripts/smoke-dialog-stream.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { APP_URL, scriptEnv } from './_env.mjs'

const BASE = process.env.AUDIT_BASE_URL || APP_URL
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const EMAIL = 'dialog-stream-smoke@recall.test'
const PASSWORD = 'DialogStream!2026'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

let uid
try {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'smoke-dialog-stream (временный)' })
  const { data: made, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  uid = made?.user?.id ?? (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === EMAIL)?.id
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: session, error: e2 } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)

  const res = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session.access_token}` },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Count from 1 to 60, one number per line, digits only.' },
      ],
      task: 'dialog',
      stream: true,
    }),
  })

  check('ответ 200', res.ok, `HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  // Главная красноспособная проверка: поток — это text/plain. Откат на {text}
  // вернул бы application/json, и здесь бы упало.
  check('ответ — поток (text/plain), не JSON', ct.includes('text/plain'), ct || 'нет content-type')

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  const stamps = []
  let full = ''
  const t0 = Date.now()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    const s = dec.decode(value, { stream: true })
    if (s) {
      full += s
      stamps.push(Date.now() - t0)
    }
  }

  check('текст пришёл', full.trim().length > 0, `${full.length} символов`)
  check('пришёл несколькими кусками (стриминг)', stamps.length >= 2, `кусков: ${stamps.length}`)
  check(
    'первый кусок раньше последнего',
    stamps.length >= 2 && stamps[0] < stamps[stamps.length - 1],
    stamps.length >= 2 ? `${stamps[0]}мс → ${stamps[stamps.length - 1]}мс` : '',
  )
  // Если стрим тайком вернули на JSON-блоб — тело будет {"text":"…"}.
  const looksJson = full.trim().startsWith('{') && full.includes('"text"')
  check('это не JSON-блоб (стрим не откатили на {text})', !looksJson)
} catch (e) {
  check('прогон завершился', false, e.message)
} finally {
  if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
