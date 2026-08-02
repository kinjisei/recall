// ============================================================================
// RLS-смоук «Письмо» (Заход 5a): создание задания, назначение, изоляция чужих,
// запрет прямой записи, отвязка отбирает доступ.
// Запуск: node scripts/smoke-writing.mjs  (ПОСЛЕ заливки schema.sql)
// Сам создаёт и удаляет учителя+ученицу+постороннего через service_role.
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
const ok = (n, c) => { console.log(`${c ? '✓' : '✗'} ${n}`); c ? pass++ : fail++ }

const T = { email: 'w-teacher@recall.test', pass: 'W!T2026' }
const S = { email: 'w-student@recall.test', pass: 'W!S2026' }
const O = { email: 'w-outsider@recall.test', pass: 'W!O2026' }
const ids = {}
async function ensure(u, patch) {
  await admin.from('allowed_emails').upsert({ email: u.email, note: 'wsmoke' })
  const { data } = await admin.auth.admin.createUser({ email: u.email, password: u.pass, email_confirm: true })
  let id = data?.user?.id
  if (!id) { const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 }); id = l.users.find((x) => x.email === u.email)?.id }
  if (patch) await admin.from('profiles').update(patch).eq('id', id)
  return id
}

try {
  const yearAhead = new Date(Date.now() + 365 * 864e5).toISOString()
  ids.t = await ensure(T, { role: 'teacher', plan: 'teacher_pro', plan_expires_at: yearAhead })
  ids.s = await ensure(S, null)
  ids.o = await ensure(O, null)
  const tc = mk(); await tc.auth.signInWithPassword({ email: T.email, password: T.pass })
  const sc = mk(); await sc.auth.signInWithPassword({ email: S.email, password: S.pass })
  const oc = mk(); await oc.auth.signInWithPassword({ email: O.email, password: O.pass })

  const { data: code } = await tc.rpc('ensure_invite_code')
  await sc.rpc('join_teacher', { code })

  // 1) учитель создаёт задание (прямая вставка, RLS teacher_id=auth.uid())
  const { data: task, error: insErr } = await tc.from('writing_tasks').insert({
    teacher_id: ids.t, lang: 'en', mode: 'ielts', level: 'B2',
    prompt: 'Some people think exams are the best way to assess students. Discuss.',
    settings: { ieltsTask: 'task2', targetBand: 6.5 },
  }).select().single()
  ok('учитель создал задание', !insErr && !!task?.id)

  // 2) посторонний НЕ может создать задание от имени учителя
  const { error: fakeTask } = await oc.from('writing_tasks').insert({
    teacher_id: ids.t, lang: 'en', mode: 'ielts', level: 'B2', prompt: 'fake', settings: {},
  })
  ok('посторонний НЕ создаёт задание за учителя (RLS)', !!fakeTask)

  // 3) назначение своей ученице
  const { error: asgErr } = await tc.rpc('assign_writing_task', { p_task_id: task.id, p_student_id: ids.s })
  ok('учитель назначил задание ученице', !asgErr)

  // 4) ученица видит задание с текстом вопроса
  const { data: my } = await sc.from('writing_task_assignments').select('*, writing_tasks(*)').eq('student_id', ids.s)
  const a = (my ?? [])[0]
  ok('ученица видит назначение и вопрос', !!a && a.writing_tasks?.prompt?.includes('exams'))

  // 5) посторонний НЕ видит ни задание, ни назначение
  const { data: leakTask } = await oc.from('writing_tasks').select('*').eq('id', task.id)
  const { data: leakAsg } = await oc.from('writing_task_assignments').select('*').eq('id', a.id)
  ok('посторонний НЕ видит чужое задание/назначение (RLS)', (leakTask ?? []).length === 0 && (leakAsg ?? []).length === 0)

  // 6) прямая запись в назначения запрещена (только через RPC)
  const { error: directIns } = await sc.from('writing_task_assignments').insert({ task_id: task.id, student_id: ids.s })
  ok('прямой insert в назначения запрещён (revoke)', !!directIns)
  const { error: directUpd } = await sc.from('writing_task_assignments').update({ band: '9.0', status: 'reviewed' }).eq('id', a.id)
  ok('прямой update назначения запрещён (revoke)', !!directUpd)

  // 7) посторонний НЕ может назначить чужое задание чужой ученице
  const { error: fakeAssign } = await oc.rpc('assign_writing_task', { p_task_id: task.id, p_student_id: ids.s })
  ok('посторонний НЕ назначает чужое задание (RPC-проверка прав)', !!fakeAssign)

  // 8) ученица сдаёт работу (submit_writing) — Заход 5b
  const grade1 = { band: 5.5, criteria: { task: 5, coherence: 6, lexis: 5, grammar: 6 }, errors: [{ was: 'exams is', fix: 'exams are' }] }
  const { error: subErr } = await sc.rpc('submit_writing', { p_id: a.id, p_essay: 'First draft.', p_grade: grade1, p_band: '5.5' })
  ok('ученица сдала письмо (submit_writing)', !subErr)

  const { data: after1 } = await sc.from('writing_task_assignments').select('*').eq('id', a.id).single()
  ok('статус submitted, essay/band/ai_review записаны', after1?.status === 'submitted' && after1?.essay === 'First draft.' && after1?.band === '5.5' && !!after1?.ai_review)
  ok('в истории attempts 1 попытка', Array.isArray(after1?.attempts) && after1.attempts.length === 1)

  // 9) самопересдача (пока не проверено) — новая попытка в истории
  const { error: reErr } = await sc.rpc('submit_writing', { p_id: a.id, p_essay: 'Second, better draft.', p_grade: { band: 6.5 }, p_band: '6.5' })
  ok('самопересдача разрешена (не проверено)', !reErr)
  const { data: after2 } = await sc.from('writing_task_assignments').select('*').eq('id', a.id).single()
  ok('attempts выросли до 2, band обновлён', Array.isArray(after2?.attempts) && after2.attempts.length === 2 && after2.band === '6.5')

  // 10) чужая ученица НЕ может сдать это задание
  const { error: fakeSub } = await oc.rpc('submit_writing', { p_id: a.id, p_essay: 'hack', p_grade: {}, p_band: 'x' })
  const { data: notLeaked } = await oc.from('writing_task_assignments').select('*').eq('id', a.id)
  ok('посторонний НЕ сдаёт чужую работу', (notLeaked ?? []).length === 0 || !!fakeSub)

  // 11) учитель видит сданную работу с текстом
  const { data: teacherSees } = await tc.from('writing_task_assignments').select('*').eq('id', a.id).single()
  ok('учитель видит сданную работу (essay+band)', teacherSees?.essay === 'Second, better draft.' && teacherSees?.band === '6.5')

  // 12) отвязка отбирает у учителя доступ к назначению (USING-фикс)
  await admin.from('teacher_students').delete().eq('teacher_id', ids.t).eq('student_id', ids.s)
  const { data: afterUnlink } = await tc.from('writing_task_assignments').select('*').eq('id', a.id)
  ok('после отвязки учитель НЕ видит назначение', (afterUnlink ?? []).length === 0)
} catch (e) {
  console.log('ОШИБКА:', String(e).slice(0, 200)); fail++
} finally {
  for (const id of Object.values(ids)) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  for (const e of [T.email, S.email, O.email]) { try { await admin.from('allowed_emails').delete().eq('email', e) } catch {} }
}
console.log(`\n${pass}/${pass + fail} ок`)
process.exit(fail ? 1 : 0)
