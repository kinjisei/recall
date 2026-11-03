/**
 * Замок сданного материала, версия упражнений и копия в самой базе (PLAN.md
 * Ф2.25-3б, миграция 0018; журнал п.76 (8), (21)).
 *
 * Всё — от имени учителя и учеников, как из браузера:
 *   • до сдачи правка проходит и версия растёт; правка из старой вкладки
 *     (версия не та) — отказ; прямой UPDATE таблицы закрыт;
 *   • ученик сдаёт старую версию — RECALL_MATERIAL_CHANGED, без версии
 *     (приложение до пуша) — сдаёт, как раньше;
 *   • после сдачи — RECALL_MATERIAL_LOCKED и на правку упражнений, и на текст
 *     (любым путём, хоть секретным ключом); после «Переназначить» — тоже;
 *     сданную работу убрали — замок снят;
 *   • копия — новый материал без выдач с тем же заголовком, текстом,
 *     упражнениями и планом, правится; чужой не скопировать и не поправить;
 *   • гонки: сдача держит строку материала — правка ждёт и упирается в замок;
 *     правка держит строку — сдача ждёт и видит новую версию.
 *
 * Правило «можно ли править» — то же, что у экрана (`domains/materials`
 * `editLock`): случаи из LOCK_CASES сверяются с ним.
 *
 * Краснеет без 0018 (нет версии и функций) и без `for share` в сдаче (гонки).
 * Запуск: node scripts/check-material-lock.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'
import { editLock } from '../src/domains/materials/lock.ts'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и сдаёт работы — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}
/** Ответ RPC — отказ с нашим кодом. */
const refused = (r, code) => !!r.error && String(r.error.message).includes(code)
const why = (r) => (r.error ? r.error.message : 'прошло')

const PASSWORD = 'LockCheck!2026'
const users = []
async function user(key, patch) {
  const email = `lock-check-${key}@recall.test`
  const old = await sql(`select id from auth.users where email = '${email}'`)
  if (old[0]) await deleteTestUser(admin, sql, old[0].id)
  await admin.from('allowed_emails').upsert({ email, note: 'check-material-lock (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(`аккаунт: ${error.message}`)
  users.push({ id: data.user.id, email })
  if (patch) await admin.from('profiles').update(patch).eq('id', data.user.id)
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)
  return { id: data.user.id, client }
}

const MCQ = { type: 'mcq', prompt: 'Why did Dana wait near the gate?', options: ['Her flight had a delay.', 'She was early.', 'She lost her bag.'], answer: 0 }
const FILL = { type: 'fill', prompt: 'She ___ (buy) a coffee.', answer: 'bought' }
const EXERCISES = [MCQ, FILL]
const EDITED = [{ ...MCQ, prompt: 'Why did Dana wait near the gate for three hours?' }, FILL]
const PLAN = { title: 'A long day at the airport', words: ['delay', 'gate'], exercises: [{ format: 'mcq', count: 1 }] }

/** Материал учителя (вставка — как «Сохранить» мастера); версия от клиента — 99, база обязана поставить 1. */
async function material(t, title = 'A long day at the airport') {
  const { data, error } = await t.client
    .from('materials')
    .insert({ teacher_id: t.id, lang: 'en', level: 'A2', topic: 'Airport', format: 'рассказ', length_range: '100-140', title, body: 'Dana waited near the gate.', exercises: EXERCISES, plan: PLAN, exercises_version: 99 })
    .select('id, exercises_version')
    .single()
  if (error) throw new Error(`материал: ${error.message}`)
  return data
}
async function assign(t, matId, s) {
  const { error } = await t.client.rpc('assign_material', { p_material_id: matId, p_student_id: s.id })
  if (error) throw new Error(`выдача: ${error.message}`)
  const [row] = await sql(`select id from public.material_assignments where material_id = '${matId}' and student_id = '${s.id}'`)
  return row.id
}
const version = async (id) => (await sql(`select exercises_version from public.materials where id = '${id}'`))[0]?.exercises_version
const save = (who, id, exercises, v) => who.client.rpc('save_material_exercises', { p_id: id, p_exercises: exercises, p_version: v })
const submit = (s, aid, v) => s.client.rpc('submit_material', { p_id: aid, p_answers: [{ index: 0, given: MCQ.options[0], auto_ok: true }], p_auto_score: 0, p_auto_total: 0, ...(v === undefined ? {} : { p_version: v }) })

/** SQL от имени пользователя одной транзакцией, со сном внутри — держит блокировки (гонки). */
const asUser = (uid, call, holdSec) =>
  sql(`begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
select ${call};
select pg_sleep(${holdSec});
commit;`)

/** Случаи правила «можно ли править» — общие с экраном (editLock). */
const LOCK_CASES = [
  { name: 'выдан, никто не сдал', rows: [{ status: 'assigned', attempts: null }], locked: false },
  { name: 'сдан, ждёт проверки', rows: [{ status: 'submitted', attempts: null }], locked: true },
  { name: 'проверен', rows: [{ status: 'reviewed', attempts: null }], locked: true },
  { name: 'переназначен (попытка в истории)', rows: [{ status: 'assigned', attempts: [{}] }], locked: true },
  { name: 'пустая история', rows: [{ status: 'assigned', attempts: [] }], locked: false },
]

try {
  const t = await user('teacher', { role: 'teacher' })
  const t2 = await user('teacher2', { role: 'teacher' })
  const s1 = await user('student1')
  const s2 = await user('student2')
  for (const s of [s1, s2]) await admin.from('teacher_students').upsert({ teacher_id: t.id, student_id: s.id }, { onConflict: 'teacher_id,student_id' })

  // ---- до сдачи: правка проходит, версия растёт ----------------------------
  const a = await material(t)
  check('новый материал — версия 1 (клиентская 99 не берётся)', a.exercises_version === 1, `версия ${a.exercises_version}`)
  const a1 = await assign(t, a.id, s1)
  const r1 = await save(t, a.id, EDITED, 1)
  check('до сдачи правка проходит, ответ — новая версия 2', !r1.error && r1.data === 2, why(r1))
  check('версия в базе — 2', (await version(a.id)) === 2)
  const same = await save(t, a.id, EDITED, 2)
  check('сохранить то же самое — версия не растёт', !same.error && same.data === 2, why(same))
  check('правка из старой вкладки (версия 1) — RECALL_MATERIAL_STALE', refused(await save(t, a.id, EXERCISES, 1), 'RECALL_MATERIAL_STALE'))
  const direct = await t.client.from('materials').update({ exercises: EXERCISES }).eq('id', a.id).select('id')
  check('прямой UPDATE таблицы закрыт', !!direct.error || (direct.data ?? []).length === 0, 'обновилось напрямую')
  for (const [name, bad] of [['не массив', { type: 'mcq' }], ['пустой массив', []], ['вид не из известных', [{ type: 'essay', prompt: 'x' }]]]) {
    check(`плохие упражнения (${name}) — RECALL_BAD_EXERCISES`, refused(await save(t, a.id, bad, 2), 'RECALL_BAD_EXERCISES'))
  }

  // ---- ученик сдаёт старую версию -------------------------------------------
  check('сдача старой версии — RECALL_MATERIAL_CHANGED', refused(await submit(s1, a1, 1), 'RECALL_MATERIAL_CHANGED'))
  check('после отказа работа не сдана', (await sql(`select status from public.material_assignments where id = '${a1}'`))[0]?.status === 'assigned')
  const noVersion = await submit(s1, a1)
  check('сдача без версии (приложение до пуша) проходит', !noVersion.error, why(noVersion))

  // ---- после сдачи — замок --------------------------------------------------
  check('после сдачи правка — RECALL_MATERIAL_LOCKED', refused(await save(t, a.id, EXERCISES, 2), 'RECALL_MATERIAL_LOCKED'))
  const body = await admin.from('materials').update({ body: 'Dana waited at gate 5.' }).eq('id', a.id)
  check('после сдачи текст не поменять даже секретным ключом — замок в триггере', refused(body, 'RECALL_MATERIAL_LOCKED'), why(body))
  const title = await admin.from('materials').update({ title: 'Airport' }).eq('id', a.id)
  check('заголовок — не упражнения и не текст: правится, версия та же', !title.error && (await version(a.id)) === 2, why(title))

  // ---- после «Переназначить» -------------------------------------------------
  const b = await material(t)
  const b1 = await assign(t, b.id, s1)
  await submit(s1, b1, 1)
  const fin = await t.client.rpc('finish_material_review', { p_id: b1, p_review: { items: [] } })
  const re = await t.client.rpc('reassign_material', { p_id: b1, p_note: 'ещё раз' })
  if (fin.error || re.error) throw new Error(`проверка и переназначение: ${why(fin)} / ${why(re)}`)
  check('после «Переназначить» (работа снова не сдана) — RECALL_MATERIAL_LOCKED', refused(await save(t, b.id, EDITED, 1), 'RECALL_MATERIAL_LOCKED'))

  // ---- сданную работу убрали — замок снят ----------------------------------
  const c = await material(t)
  const c1 = await assign(t, c.id, s1)
  await submit(s1, c1, 1)
  await t.client.rpc('unassign_material', { p_material_id: c.id, p_student_id: s1.id })
  const freed = await save(t, c.id, EDITED, 1)
  check('сданную работу убрали — правка снова проходит', !freed.error && freed.data === 2, why(freed))

  // ---- правило экрана = правило базы ----------------------------------------
  for (const k of LOCK_CASES) check(`экран: ${k.name} — ${k.locked ? 'закрыт' : 'правится'}`, editLock(k.rows).locked === k.locked)

  // ---- копия ------------------------------------------------------------------
  const cp = await t.client.rpc('copy_material', { p_id: a.id })
  check('копия сданного создаётся', !cp.error && typeof cp.data === 'string', why(cp))
  if (cp.data) {
    const [src] = await sql(`select title, body, exercises, plan, lang, level, topic, format, length_range from public.materials where id = '${a.id}'`)
    const [dst] = await sql(`select teacher_id, title, body, exercises, plan, lang, level, topic, format, length_range, exercises_version from public.materials where id = '${cp.data}'`)
    const keys = ['title', 'body', 'exercises', 'plan', 'lang', 'level', 'topic', 'format', 'length_range']
    check('копия — тот же заголовок, текст, упражнения и план', keys.every((k) => JSON.stringify(src[k]) === JSON.stringify(dst[k])), keys.filter((k) => JSON.stringify(src[k]) !== JSON.stringify(dst[k])).join(', '))
    check('копия — учителя, версия 1', dst.teacher_id === t.id && dst.exercises_version === 1)
    const [n] = await sql(`select count(*)::int as n from public.material_assignments where material_id = '${cp.data}'`)
    check('у копии нет выдач', n.n === 0)
    // в копии — уже поправленные упражнения (EDITED): правка — обратно к прежним
    const edit = await save(t, cp.data, EXERCISES, 1)
    check('копия правится', !edit.error && edit.data === 2, why(edit))
  }
  check('чужой материал не скопировать (другой учитель)', refused(await t2.client.rpc('copy_material', { p_id: a.id }), 'RECALL_MATERIAL_NOT_FOUND'))
  check('чужой материал не скопировать (ученик, которому он выдан)', refused(await s1.client.rpc('copy_material', { p_id: a.id }), 'RECALL_MATERIAL_NOT_FOUND'))
  check('чужой материал не поправить', refused(await save(t2, c.id, EXERCISES, 2), 'RECALL_MATERIAL_NOT_FOUND'))

  // ---- гонка 1: сдача держит строку — правка ждёт и упирается в замок -------
  const d = await material(t)
  const d2 = await assign(t, d.id, s2)
  const hold1 = asUser(s2.id, `public.submit_material('${d2}', '[]'::jsonb, 0, 0, 1)`, 5)
  await sleep(2000)
  let t0 = Date.now()
  const race1 = await save(t, d.id, EDITED, 1)
  const waited1 = Date.now() - t0
  await hold1
  check('гонка: правка во время сдачи ждёт её конца и получает замок', refused(race1, 'RECALL_MATERIAL_LOCKED') && waited1 > 1000, `${why(race1)}, ждала ${waited1} мс`)

  // ---- гонка 2: правка держит строку — сдача ждёт и видит новую версию ------
  const e = await material(t)
  const e2 = await assign(t, e.id, s2)
  const hold2 = asUser(t.id, `public.save_material_exercises('${e.id}', '${JSON.stringify(EDITED).replace(/'/g, "''")}'::jsonb, 1)`, 5)
  await sleep(2000)
  t0 = Date.now()
  const race2 = await submit(s2, e2, 1)
  const waited2 = Date.now() - t0
  await hold2
  check('гонка: сдача во время правки ждёт её конца и получает «Учитель обновил задание»', refused(race2, 'RECALL_MATERIAL_CHANGED') && waited2 > 1000, `${why(race2)}, ждала ${waited2} мс`)
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
