/**
 * Ответы онбординга в /admin (PLAN.md Ф2.11б-4, миграция 0013, журнал п.73).
 *
 * Онбординг пишет «Сколько у тебя учеников?» (событие teacher_students) и
 * «Откуда ты о нас знаешь?» (how_heard). До 0013 ответы «Как узнал» лежали в
 * events и нигде не показывались. admin_onboarding_answers сводит их для
 * владельца.
 *
 * Что доказывает:
 *   1. считает ЛЮДЕЙ: два одинаковых ответа одного человека — один;
 *   2. берёт ПОСЛЕДНИЙ ответ: передумал «1–5» → «6–10» — засчитан «6–10»,
 *      а «1–5» не засчитан вовсе;
 *   3. делит по роли: репетитор — в teachers, ученик и аноним — в others;
 *   4. окно дней: ответ старше окна не считается, в окне шире — считается;
 *   5. длинное значение режется до 40 знаков;
 *   6. не владельцу — RECALL_NOT_ADMIN, анониму функция закрыта.
 * Краснеет, если функция считает события, а не людей; берёт первый ответ;
 * не делит по ролям; не проверяет is_admin.
 *
 * Значения ответов — с меткой прогона: чужие события тестовой базы сводку
 * не трогают.
 *
 * Запуск: node scripts/check-onboarding-answers.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и пишет события — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const client = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const results = []
const check = (name, ok, extra = '') => {
  results.push(!!ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

const PASSWORD = 'OnbAnswers!2026'
const USERS = {
  owner: 'onb-answers-owner@recall.test',
  teacher: 'onb-answers-teacher@recall.test',
  student: 'onb-answers-student@recall.test',
}
const TAG = `chk${Date.now().toString(36)}`
const v = (s) => `${TAG}-${s}`
const ids = []

async function makeUser(email) {
  const old = await sql(`select id from auth.users where email = '${email}'`)
  if (old[0]) await cleanup(old[0].id)
  await admin.from('allowed_emails').upsert({ email, note: 'check-onboarding-answers (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(`аккаунт ${email}: ${error.message}`)
  ids.push(data.user.id)
  const c = client()
  const { error: e2 } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход ${email}: ${e2.message}`)
  return { id: data.user.id, c }
}

async function cleanup(id) {
  await sql(`delete from public.events where user_id = '${id}'`)
  await deleteTestUser(admin, sql, id)
}

/** Ответ так же, как его шлёт клиент (lib/analytics: track). */
const answer = (c, name, value, anon) =>
  c.rpc('track_event', { p_name: name, p_props: { value }, ...(anon ? { p_anon: anon } : {}) }).then((r) => r.error?.message ?? null)

/** Строка сводки по значению этого прогона или null. */
async function summary(c, days = 30) {
  const { data, error } = await c.rpc('admin_onboarding_answers', { p_days: days })
  if (error) throw new Error(`сводка: ${error.message}`)
  const mine = data.filter((r) => r.value.startsWith(TAG))
  return (question, value) => mine.find((r) => r.question === question && r.value === value) ?? null
}

const anonId = randomUUID()
try {
  const owner = await makeUser(USERS.owner)
  await sql(`update public.profiles set is_admin = true where id = '${owner.id}'`)
  const teacher = await makeUser(USERS.teacher)
  await sql(`update public.profiles set role = 'teacher' where id = '${teacher.id}'`)
  const student = await makeUser(USERS.student)

  // репетитор передумал: 1–5 → 6–10; ответил, откуда узнал
  for (const [c, name, value] of [
    [teacher.c, 'teacher_students', v('1-5')],
    [teacher.c, 'teacher_students', v('6-10')],
    [teacher.c, 'how_heard', v('colleague')],
    [student.c, 'how_heard', v('friends')],
    [student.c, 'how_heard', v('friends')],
  ]) {
    const err = await answer(c, name, value)
    if (err) throw new Error(`track_event: ${err}`)
  }
  // аноним — до входа, со своим anon_id
  const anonErr = await answer(client(), 'how_heard', v('search'), anonId)
  if (anonErr) throw new Error(`track_event анонима: ${anonErr}`)
  // старый ответ — 40 дней назад; длинный — 60 знаков
  await sql(`insert into public.events (user_id, name, props, created_at)
             values ('${student.id}', 'teacher_students', '{"value":"${v('old')}"}', now() - interval '40 days')`)
  const long = v('x'.repeat(60))
  if ((await answer(teacher.c, 'how_heard', long)) !== null) throw new Error('track_event: длинный ответ')

  const row = await summary(owner.c)
  const six = row('students', v('6-10'))
  check('последний ответ: «6–10» у репетитора засчитан', six?.teachers === 1 && six?.others === 0, JSON.stringify(six))
  check('передуманный «1–5» не засчитан', row('students', v('1-5')) === null, JSON.stringify(row('students', v('1-5'))))
  // у репетитора последний how_heard — длинный, значит «от коллеги» у него уже не последний
  check('«Как узнал» — тоже последний ответ человека', row('heard', v('colleague')) === null, JSON.stringify(row('heard', v('colleague'))))
  const cut = row('heard', long.slice(0, 40))
  check('длинный ответ обрезан до 40 знаков и засчитан репетитору', cut?.teachers === 1 && cut?.others === 0, JSON.stringify(cut))
  const friends = row('heard', v('friends'))
  check('два одинаковых ответа ученика — один человек', friends?.others === 1 && friends?.teachers === 0, JSON.stringify(friends))
  const search = row('heard', v('search'))
  check('ответ анонима — среди остальных', search?.others === 1, JSON.stringify(search))
  check('ответ старше окна (40 дн при 30) не считается', row('students', v('old')) === null)
  const wide = (await summary(owner.c, 60))('students', v('old'))
  check('…а в окне 60 дн считается', wide?.others === 1, JSON.stringify(wide))

  const notAdmin = await teacher.c.rpc('admin_onboarding_answers', { p_days: 30 })
  check('не владельцу — RECALL_NOT_ADMIN', /RECALL_NOT_ADMIN/.test(notAdmin.error?.message ?? ''), notAdmin.error?.message ?? 'прошло')
  const anon = await client().rpc('admin_onboarding_answers', { p_days: 30 })
  check('анониму функция закрыта', !!anon.error && !/RECALL_NOT_ADMIN/.test(anon.error.message), anon.error?.message ?? 'прошло')
} catch (e) {
  check('проверка дошла до конца', false, String(e?.message ?? e))
} finally {
  await sql(`delete from public.events where anon_id = '${anonId}'`).catch(() => {})
  for (const id of ids) await cleanup(id)
  await admin.from('allowed_emails').delete().in('email', Object.values(USERS))
}

const ok = results.filter(Boolean).length
console.log(`\n${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
