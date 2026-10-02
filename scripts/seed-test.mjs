/**
 * Наполнение ТЕСТОВОЙ базы: настройки как на проде + типовые учитель и два
 * ученика (PLAN.md Ф1.2). Повторный запуск безопасен — ничего не дублирует.
 *
 * Почему пользователи через Admin API, а не в supabase/seed.sql: создавать
 * их SQL-вставкой в auth.* Supabase не поддерживает — такой seed ломается при
 * обновлениях сервиса входа. SQL здесь только для настроек (supabase/seed.sql).
 *
 * Связь учитель—ученики — НАСТОЯЩИМ путём продукта: учитель сам включает
 * режим (become_teacher) и берёт код (ensure_invite_code), ученики входят и
 * вызывают join_teacher. Так seed заодно проверяет живые функции, а не
 * обходит их служебным ключом.
 *
 * Пароль — TEST_SEED_PASSWORD в .env.local; если его нет, скрипт придумает и
 * допишет строку сам (только тестовая база). Аккаунты: teacher@recall.test,
 * student1@recall.test, student2@recall.test — для ручной проверки на
 * `npm run dev:test`.
 *
 * Запуск: node scripts/seed-test.mjs      (только тестовая база; --prod — отказ)
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { ROOT, dbTarget, readEnv, runSql, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('✗ seed пишет в базу — только тестовая. Живую не наполняем.')
  process.exit(1)
}
const target = dbTarget()
const env = scriptEnv()

let password = readEnv().TEST_SEED_PASSWORD
if (!password) {
  password = `Seed-${randomBytes(9).toString('base64url')}`
  appendFileSync(new URL('.env.local', ROOT), `\nTEST_SEED_PASSWORD=${password}\n`)
  console.log('▸ пароль seed-аккаунтов придуман и записан в .env.local (TEST_SEED_PASSWORD)')
}

// --- 1. настройки как на проде ------------------------------------------------------
await runSql(target, readFileSync(new URL('supabase/seed.sql', ROOT), 'utf8'))
const [setting] = await runSql(target, "select value from public.app_settings where key = 'registration_open'")
console.log(`✓ регистрация открыта: ${JSON.stringify(setting?.value)}`)

// --- 2. аккаунты ---------------------------------------------------------------------
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const PEOPLE = [
  { email: 'teacher@recall.test', name: 'Тестовый учитель' },
  { email: 'student1@recall.test', name: 'Ученик 1' },
  { email: 'student2@recall.test', name: 'Ученик 2' },
]

async function ensureUser(email) {
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const found = list.users.find((u) => u.email === email)
  if (found) {
    // пароль мог смениться в .env.local — приводим к текущему
    await admin.auth.admin.updateUserById(found.id, { password })
    return found.id
  }
  const { data, error: e2 } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (e2) throw new Error(`${email}: ${e2.message}`)
  return data.user.id
}

/** Клиент от имени человека: всё дальше идёт через его права, как в приложении. */
async function signIn(email) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${email}: вход не удался — ${error.message}`)
  return c
}

const must = (label, { error }) => {
  if (error) throw new Error(`${label}: ${error.message}`)
}

for (const p of PEOPLE) p.id = await ensureUser(p.email)

const [teacher, ...students] = PEOPLE
const t = await signIn(teacher.email)
must('имя учителя', await t.from('profiles').update({ display_name: teacher.name }).eq('id', teacher.id))
must('become_teacher', await t.rpc('become_teacher'))
const code = await t.rpc('ensure_invite_code')
must('ensure_invite_code', code)
// пробный период — заново на 14 дней, чтобы тарифные функции учителя работали
await runSql(target, `update public.profiles set trial_until = now() + interval '14 days' where id = '${teacher.id}'`)

for (const s of students) {
  const c = await signIn(s.email)
  must(`имя ${s.email}`, await c.from('profiles').update({ display_name: s.name }).eq('id', s.id))
  must(`join_teacher ${s.email}`, await c.rpc('join_teacher', { code: code.data }))
}

const links = await runSql(
  target,
  `select count(*)::int as n from public.teacher_students where teacher_id = '${teacher.id}'`,
)
const [role] = await runSql(target, `select role from public.profiles where id = '${teacher.id}'`)
console.log(`✓ учитель ${teacher.email}: роль ${role.role}, учеников привязано ${links[0].n}`)
if (role.role !== 'teacher' || links[0].n !== students.length) {
  console.error('✗ seed не сошёлся — см. выше')
  process.exit(1)
}
console.log(`✓ готово: ${PEOPLE.map((p) => p.email).join(', ')} (пароль — TEST_SEED_PASSWORD)`)
