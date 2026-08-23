/**
 * Смоук: RLS само-назначения материалов (режим самоучки, 3b).
 *
 * Проверяем ровно дыру, которую легко открыть: ученик должен мочь назначить
 * СЕБЕ только СВОЙ материал — и никак иначе. Путь — security-definer RPC
 * self_assign_material (student_id жёстко = auth.uid(), обязана проверять
 * material_owned_by). Тест краснеет, если снять проверку владения, открыть
 * прямую запись в таблицу или дать назначить чужой материал.
 *
 * Браузер не нужен — это чистый Supabase под RLS/грантами (сессии реальных
 * пользователей, не service_role: сервисный ключ всё обходит и не проверил бы).
 *
 * Запуск: node scripts/smoke-self-material.mjs
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
const A_EMAIL = `selfmat-a-${stamp}@recall.test`
const B_EMAIL = `selfmat-b-${stamp}@recall.test`
const PW = 'SelfMat!Smoke2026'
const mat = (teacherId, body) => ({
  teacher_id: teacherId,
  lang: 'en',
  level: 'A2',
  topic: 'smoke',
  format: 'рассказ',
  length_range: '100-250',
  body,
  exercises: [],
})

let aId, bId
try {
  aId = (await admin.auth.admin.createUser({ email: A_EMAIL, password: PW, email_confirm: true })).data
    .user.id
  bId = (await admin.auth.admin.createUser({ email: B_EMAIL, password: PW, email_confirm: true })).data
    .user.id
  // профиль обязателен: materials.teacher_id → profiles(id). Триггер обычно
  // создаёт его сам, но подстрахуемся (admin обходит RLS).
  await admin.from('profiles').upsert({ id: aId, display_name: 'A' })
  await admin.from('profiles').upsert({ id: bId, display_name: 'B' })
  check('два ученика заведены', !!aId && !!bId)

  const A = userClient()
  await A.auth.signInWithPassword({ email: A_EMAIL, password: PW })
  const B = userClient()
  await B.auth.signInWithPassword({ email: B_EMAIL, password: PW })

  // A создаёт свой материал (RLS materials: teacher_id = свой uid)
  const { data: matA, error: mErrA } = await A.from('materials')
    .insert(mat(aId, 'A text'))
    .select()
    .single()
  check('ученик создаёт свой материал', !mErrA && !!matA, mErrA?.message ?? '')

  // B создаёт свой — чтобы проверить «на чужой материал нельзя»
  const { data: matB, error: mErrB } = await B.from('materials')
    .insert(mat(bId, 'B text'))
    .select()
    .single()
  check('второй ученик создаёт свой материал', !mErrB && !!matB, mErrB?.message ?? '')

  // ✅ A назначает СВОЙ материал СЕБЕ через RPC self_assign_material — проходит
  if (matA) {
    const { error } = await A.rpc('self_assign_material', { p_material_id: matA.id })
    check('ученик назначает свой материал СЕБЕ', !error, error?.message ?? '')
    if (!error) {
      const { data } = await A.from('material_assignments')
        .select('id')
        .eq('material_id', matA.id)
        .eq('student_id', aId)
      check('назначение реально создано', !!data && data.length === 1)
    }
  }

  // ❌ A назначает СЕБЕ ЧУЖОЙ материал (material B) — RPC должна отказать
  // (material_owned_by ложно). student_id подделать нельзя вовсе: RPC жёстко
  // берёт auth.uid(), параметра «кому» у неё нет.
  if (matB) {
    const { error } = await A.rpc('self_assign_material', { p_material_id: matB.id })
    check('на чужой материал назначить себе нельзя', !!error, error ? 'отказано' : 'ПРОШЛО — ДЫРА')
    const { data } = await admin
      .from('material_assignments')
      .select('id')
      .eq('material_id', matB.id)
      .eq('student_id', aId)
    check('чужой материал себе не приписан', !data || data.length === 0)
  }

  // ❌ Прямая вставка в material_assignments закрыта грантами (инвариант
  // «запись только через функции») — даже своему материалу
  if (matA) {
    const { error } = await A.from('material_assignments').insert({
      material_id: matA.id,
      student_id: aId,
    })
    check('прямая запись в таблицу закрыта', !!error, error ? 'заблокировано' : 'ПРОШЛО — ДЫРА')
  }
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  if (aId) await admin.auth.admin.deleteUser(aId).catch(() => {})
  if (bId) await admin.auth.admin.deleteUser(bId).catch(() => {})
  console.log('Тестовые аккаунты удалены (материалы/назначения ушли каскадом).')
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
  setTimeout(() => process.exit(process.exitCode ?? 0), 300)
}
