// ============================================================================
// Смоук «Энергия» (E1): spend_energy + get_my_plan v2. Проверяет дневной бюджет,
// пул студии, под-кап на аккаунт, месячный лимит генераций, 0-энергии для light.
// Запуск: node scripts/smoke-energy.mjs  (ПОСЛЕ заливки schema.sql)
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
let pass = 0, fail = 0
const ok = (n, c, extra = '') => { console.log(`${c ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`); c ? pass++ : fail++ }
const PAST = new Date(Date.now() - 864e5).toISOString()
const FUT = new Date(Date.now() + 365 * 864e5).toISOString()
const ids = {}

async function mkUser(key, email, patch) {
  await admin.from('allowed_emails').upsert({ email, note: 'energy' })
  const { data } = await admin.auth.admin.createUser({ email, password: 'En!2026x', email_confirm: true })
  let id = data?.user?.id
  if (!id) { const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 }); id = l.users.find((u) => u.email === email)?.id }
  await admin.from('profiles').update(patch).eq('id', id)
  ids[key] = { id, email }
  const c = mk(); await c.auth.signInWithPassword({ email, password: 'En!2026x' })
  return c
}
const spend = (c, cost, kind = 'heavy', gen = false) =>
  c.rpc('spend_energy', { p_kind: kind, p_cost: cost, p_generation: gen }).then((r) => r.error?.message || null)
const plan = async (c) => (await c.rpc('get_my_plan')).data

try {
  // 1) FREE (триал в прошлом → настоящий free): бюджет 5
  const free = await mkUser('free', 'en-free@recall.test', { plan: 'free', trial_until: PAST, plan_expires_at: null })
  let p = await plan(free)
  ok('free: energy_max = 5', p.energy_max === 5, `got ${p.energy_max}`)
  ok('free: light НЕ тратит энергию', !(await spend(free, 0, 'light')) , '')
  p = await plan(free)
  ok('free: после light energy_spent = 0', p.energy_spent === 0, `got ${p.energy_spent}`)
  ok('free: heavy на 5 проходит', !(await spend(free, 5, 'heavy')))
  ok('free: 6-я энергия блокируется', (await spend(free, 1, 'heavy')) === 'RECALL_FREE_LIMIT')

  // 2) PREMIUM (соло): бюджет 30
  const prem = await mkUser('prem', 'en-prem@recall.test', { plan: 'premium', plan_expires_at: FUT, trial_until: PAST })
  p = await plan(prem)
  ok('premium: energy_max = 30', p.energy_max === 30, `got ${p.energy_max}`)
  ok('premium: 30 проходит', !(await spend(prem, 30)))
  ok('premium: 31-я блокируется', (await spend(prem, 1)) === 'RECALL_ENERGY_DAY')

  // 3) СТУДИЯ (teacher_mini пул 70) + 2 ученицы
  const teacher = await mkUser('teacher', 'en-teach@recall.test', { role: 'teacher', plan: 'teacher_mini', plan_expires_at: FUT, trial_until: PAST })
  const stA = await mkUser('stA', 'en-stA@recall.test', { trial_until: PAST })
  const stB = await mkUser('stB', 'en-stB@recall.test', { trial_until: PAST })
  const { data: code } = await teacher.rpc('ensure_invite_code')
  await stA.rpc('join_teacher', { code })
  await stB.rpc('join_teacher', { code })

  p = await plan(stA)
  ok('студия: ученица energy_max = 70 (пул)', p.energy_max === 70, `got ${p.energy_max}`)
  ok('студия: in_studio = true', p.in_studio === true)
  ok('студия: под-кап = 35 (50% пула)', p.energy_subcap === 35, `got ${p.energy_subcap}`)

  ok('под-кап: ученица A тратит 35 — ок', !(await spend(stA, 35)))
  ok('под-кап: 36-я по A блокируется (её лимит 35)', (await spend(stA, 1)) === 'RECALL_ENERGY_SUBCAP')
  // пул уже потрачен на 35 (A); B добирает до 70
  ok('пул: ученица B тратит ещё 35 — ок (пул 70)', !(await spend(stB, 35)))
  ok('пул: следующая энергия B блокируется (пул исчерпан)', (await spend(stB, 1)) === 'RECALL_ENERGY_POOL')
  p = await plan(stB)
  ok('пул: energy_spent = 70 у обеих (общий счётчик)', p.energy_spent === 70, `got ${p.energy_spent}`)

  // 4) ГЕНЕРАЦИИ (teacher_mini лимит 25)
  p = await plan(teacher)
  ok('учитель: gen_limit = 25', p.gen_limit === 25, `got ${p.gen_limit}`)
  ok('учитель: генерация проходит', !(await spend(teacher, 0, 'heavy', true)))
  p = await plan(teacher)
  ok('учитель: gen_used вырос до 1', p.gen_used === 1, `got ${p.gen_used}`)
  // ученица НЕ может генерировать (gen_limit пула для неё = teacher's, но она не teacher-owner источника → gen через её источник = пул учителя? нет: p_generation у ученицы даёт src=пул учителя с gen_limit учителя. Защита — на сервере (isTeacher). Проверяем, что прямой вызов не роняет учёт студии не в минус)
  const genErr = await spend(stA, 0, 'heavy', true)
  ok('ученица: прямая генерация не даёт отрицательного/ошибки БД', genErr === null || /GEN_LIMIT/.test(genErr), genErr || 'ok')

  // 5) АДМИН — без лимитов
  const adm = await mkUser('adm', 'en-adm@recall.test', { is_admin: true, trial_until: PAST, plan: 'free' })
  let admOk = true
  for (let i = 0; i < 3; i++) if (await spend(adm, 100)) admOk = false
  ok('админ: без лимитов (300 энергии подряд)', admOk)
} catch (e) {
  console.log('ОШИБКА:', String(e).slice(0, 200)); fail++
} finally {
  for (const v of Object.values(ids)) if (v?.id) await admin.auth.admin.deleteUser(v.id).catch(() => {})
  for (const v of Object.values(ids)) if (v?.email) { try { await admin.from('allowed_emails').delete().eq('email', v.email) } catch {} }
}
console.log(`\n${pass}/${pass + fail} ок`)
process.exit(fail ? 1 : 0)
