/**
 * Синтетическая нагрузка на ТЕСТОВУЮ базу (PLAN.md Ф2.12): 200 учеников ×
 * 2 урока в неделю у 15 репетиторов — будильник расписания (schedule_tick) и
 * уведомления (notify_lessons_soon, dispatch_notifications) укладываются в
 * свои лимиты. Отчёт и что значат числа — docs/capacity-2026-11.md.
 *
 *   1. студия: 15 репетиторов на Pro, 200 учеников в приложении, у ~85 % —
 *      подписка push (поддельная: доставка уходит в «слив», до служб push
 *      ничего не доходит);
 *   2. 200 серий «2 раза в неделю» через create_series (как кнопка учителя):
 *      время каждой — замер, уроков на 12 недель ≈ 200 × 24;
 *   3. пик «урок через час»: PEAK уроков начинаются в одном часу —
 *      notify_lessons_soon ровно одно на ученика, повтор — ноль; отправка
 *      пачками не больше 100, тело запроса к /api/notify — в пределе;
 *   4. будильник: списание PAST закончившихся уроков, продление окна серий на
 *      сутки и на неделю (как после простоя будильника);
 *   5. настоящий pg_cron за время прогона: оба задания без ошибок и быстрее
 *      предела (ждём хотя бы один прогон каждого после заливки);
 *   6. --week: неделя будильника «урок через час» шагом 5 минут — по одному на
 *      каждый урок серий в окне, худший тик — в пределе;
 *   7. размер таблиц до и после — сколько места берут 200 учеников.
 *
 * Защита: scripts/_load-guard.mjs — только тестовая база и только с
 * --confirm=<ref тестовой базы>; --prod не принимается.
 * Побочное на тестовой базе: секреты доставки на время прогона подменены
 * «сливом» (прежние возвращаются, _vault.mjs); с --week уведомления «урок
 * через час», созданные чужим урокам раньше срока, удаляются в конце.
 *
 * Запуск: node scripts/check-load-lessons.mjs --confirm=<ref> [--students=200]
 *   [--teachers=15] [--peak=120] [--past=60] [--week] [--deliver=sink|off]
 *   [--scale-limits=1] [--keep]
 *   --scale-limits=0.01 — пределы в 100 раз строже: так видно, что замеры
 *   умеют краснеть. ~8–12 минут (из них до 6 — ожидание pg_cron).
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { dbTarget, readEnv, runSql, scriptEnv } from './_env.mjs'
import { loadTargetProblems } from './_load-guard.mjs'
import { deleteTestUser } from './_users.mjs'
import { deliverySecrets } from './_vault.mjs'

const argv = process.argv.slice(2)
const problems = loadTargetProblems(readEnv(), argv)
if (problems.length) {
  console.error(`Нагрузку не запускаю:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
const arg = (name, def) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def
const STUDENTS = Number(arg('students', '200'))
const TEACHERS = Number(arg('teachers', '15'))
const PEAK = Number(arg('peak', '120'))
const PAST = Number(arg('past', '60'))
const DELIVER = arg('deliver', 'sink')
const SCALE = Number(arg('scale-limits', '1'))

/** Пределы, мс (и байты). Почему такие — docs/capacity-2026-11.md, «Проверка базы». */
const LIMITS = Object.fromEntries(Object.entries({
  createSeriesP95: 2000, // учитель ждёт «Сохранить» (с сетью до базы)
  soonPeak: 3000, // notify_lessons_soon на пике
  dispatch: 2000, // одна отправка до 100 уведомлений
  payloadBytes: 1_000_000, // тело к /api/notify: Vercel принимает до 4,5 МБ
  tickSettle: 5000, // schedule_tick: списать PAST уроков
  tickFillDay: 5000, // schedule_tick: окно всех серий на сутки (полночь)
  tickFillWeek: 15000, // то же за неделю простоя
  cronMax: 10000, // любой прогон pg_cron за время проверки
  weekTickMax: 1000, // --week: худший тик «урок через час»
}).map(([k, v]) => [k, v * SCALE]))

const env = scriptEnv(argv)
const target = dbTarget([])
const sql = (q) => runSql(target, q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASSWORD = `Load!${randomBytes(6).toString('hex')}`
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
const ids = (list) => `array[${list.map(lit).join(',')}]::uuid[]`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}
const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data
}
/** Каждому элементу — fn, не больше limit одновременно. */
async function pool(list, limit, fn) {
  const out = new Array(list.length)
  let next = 0
  const worker = async () => {
    while (next < list.length) {
      const i = next++
      out[i] = await fn(list[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker))
  return out
}
const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * 0.95) - 1)] ?? 0

/** Время выражения внутри базы (без сети до Management API): {ms, r}. */
const TIMED = `create or replace function pg_temp.load_timed(q text) returns jsonb language plpgsql as $t$
declare t0 timestamptz := clock_timestamp(); r jsonb;
begin
  execute 'select to_jsonb((' || q || '))' into r;
  return jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000), 'r', r);
end $t$;`
async function timed(expr) {
  const [row] = await sql(`${TIMED}\nselect pg_temp.load_timed(${lit(expr)}) as x`)
  return row.x
}

const SIZE_TABLES = ['lessons', 'lesson_participants', 'lesson_series', 'notifications', 'push_subscriptions', 'student_cards']
const sizes = async () =>
  Object.fromEntries((await sql(`select relname as t, pg_total_relation_size(c.oid) as b from pg_class c
      join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
       and relname in (${SIZE_TABLES.map(lit).join(',')})`)).map((x) => [x.t, Number(x.b)]))

const EMAIL = (role, i) => `load-${role}${i}@recall.test`
const b64 = (n) => randomBytes(n).toString('base64url')
let vault = null
let weekFrom = null
const teachers = []
const students = []

async function cleanupUsers() {
  const old = await sql(`select id from auth.users where email like 'load-%@recall.test'`)
  await pool(old, 8, (u) => deleteTestUser(admin, sql, u.id))
  await admin.from('allowed_emails').delete().like('email', 'load-%@recall.test')
}

async function signIn(email) {
  for (let attempt = 0; ; attempt++) {
    const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
    const r = await c.auth.signInWithPassword({ email, password: PASSWORD })
    if (!r.error) return c
    // лимит входов Supabase на адрес — подождать и снова, а не красное на исправной базе
    if (attempt >= 5 || !/rate|429|too many/i.test(r.error.message)) throw new Error(`вход ${email}: ${r.error.message}`)
    console.log(`  … лимит входов, жду 60 с (${email})`)
    await sleep(60_000)
  }
}

try {
  const t0 = Date.now()
  const [{ now: startedAt }] = await sql(`select now() as now`)
  await cleanupUsers()
  const before = await sizes()
  vault = await deliverySecrets(sql)
  if (DELIVER === 'off') await vault.clear()
  else await vault.set(`${env.VITE_SUPABASE_URL}/rest/v1/`, randomBytes(24).toString('hex')) // «слив»: ответит 401

  // ── 1. студия ──────────────────────────────────────────────────────────────────────
  const emails = [
    ...Array.from({ length: TEACHERS }, (_, i) => ({ role: 'teacher', email: EMAIL('t', i) })),
    ...Array.from({ length: STUDENTS }, (_, i) => ({ role: 'student', email: EMAIL('s', i) })),
  ]
  must(await admin.from('allowed_emails').upsert(emails.map((e) => ({ email: e.email, note: 'check-load-lessons (временный)' }))), 'белый список')
  await pool(emails, 8, async (e, i) => {
    const r = await admin.auth.admin.createUser({ email: e.email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `Нагрузка ${i}` } })
    if (r.error) throw new Error(`${e.email}: ${r.error.message}`)
    ;(e.role === 'teacher' ? teachers : students).push({ id: r.data.user.id, email: e.email })
  })
  students.sort((a, b) => a.email.localeCompare(b.email, 'en', { numeric: true }))
  for (const t of teachers) {
    t.client = await signIn(t.email)
    must(await t.client.rpc('become_teacher'), 'режим преподавателя')
  }
  await sql(`update public.profiles set plan = 'teacher_pro', plan_expires_at = now() + interval '30 days'
              where id = any(${ids(teachers.map((t) => t.id))})`)
  students.forEach((s, i) => (s.teacher = teachers[i % TEACHERS]))
  must(await admin.from('teacher_students').insert(students.map((s) => ({ teacher_id: s.teacher.id, student_id: s.id }))), 'привязка учеников')
  for (const t of teachers) {
    for (const c of must(await t.client.rpc('get_my_student_cards'), 'карточки')) {
      const s = students.find((x) => x.id === c.user_id)
      if (s) s.card = c.id
    }
  }
  check(`студия: ${TEACHERS} репетиторов, ${STUDENTS} учеников с карточками`, students.every((s) => s.card))
  const subs = students.flatMap((s, i) => (i % 7 === 0 ? [] : i % 7 === 1 ? [s, s] : [s]))
  await sql(`insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values ${subs
    .map((s) => `(${lit(`https://fcm.googleapis.com/fcm/send/load-${b64(12)}`)}, ${lit(s.id)}, ${lit(b64(65))}, ${lit(b64(16))})`)
    .join(',')}`)
  console.log(`  подписок push: ${subs.length}; заливка — ${Math.round((Date.now() - t0) / 1000)} с`)

  // ── 2. серии: 2 урока в неделю ─────────────────────────────────────────────────────
  const [{ d1 }] = await sql(`select ((now() at time zone 'Asia/Almaty')::date + 1)::text as d1`)
  const PAIRS = [[1, 4], [2, 5], [3, 6], [1, 3], [2, 4], [4, 6]]
  const SLOTS = ['15:00', '16:00', '17:00', '18:00', '18:30', '19:00', '19:00', '19:30', '20:00', '21:00'] // пик вечером
  const seriesMs = []
  await pool(students, 5, async (s, i) => {
    const started = Date.now()
    s.series = must(await s.teacher.client.rpc('create_series', {
      p_kind: 'individual', p_weekdays: PAIRS[i % PAIRS.length], p_time: SLOTS[i % SLOTS.length], p_minutes: 60,
      p_every_weeks: 1, p_starts_on: d1, p_cards: [s.card],
    }), 'серия')
    seriesMs.push(Date.now() - started)
  })
  const seriesIds = ids(students.map((s) => s.series))
  const [{ n: lessonCount }] = await sql(`select count(*)::int as n from public.lessons where series_id = any(${seriesIds})`)
  check(`create_series: p95 ${p95(seriesMs)} мс ≤ ${LIMITS.createSeriesP95}`, p95(seriesMs) <= LIMITS.createSeriesP95)
  check(`уроков серий на 12 недель: ${lessonCount} (≈ ${STUDENTS} × 24)`, lessonCount >= STUDENTS * 22 && lessonCount <= STUDENTS * 26)

  // ── 3. пик «урок через час» ─────────────────────────────────────────────────────────
  // начало через 61–65 минут, будильник — «через 5 минут»: до этого настоящий
  // pg_cron их не тронет, и замер видит всю пачку разом
  // время — от часов базы, а не машины: часы расходятся на секунды (scripts/CLAUDE.md)
  const [{ now: dbNow }] = await sql(`select now() as now`)
  const peakStudents = students.slice(0, Math.min(PEAK, STUDENTS))
  const peakLessons = await pool(peakStudents, 5, async (s, i) =>
    must(await s.teacher.client.rpc('create_lesson', {
      p_kind: 'individual', p_starts_at: new Date(Date.parse(dbNow) + (61 + (i % 4)) * 60_000).toISOString(), p_minutes: 60, p_cards: [s.card],
    }), 'урок пика'))
  const soonAt = `now() + interval '5 minutes'`
  const soon = await timed(`public.notify_lessons_soon(${soonAt})`)
  const peakNotes = `select id from public.notifications where kind = 'lesson_soon' and (data->>'lesson')::uuid = any(${ids(peakLessons)})`
  const [{ n: peakMade }] = await sql(`select count(*)::int as n from (${peakNotes}) x`)
  check(`notify_lessons_soon на пике ${PEAK}: ${soon.ms} мс ≤ ${LIMITS.soonPeak}`, soon.ms <= LIMITS.soonPeak)
  check(`«урок через час» — ровно одно на ученика пика (${peakMade} из ${peakLessons.length})`, peakMade === peakLessons.length)
  await timed(`public.notify_lessons_soon(${soonAt})`)
  const [{ n: peakAgain }] = await sql(`select count(*)::int as n from (${peakNotes}) x`)
  check('повтор будильника — ни одного нового', peakAgain === peakMade)
  const [{ b: payload }] = await sql(`select octet_length(public.dispatch_payload(array(${peakNotes} limit 100))::text) as b`)
  check(`тело запроса к /api/notify на 100 уведомлений: ${Math.round(payload / 1024)} КБ ≤ ${Math.round(LIMITS.payloadBytes / 1024)}`, payload <= LIMITS.payloadBytes)
  if (DELIVER !== 'off') {
    const rounds = []
    for (let i = 0; i < Math.ceil(PEAK / 100) + 2; i++) {
      const [{ n: waiting }] = await sql(`select count(*)::int as n from public.notifications where sent_at is null and id in (${peakNotes})`)
      if (!waiting) break
      rounds.push(await timed('public.dispatch_notifications()'))
    }
    const [{ n: unsent }] = await sql(`select count(*)::int as n from public.notifications where sent_at is null and id in (${peakNotes})`)
    const worst = Math.max(0, ...rounds.map((r) => r.ms))
    check(`отправка: ${rounds.length} пачк., каждая ≤ 100 (${rounds.map((r) => r.r).join(', ')})`, rounds.every((r) => r.r <= 100))
    check(`отправка: худшая ${worst} мс ≤ ${LIMITS.dispatch}`, worst <= LIMITS.dispatch)
    check(`пик ушёл за ${Math.ceil(PEAK / 100)} пачк. (в проде — по одной в 5 минут)`, unsent === 0 && rounds.length <= Math.ceil(PEAK / 100) + 1, `не отправлено ${unsent}`)
  }

  // ── 4. будильник расписания ──────────────────────────────────────────────────────────
  const pastStudents = students.slice(-Math.min(PAST, STUDENTS))
  const pastLessons = await pool(pastStudents, 5, async (s) =>
    must(await s.teacher.client.rpc('create_lesson', {
      p_kind: 'individual', p_starts_at: new Date(Date.parse(dbNow) - 2 * 3600_000).toISOString(), p_minutes: 60, p_cards: [s.card],
    }), 'прошедший урок'))
  const settle = await timed('public.schedule_tick(now())')
  const [{ n: done }] = await sql(`select count(*)::int as n from public.lessons where status = 'done' and id = any(${ids(pastLessons)})`)
  check(`schedule_tick, списание ${PAST} уроков: ${settle.ms} мс ≤ ${LIMITS.tickSettle} (${JSON.stringify(settle.r)})`, settle.ms <= LIMITS.tickSettle)
  check(`все ${PAST} закончившихся уроков списаны`, done === pastLessons.length, `${done}`)
  for (const [days, limit] of [[1, LIMITS.tickFillDay], [7, LIMITS.tickFillWeek]]) {
    // окно серий короче на days: как если бы будильник столько не работал
    await sql(`delete from public.lessons where series_id = any(${seriesIds})
                 and series_date > (select min(generated_until) from public.lesson_series where id = any(${seriesIds})) - ${days};
               update public.lesson_series set generated_until = generated_until - ${days} where id = any(${seriesIds})`)
    const fill = await timed('public.schedule_tick(now())')
    const [{ n: after }] = await sql(`select count(*)::int as n from public.lessons where series_id = any(${seriesIds})`)
    check(`schedule_tick, окно серий за ${days} дн.: ${fill.ms} мс ≤ ${limit} (${JSON.stringify(fill.r)})`, fill.ms <= limit)
    // больше — только если прогон пересёк полночь по Алматы и pg_cron добавил день
    check(`окно восстановлено: ${after} уроков (было ${lessonCount})`, after >= lessonCount && after <= lessonCount + STUDENTS)
  }

  // ── 5. настоящий pg_cron ─────────────────────────────────────────────────────────────
  const [{ now: loadedAt }] = await sql(`select now() as now`)
  const JOBS = ['recall-notifications', 'recall-schedule']
  // сравнение времён — в базе: строки времени Postgres в JS не сравниваем
  const cronRuns = () => sql(`select j.jobname, d.status, d.start_time >= ${lit(loadedAt)}::timestamptz as after_load,
      round(extract(epoch from d.end_time - d.start_time) * 1000) as ms, left(d.return_message, 200) as msg
      from cron.job_run_details d join cron.job j on j.jobid = d.jobid
     where j.jobname in (${JOBS.map(lit).join(',')}) and d.start_time >= ${lit(startedAt)}::timestamptz`)
  const ranAfterLoad = (runs) => JOBS.every((j) => runs.some((r) => r.jobname === j && r.after_load && r.status !== 'running'))
  let runs = await cronRuns()
  for (let i = 0; i < 24 && !ranAfterLoad(runs); i++) {
    await sleep(15_000)
    runs = await cronRuns()
  }
  const finished = runs.filter((r) => r.status !== 'running')
  const cronWorst = Math.max(0, ...finished.map((r) => Number(r.ms)))
  check(`pg_cron после заливки: оба задания отработали (${finished.length} прогонов)`, ranAfterLoad(runs))
  check('pg_cron: ни одного сбоя', finished.every((r) => r.status === 'succeeded'), finished.filter((r) => r.status !== 'succeeded').map((r) => `${r.jobname}: ${r.msg}`).join('; '))
  check(`pg_cron: худший прогон ${cronWorst} мс ≤ ${LIMITS.cronMax}`, cronWorst <= LIMITS.cronMax)

  // ── 6. неделя «урок через час» ──────────────────────────────────────────────────────
  if (argv.includes('--week')) {
    ;[{ now: weekFrom }] = await sql(`select now() as now`)
    const WEEK = `create or replace function pg_temp.load_week(p_from timestamptz) returns jsonb language plpgsql as $w$
      declare i int; t0 timestamptz; worst numeric := 0; made int := 0; peak int := 0; n int;
      begin
        for i in 1..288 loop
          t0 := clock_timestamp();
          n := public.notify_lessons_soon(p_from + make_interval(mins => 5 * i));
          worst := greatest(worst, extract(epoch from clock_timestamp() - t0) * 1000);
          made := made + n; peak := greatest(peak, n);
        end loop;
        return jsonb_build_object('worst', round(worst), 'made', made, 'peak', peak);
      end $w$;`
    let worst = 0
    let peak = 0
    for (let day = 0; day < 7; day++) {
      const [{ x }] = await sql(`${WEEK}\nselect pg_temp.load_week(${lit(weekFrom)}::timestamptz + interval '${day} days') as x`)
      worst = Math.max(worst, Number(x.worst))
      peak = Math.max(peak, x.peak)
    }
    const window = `starts_at > ${lit(weekFrom)}::timestamptz + interval '5 minutes' and starts_at <= ${lit(weekFrom)}::timestamptz + interval '7 days'`
    const [{ want, got }] = await sql(`select
        (select count(*)::int from public.lessons where series_id = any(${seriesIds}) and status = 'planned' and ${window}) as want,
        (select count(*)::int from public.notifications n join public.lessons l on l.id = (n.data->>'lesson')::uuid
          where n.kind = 'lesson_soon' and l.series_id = any(${seriesIds}) and ${window.replaceAll('starts_at', 'l.starts_at')}) as got`)
    check(`неделя будильника: худший тик ${worst} мс ≤ ${LIMITS.weekTickMax}, больше всего за тик — ${peak}`, worst <= LIMITS.weekTickMax)
    check(`неделя: «урок через час» — по одному на каждый урок серий (${got} из ${want})`, got === want && want > 0)
  }

  // ── 7. место ────────────────────────────────────────────────────────────────────────
  const after = await sizes()
  const grown = SIZE_TABLES.map((t) => `${t} +${Math.round(((after[t] ?? 0) - (before[t] ?? 0)) / 1024)} КБ`).join(', ')
  console.log(`  место под ${STUDENTS} учеников (окно 12 недель): ${grown}`)
} catch (e) {
  check('проверка дошла до конца', false, String(e?.message ?? e).split('\n')[0])
} finally {
  await vault?.restore().catch((e) => console.log(`  ⚠ секреты доставки: ${e.message}`))
  if (weekFrom) {
    // «урок через час» чужим урокам, созданный неделей раньше срока, — убрать: будильник создаст вовремя
    await sql(`delete from public.notifications where kind = 'lesson_soon' and created_at >= ${lit(weekFrom)}
                 and (data->>'at')::timestamptz > now() + interval '65 minutes'
                 and user_id not in (select id from auth.users where email like 'load-%@recall.test')`).catch((e) => console.log(`  ⚠ уборка недели: ${e.message}`))
  }
  if (!argv.includes('--keep')) await cleanupUsers().catch((e) => console.log(`  ⚠ уборка: ${e.message}`))
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
