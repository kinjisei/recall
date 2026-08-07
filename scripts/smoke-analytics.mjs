/**
 * Смоук аналитики (A3). Требует блока «АНАЛИТИКА» из docs/schema.sql.
 *
 *  1. АНОНИМ пишет событие (без входа) — это знаменатель воронки.
 *  2. Мусор отбрасывается тихо: кривое имя, огромные props.
 *  3. Склейка: после входа события того же устройства получают user_id.
 *  4. Таблицу events нельзя читать ни анониму, ни обычному пользователю.
 *  5. admin_funnel отдаёт шаги и источники; не-админу — отказ.
 *
 * Запуск: node scripts/smoke-analytics.mjs
 * Скрипт сам убирает тестовые события и аккаунты.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

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
const anon = () =>
  createClient(URL_, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const EMAIL = 'analytics-smoke@recall.test'
const PASSWORD = 'Analytics!2026'
const ANON_ID = randomUUID()
let userId = null

try {
  // 1. аноним пишет визит
  const guest = anon()
  const visit = await guest.rpc('track_event', {
    p_name: 'page_view',
    p_props: { path: '/teachers' },
    p_anon: ANON_ID,
    p_source: 'smoke-telegram',
  })
  check('аноним пишет событие', !visit.error, visit.error?.message)

  const { count: anonCount } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('anon_id', ANON_ID)
  check('событие долетело до таблицы', anonCount === 1, `строк: ${anonCount}`)

  // 2. мусор отбрасывается молча (без ошибки наружу — аналитика не ломает экран)
  await guest.rpc('track_event', { p_name: 'ЖУТЬ; drop table', p_anon: ANON_ID })
  await guest.rpc('track_event', { p_name: 'x', p_anon: ANON_ID })
  await guest.rpc('track_event', {
    p_name: 'huge_props',
    p_props: { junk: 'x'.repeat(5000) },
    p_anon: ANON_ID,
  })
  const { count: afterJunk } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('anon_id', ANON_ID)
  check('мусорные события отброшены', afterJunk === 1, `строк: ${afterJunk}`)

  // 3. склейка: тот же anon_id, но уже вошедший пользователь
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'analytics-smoke' })
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  userId = list?.users?.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id
  if (!userId) {
    const { data } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    })
    userId = data?.user?.id
  }
  const client = anon()
  const { error: signErr } = await client.auth.signInWithPassword({
    email: EMAIL, password: PASSWORD,
  })
  if (signErr) throw new Error('вход: ' + signErr.message)

  await client.rpc('track_event', { p_name: 'signup', p_anon: ANON_ID, p_source: 'smoke-telegram' })
  const { count: stitched } = await admin
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('anon_id', ANON_ID)
    .eq('user_id', userId)
  check(
    'склейка: анонимный визит привязался к пользователю',
    stitched === 2,
    `строк с user_id: ${stitched}`,
  )

  // 4. таблица закрыта на чтение
  const guestRead = await anon().from('events').select('id').limit(1)
  const userRead = await client.from('events').select('id').limit(1)
  check('аноним НЕ читает events', !!guestRead.error, guestRead.error?.code ?? 'ПРОЧИТАЛ')
  check('пользователь НЕ читает events', !!userRead.error, userRead.error?.code ?? 'ПРОЧИТАЛ')

  // 5. воронка
  const notAdmin = await client.rpc('admin_funnel', { p_days: 30 })
  check(
    'не-админу воронка недоступна',
    !!notAdmin.error && /NOT_ADMIN/.test(notAdmin.error.message),
    notAdmin.error?.message ?? 'ОТДАЛА',
  )

  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle()
  if (adminProfile) {
    // зовём от имени сервиса нельзя (auth.uid() пуст) — проверяем структурой:
    // временно даём тестовому пользователю админку и сразу забираем обратно
    await admin.from('profiles').update({ is_admin: true }).eq('id', userId)
    const funnel = await client.rpc('admin_funnel', { p_days: 30 })
    await admin.from('profiles').update({ is_admin: false }).eq('id', userId)
    const f = funnel.data
    check('воронка отдаёт шаги', Array.isArray(f?.steps) && f.steps.length >= 5,
      `шагов: ${f?.steps?.length}`)
    check('воронка отдаёт источники', Array.isArray(f?.sources), `источников: ${f?.sources?.length}`)
    const smoke = (f?.sources ?? []).find((s) => s.source === 'smoke-telegram')
    check('источник виден в разбивке', !!smoke && smoke.visits >= 1, JSON.stringify(smoke ?? null))
  }
} catch (e) {
  console.error('\nОшибка прогона:', e.message)
  results.push(false)
} finally {
  await admin.from('events').delete().eq('anon_id', ANON_ID)
  if (userId) {
    await admin.from('events').delete().eq('user_id', userId)
    await admin.from('profiles').update({ is_admin: false }).eq('id', userId)
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  }
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}
