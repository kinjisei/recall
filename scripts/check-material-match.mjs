/**
 * «Соедини пары» в самой базе (PLAN.md Ф2.25-1а, миграция 0017): сервер
 * начисляет балл за каждую верную пару, и счёт работы — в баллах.
 *
 * Случаи — те же, что у клиента (`_match-cases.mjs`; клиент —
 * `test-match-score.mjs`): для каждого — материал, назначение ученику и сдача
 * через `submit_material` от его имени, как из браузера. Затем `auto_score`
 * и `auto_total` в базе обязаны совпасть с ожидаемым — и с тем, что показал
 * бы экран. Сверх случаев: присланные клиентом баллы сервер не берёт.
 *
 * Краснеет без миграции 0017 (пары не считаются: «3 из 4 пар» дают 0 из 1)
 * и если сервер разойдётся с клиентом в сверке пары.
 *
 * Запуск: node scripts/check-material-match.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'
import { MATCH_CASES } from './_match-cases.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и сдаёт работы — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

const PASSWORD = 'MatchCheck!2026'
const users = []
async function user(key, patch) {
  const email = `match-check-${key}@recall.test`
  const old = await sql(`select id from auth.users where email = '${email}'`)
  if (old[0]) await deleteTestUser(admin, sql, old[0].id)
  await admin.from('allowed_emails').upsert({ email, note: 'check-material-match (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(`аккаунт: ${error.message}`)
  users.push({ id: data.user.id, email })
  if (patch) await admin.from('profiles').update(patch).eq('id', data.user.id)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)
  return { id: data.user.id, client }
}

/** Материал с упражнениями случая, назначенный ученику; вернёт id назначения. */
async function assign(teacherId, studentId, exercises) {
  const { data: mat, error } = await admin
    .from('materials')
    .insert({ teacher_id: teacherId, lang: 'en', level: 'A2', topic: 'Airport', format: 'рассказ', length_range: '100-140', title: 'A long day at the airport', body: 'Dana waited at the gate.', exercises })
    .select('id')
    .single()
  if (error) throw new Error(`материал: ${error.message}`)
  const { data: a, error: e2 } = await admin.from('material_assignments').insert({ material_id: mat.id, student_id: studentId }).select('id').single()
  if (e2) throw new Error(`назначение: ${e2.message}`)
  return a.id
}

try {
  const t = await user('teacher', { role: 'teacher' })
  const s = await user('student')
  await admin.from('teacher_students').upsert({ teacher_id: t.id, student_id: s.id }, { onConflict: 'teacher_id,student_id' })

  for (const c of MATCH_CASES) {
    const id = await assign(t.id, s.id, c.exercises)
    // баллы от клиента — заведомо ложные: сервер обязан их не брать
    const { error } = await s.client.rpc('submit_material', { p_id: id, p_answers: c.answers, p_auto_score: 999, p_auto_total: 999 })
    if (error) {
      check(c.name, false, error.message)
      continue
    }
    const [row] = await sql(`select auto_score, auto_total, status from public.material_assignments where id = '${id}'`)
    check(
      c.name,
      row.auto_score === c.expect.got && row.auto_total === c.expect.of && row.status === 'submitted',
      `сервер: ${row.auto_score} из ${row.auto_total} (${row.status}), ждали ${c.expect.got} из ${c.expect.of}`,
    )
  }

  // ответы с парами сохраняются как прислал ученик — их читает проверка учителя (d18)
  const id = await assign(t.id, s.id, MATCH_CASES[0].exercises)
  await s.client.rpc('submit_material', { p_id: id, p_answers: MATCH_CASES[0].answers, p_auto_score: 0, p_auto_total: 0 })
  const [row] = await sql(`select answers from public.material_assignments where id = '${id}'`)
  check('пары ученика сохранены в ответе', JSON.stringify(row.answers?.[0]?.pairs) === JSON.stringify(MATCH_CASES[0].answers[0].pairs))
  // сданную второй раз не сдать
  const again = await s.client.rpc('submit_material', { p_id: id, p_answers: [], p_auto_score: 0, p_auto_total: 0 })
  check('сданную работу второй раз не сдать', !!again.error)
} catch (e) {
  check(`сбой: ${e.message}`, false)
} finally {
  for (const u of users) {
    await deleteTestUser(admin, sql, u.id).catch((e) => console.log(`  ⚠ ${e.message}`))
    await admin.from('allowed_emails').delete().eq('email', u.email)
  }
}
const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
