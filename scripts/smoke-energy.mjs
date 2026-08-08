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

// Аккаунт от прошлого прогона переиспользуем и приводим к известному состоянию.
// Не удаляем и не пересоздаём: удаление в Supabase асинхронное, и следом
// createUser падает с «already been registered».
// Две ошибки, которые тут были и стоили часа отладки:
//   1) адрес искали регистрозависимо, а Supabase хранит его в нижнем регистре —
//      id оставался undefined, профиль не настраивался, счётчики не чистились,
//      и тест шёл на протухшем состоянии (у «свежей» ученицы уже 35 потрачено);
//   2) без сброса ai_calls лимиты «плавали» между прогонами.
const BASE = {
  role: 'learner', is_admin: false, plan: 'free', plan_expires_at: null,
  trial_until: PAST, created_at: new Date().toISOString(),
}
async function mkUser(key, email, patch) {
  await admin.from('allowed_emails').upsert({ email, note: 'energy' })
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  // Supabase хранит адрес в НИЖНЕМ регистре: 'en-stA@…' в списке лежит как
  // 'en-sta@…'. Сравнение без приведения регистра не находило аккаунт — id
  // оставался undefined, профиль не настраивался, тест шёл на протухшем состоянии.
  const key_ = email.toLowerCase()
  let id = list?.users?.find((u) => (u.email ?? '').toLowerCase() === key_)?.id
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: 'En!2026x', email_confirm: true,
    })
    id = data?.user?.id
    if (!id) throw new Error(`не удалось создать ${email}: ${error?.message ?? 'нет id'}`)
  }
  const { error: upErr } = await admin.from('profiles').update({ ...BASE, ...patch }).eq('id', id)
  if (upErr) throw new Error(`профиль ${email}: ${upErr.message}`)
  await admin.from('ai_calls').delete().eq('user_id', id)
  await admin.from('teacher_students').delete().or(`teacher_id.eq.${id},student_id.eq.${id}`)
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

  // 1b) ТРИАЛ ступенькой: 30 первые 3 дня, дальше 15 (решение владельца 06.08.2026).
  // Свежий аккаунт — created_at сегодня.
  const trialNew = await mkUser('trialNew', 'en-trial-new@recall.test', {
    plan: 'free', plan_expires_at: null, trial_until: FUT,
  })
  p = await plan(trialNew)
  ok('триал, день 1: energy_max = 30', p.energy_max === 30, `got ${p.energy_max}`)

  // Переводы: было 300 в сутки, стало 150. Набиваем 149 записей напрямую,
  // 150-я должна пройти через RPC, 151-я — упереться.
  //
  // Записи ставим на 2 часа назад: часовой предохранитель (90 запросов/час у
  // премиум-уровня) сработал бы раньше суточного и проверял бы не то.
  //
  // ⚠️ Полтора часа после местной полуночи проверить это НЕЛЬЗЯ, и раньше
  // смоук там честно краснел на исправном коде. Причина: суточный счётчик
  // считает от начала дня в Алматы, а «2 часа назад» в 00:30 — это ещё вчера,
  // и подсев не учитывается. Сдвинуть подсев внутрь суток тоже не выйдет:
  // тогда 149 записей попадут в текущий час и первым сработает ЧАСОВОЙ лимит.
  // Окна физически не пересекаются — поэтому в это время шаг пропускается
  // ГРОМКО, а не превращается в ложный отказ.
  const dayStartMs = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Almaty' }))
    .setHours(0, 0, 0, 0)
  const sinceDayStartMin = (Date.now() - dayStartMs) / 60000
  if (sinceDayStartMin < 100) {
    console.log(
      `⏭ пропущено: суточный лимит переводов (прошло ${Math.round(sinceDayStartMin)} мин ` +
        'от начала суток — суточное и часовое окна пересекаются)',
    )
  } else {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600e3).toISOString()
    await admin.from('ai_calls').insert(
      Array.from({ length: 149 }, () => ({
        user_id: ids.trialNew.id, kind: 'light', cost_energy: 0, called_at: twoHoursAgo,
      })),
    )
    ok('триал: 150-й перевод проходит', !(await spend(trialNew, 0, 'light')))
    ok(
      'триал: 151-й перевод упирается (лимит 150, а не 300)',
      (await spend(trialNew, 0, 'light')) === 'RECALL_LIGHT_LIMIT',
    )
    await admin.from('ai_calls').delete().eq('user_id', ids.trialNew.id)
  }

  // Тот же аккаунт, но «зарегистрирован» 5 дней назад → хвост триала
  await admin
    .from('profiles')
    .update({ created_at: new Date(Date.now() - 5 * 864e5).toISOString() })
    .eq('id', ids.trialNew.id)
  p = await plan(trialNew)
  ok('триал, день 5: energy_max = 15', p.energy_max === 15, `got ${p.energy_max}`)
  ok('триал: 15 проходит', !(await spend(trialNew, 15)))
  ok('триал: 16-я блокируется', (await spend(trialNew, 1)) === 'RECALL_ENERGY_DAY')

  // 2) PREMIUM (соло): бюджет 30 — оплаченный тариф ступенькой НЕ режется
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

  const errA = await spend(stA, 35)
  ok('под-кап: ученица A тратит 35 — ок', !errA, errA ?? '')
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
