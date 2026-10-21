/**
 * «Сделал» у пунктов программы в самой базе (PLAN.md Ф2.17-4г-1, миграция
 * 0015). Функция открыта каждому вошедшему, поэтому проверяем её так, как
 * позвал бы браузер — учеником, учителем и посторонним.
 *
 * Что доказывает:
 *   1. ученик отмечает пункт своей активной программы, снимает отметку,
 *      повторная отметка — без второй строки;
 *   2. номера вне программы — RECALL_BAD_PLAN_ITEM (минус, неделя и пункт за
 *      краем, null);
 *   3. учитель отметить за ученика не может, посторонний — тоже
 *      (RECALL_PLAN_NOT_FOUND); прямая запись в таблицу закрыта;
 *   4. отметки видит ученик и его учитель, посторонний — нет;
 *   5. программа в архиве (её заменили) — отмечать нельзя.
 * Краснеет без миграции 0015 (функции и таблицы нет).
 *
 * Запуск: node scripts/check-plan-marks.mjs   (только тестовая база)
 */
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты и программы — только тестовая база.')
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

const PASSWORD = 'PlanMarks!2026'
const users = []
async function user(key) {
  const email = `plan-marks-${key}@recall.test`
  const old = await sql(`select id from auth.users where email = '${email}'`)
  if (old[0]) await deleteTestUser(admin, sql, old[0].id)
  await admin.from('allowed_emails').upsert({ email, note: 'check-plan-marks (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(`аккаунт: ${error.message}`)
  users.push({ id: data.user.id, email })
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)
  return { id: data.user.id, client }
}

const WEEKS = [
  { title: 'Неделя 1', focus: 'связки', items: [{ type: 'grammar', title: 'Although', note: '' }, { type: 'words', title: 'Буксующие', note: '' }] },
  { title: 'Неделя 2', focus: 'работа', items: [{ type: 'reading', title: 'Remote work', note: '' }] },
]
const newPlan = async (t, studentId) => {
  const r = await t.client.rpc('replace_study_plan', {
    p_student_id: studentId, p_lang: 'en', p_level: 'B1', p_goal: '', p_summary: '', p_weeks: WEEKS,
  })
  if (r.error) throw new Error(`программа: ${r.error.message}`)
  return r.data
}
const mark = async (client, plan, week, item, done = true) => {
  const r = await client.rpc('set_plan_item_done', { p_plan_id: plan, p_week: week, p_item: item, p_done: done })
  return r.error ? r.error.message : 'ok'
}
const marksOf = async (client, plan) => {
  const r = await client.from('study_plan_marks').select('week, item').eq('plan_id', plan).order('week').order('item')
  return r.error ? `ошибка: ${r.error.message}` : JSON.stringify(r.data.map((m) => [m.week, m.item]))
}

try {
  const t = await user('teacher')
  const s = await user('student')
  const other = await user('other')
  await sql(`insert into public.teacher_students (teacher_id, student_id) values ('${t.id}', '${s.id}')`)
  const plan = await newPlan(t, s.id)

  // 1. ученик отмечает и снимает
  check('1. ученик отмечает пункт', (await mark(s.client, plan, 0, 1)) === 'ok')
  check('1. повтор — без второй строки', (await mark(s.client, plan, 0, 1)) === 'ok' && (await marksOf(s.client, plan)) === '[[0,1]]', await marksOf(s.client, plan))
  check('1. отметка последнего пункта последней недели', (await mark(s.client, plan, 1, 0)) === 'ok')
  check('1. снятие отметки', (await mark(s.client, plan, 1, 0, false)) === 'ok' && (await marksOf(s.client, plan)) === '[[0,1]]', await marksOf(s.client, plan))

  // 2. границы
  for (const [w, i, why] of [[-1, 0, 'неделя −1'], [2, 0, 'неделя за краем'], [1, 1, 'пункт за краем'], [0, -1, 'пункт −1'], [null, 0, 'неделя null']]) {
    const r = await mark(s.client, plan, w, i)
    check(`2. ${why} — RECALL_BAD_PLAN_ITEM`, /RECALL_BAD_PLAN_ITEM/.test(r), r)
  }

  // 3. не ученик — не отмечает; прямая запись закрыта
  check('3. учитель за ученика — RECALL_PLAN_NOT_FOUND', /RECALL_PLAN_NOT_FOUND/.test(await mark(t.client, plan, 0, 0)))
  check('3. посторонний — RECALL_PLAN_NOT_FOUND', /RECALL_PLAN_NOT_FOUND/.test(await mark(other.client, plan, 0, 0)))
  const direct = await s.client.from('study_plan_marks').insert({ plan_id: plan, week: 0, item: 0 })
  check('3. прямая запись в таблицу закрыта', !!direct.error, 'вставка прошла')

  // 4. кто видит
  check('4. ученик видит свои отметки', (await marksOf(s.client, plan)) === '[[0,1]]', await marksOf(s.client, plan))
  check('4. учитель видит отметки ученика', (await marksOf(t.client, plan)) === '[[0,1]]', await marksOf(t.client, plan))
  check('4. посторонний — не видит', (await marksOf(other.client, plan)) === '[]', await marksOf(other.client, plan))

  // 5. программу заменили — старую не отметить
  await newPlan(t, s.id)
  check('5. программа в архиве — RECALL_PLAN_NOT_FOUND', /RECALL_PLAN_NOT_FOUND/.test(await mark(s.client, plan, 0, 0)))
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
