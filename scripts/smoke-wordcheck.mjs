/**
 * Смоук этапа 3: перепроверку слов считает СЕРВЕР.
 *
 * Что доказываем:
 *   1. Честный путь работает: верное слово засчитано, неверное — нет.
 *   2. Подделка не проходит: ученик шлёт ok:true по всем словам, а сервер
 *      всё равно помечает неверные (и отдаёт их клиенту для штрафа FSRS).
 *   3. В отчёт преподавателю попадает слово ИЗ КАРТОЧКИ, а не из присланного:
 *      подменить front нельзя.
 *   4. Чужой card_id, не входящий в перепроверку, игнорируется.
 *   5. Повторная сдача не засчитывается (нет двойного штрафа).
 *   6. Варианты через «/» и регистр/пробелы принимаются, как на клиенте.
 *
 * Запуск: node scripts/smoke-wordcheck.mjs  (dev-сервер не нужен)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const admin = createClient(URL_, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function asUser(email, password) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

async function mkUser(email, password, patch = {}) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-wordcheck (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  let id = data?.user?.id
  if (!id) {
    if (error && !/already/i.test(error.message)) throw new Error(error.message)
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
  }
  if (!id) throw new Error(`нет id для ${email}`)
  await admin.from('profiles').update({ role: 'learner', ...patch }).eq('id', id)
  return id
}

const T = { email: 'wc-teacher@recall.test', pass: 'Wc!2026teach' }
const S = { email: 'wc-student@recall.test', pass: 'Wc!2026stud' }

let ids = []
try {
  const idT = await mkUser(T.email, T.pass, { role: 'teacher' })
  const idS = await mkUser(S.email, S.pass)
  ids = [idT, idS]
  await admin.from('teacher_students').delete().eq('student_id', idS)
  await admin.from('teacher_students').insert({ teacher_id: idT, student_id: idS })

  // колода ученика с тремя словами; одно — с вариантами через «/»
  // колонка называется title, не name — раньше вставка молча падала,
  // и смоук ломался на своём же посеве
  const { data: deck, error: deckErr } = await admin
    .from('decks')
    .insert({ owner_id: idS, title: 'Смоук перепроверки', lang: 'en' })
    .select('id')
    .single()
  if (deckErr) throw new Error(`колода: ${deckErr.message}`)
  const { data: cards, error: cardsErr } = await admin
    .from('cards')
    .insert([
      { deck_id: deck.id, front: 'whisper', back: 'шептать', source: 'manual' },
      { deck_id: deck.id, front: 'harvest', back: 'урожай', source: 'manual' },
      { deck_id: deck.id, front: 'was/were', back: 'был', source: 'manual' },
    ])
    .select('id, front')
  if (cardsErr) throw new Error(`карточки: ${cardsErr.message}`)
  const byWord = Object.fromEntries(cards.map((c) => [c.front, c.id]))

  const student = await asUser(S.email, S.pass)

  const mkCheck = async () => {
    const { data } = await admin
      .from('word_checks')
      .insert({
        teacher_id: idT,
        student_id: idS,
        card_ids: cards.map((c) => c.id),
      })
      .select('id')
      .single()
    return data.id
  }

  // --- 1. Честный путь ------------------------------------------------------
  const c1 = await mkCheck()
  const { data: v1, error: e1 } = await student.rpc('submit_word_check', {
    p_id: c1,
    p_results: [
      { card_id: byWord.whisper, front: 'whisper', back: 'шептать', given: 'whisper', ok: true },
      { card_id: byWord.harvest, front: 'harvest', back: 'урожай', given: 'harvezt', ok: false },
      { card_id: byWord['was/were'], front: 'was/were', back: 'был', given: 'WERE ', ok: true },
    ],
  })
  if (e1) throw new Error(`честная сдача: ${e1.message}`)
  // Старая версия RPC отвечала boolean. Если видим его — блок этапа 3 ещё не
  // залит, и дальше пошли бы бессмысленные «проверки подделки»: она,
  // разумеется, проходит, потому что вердикт всё ещё ставит клиент.
  if (typeof v1 === 'boolean') {
    throw new Error(
      'submit_word_check отвечает boolean — блок «ЭТАП 3 РЕМОНТА» из docs/schema.sql ещё не залит в Supabase',
    )
  }
  check('честная сдача засчитана', v1?.counted === true, JSON.stringify(v1?.counted))
  check(
    'неверным признано ровно одно слово',
    Array.isArray(v1?.wrong) && v1.wrong.length === 1 && v1.wrong[0] === byWord.harvest,
    JSON.stringify(v1?.wrong),
  )
  const { data: row1 } = await admin.from('word_checks').select('results').eq('id', c1).single()
  const okMap1 = Object.fromEntries(row1.results.map((r) => [r.front, r.ok]))
  check('вариант через «/» и регистр приняты', okMap1['was/were'] === true, JSON.stringify(okMap1))

  // --- 2. Повторная сдача не засчитывается ----------------------------------
  const { data: v2 } = await student.rpc('submit_word_check', {
    p_id: c1,
    p_results: [{ card_id: byWord.harvest, front: 'harvest', back: 'урожай', given: 'harvest', ok: true }],
  })
  check('повторная сдача не засчитана', v2?.counted === false, JSON.stringify(v2?.counted))

  // --- 3. Подделка «всё верно» ----------------------------------------------
  const c2 = await mkCheck()
  const { data: v3 } = await student.rpc('submit_word_check', {
    p_id: c2,
    p_results: [
      { card_id: byWord.whisper, front: 'whisper', back: 'шептать', given: 'ерунда', ok: true },
      { card_id: byWord.harvest, front: 'harvest', back: 'урожай', given: '', ok: true },
      { card_id: byWord['was/were'], front: 'was/were', back: 'был', given: 'xxx', ok: true },
    ],
  })
  check(
    'подделка «всё верно» не прошла: сервер вернул 3 неверных',
    Array.isArray(v3?.wrong) && v3.wrong.length === 3,
    JSON.stringify(v3?.wrong?.length),
  )
  const { data: row2 } = await admin.from('word_checks').select('results').eq('id', c2).single()
  check(
    'в отчёте учителю все три помечены неверными',
    row2.results.every((r) => r.ok === false),
    JSON.stringify(row2.results.map((r) => r.ok)),
  )

  // --- 4. Подмена слова и чужой card_id --------------------------------------
  const c3 = await mkCheck()
  await student.rpc('submit_word_check', {
    p_id: c3,
    p_results: [
      // пытаемся подменить слово в отчёте
      { card_id: byWord.whisper, front: 'кот', back: 'cat', given: 'кот', ok: true },
      // и подсунуть карточку, которой в перепроверке нет
      {
        card_id: '00000000-0000-0000-0000-000000000000',
        front: 'левое', back: 'слово', given: 'левое', ok: true,
      },
    ],
  })
  const { data: row3 } = await admin.from('word_checks').select('results').eq('id', c3).single()
  const fronts = row3.results.map((r) => r.front)
  check('слово в отчёте взято из карточки, а не из присланного', fronts.includes('whisper'), JSON.stringify(fronts))
  check('чужой card_id в отчёт не попал', !fronts.includes('левое'), JSON.stringify(fronts))
  check(
    'подменённое слово засчитано неверным',
    row3.results.find((r) => r.front === 'whisper')?.ok === false,
    JSON.stringify(row3.results.map((r) => [r.front, r.ok])),
  )

  await student.auth.signOut()
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {})
  for (const u of [T, S]) await admin.from('allowed_emails').delete().eq('email', u.email)
  console.log('Тестовые аккаунты удалены (колоды и перепроверки ушли каскадом).')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
