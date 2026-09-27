/**
 * Смоук: долговечность ES-уровня + самоудаление аккаунта (хвост блока 5).
 *
 * Проверяем на живой базе под RLS/грантами (сессия реального пользователя):
 *   1. ученик пишет profiles.es_level и читает обратно (колонка + грант update);
 *   2. неверное значение уровня база отклоняет (check-констрейнт);
 *   3. delete_my_account стирает аккаунт — auth.users и профиль исчезают.
 *
 * Запуск: node scripts/smoke-account.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const userClient = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}

const stamp = Date.now()
const EMAIL = `acct-${stamp}@recall.test`
const PW = 'Acct!Smoke2026'

let aId
try {
  aId = (await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true }))
    .data.user.id
  await admin.from('profiles').upsert({ id: aId, display_name: 'Acct' })
  check('аккаунт заведён', !!aId)

  const A = userClient()
  await A.auth.signInWithPassword({ email: EMAIL, password: PW })

  // 1. es_level: запись своей колонки и чтение обратно
  {
    const { error } = await A.from('profiles').update({ es_level: 'B2' }).eq('id', aId)
    check('ученик пишет es_level', !error, error?.message ?? '')
    const { data } = await A.from('profiles').select('es_level').eq('id', aId).single()
    check('es_level читается обратно', data?.es_level === 'B2', JSON.stringify(data))
  }

  // 2. неверный уровень отклоняется check-констрейнтом
  {
    const { error } = await A.from('profiles').update({ es_level: 'Z9' }).eq('id', aId)
    check('неверный es_level отклонён', !!error, error ? 'заблокировано' : 'ПРОШЛО — ДЫРА')
  }

  // 3. delete_my_account стирает аккаунт целиком
  {
    const { error } = await A.rpc('delete_my_account')
    check('delete_my_account вызвана', !error, error?.message ?? '')
    // через admin проверяем, что пользователя больше нет
    const got = await admin.auth.admin.getUserById(aId)
    check('auth.users: аккаунт удалён', !got.data?.user, got.data?.user ? 'ЕЩЁ ЖИВ' : 'нет')
    const { data: prof } = await admin.from('profiles').select('id').eq('id', aId)
    check('profiles: строка ушла каскадом', !prof || prof.length === 0, JSON.stringify(prof))
  }
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  if (aId) await admin.auth.admin.deleteUser(aId).catch(() => {})
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
  setTimeout(() => process.exit(process.exitCode ?? 0), 300)
}
