// ============================================================================
// Студия для снимков: репетитор Мадина Сейткали (английский, Mini) с тремя
// учениками в приложении и пятью карточками, уроки на неделю, оплаты,
// домашка, слова к повторению, письменные задания и материалы; плюс
// самоучка и новый репетитор. Данные кладутся в ТЕСТОВУЮ базу напрямую, AI не
// вызывается, наружу ничего не уходит.
//
// Общая для снимков пачки 1 (shots-batch1) и каркаса (shots-shell): раньше
// заготовка жила внутри shots-batch1, и второй скрипт снимков скопировал бы её.
//
//   const st = studio('shots-b1')      // префикс почты: shots-b1-teacher@recall.test
//   const { t, a, ... } = await st.seed()
//   ...
//   await st.cleanup()                 // аккаунты и разрешения почты — удалить
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'
import { deleteTestUser } from './_users.mjs'

export const PASS = 'ShotsB1!2026'
const env = scriptEnv()
export const sql = (q) => runSql(dbTarget([]), q)
export const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
export const must = (r, label) => {
  if (r.error) throw new Error(`${label}: ${r.error.message}`)
  return r.data
}

const ESSAY = `Nowadays, many people believe that governments should spend money on public transport rather than on building new roads. I strongly agree with this opinion for several reasons.

Firstly, public transport is much more efficient in big cities. One metro train can carry thousands of passengers, while the same number of people in cars would block the whole street for hours. Moreover, buses and trams are cheaper for ordinary families, so people who earn little money can still get to work every day.

Secondly, cars are a main source of pollution. In Almaty, for example, the air in winter is very bad, and a lot of children has problems with breathing. If the city invested in a modern metro and electric buses, fewer people would drive and the air would become cleaner.

However, some people argue that new roads are necessary because not every district have a metro station. This is true in some cases, but I think a better solution is to connect these districts with bus lines, which is faster and cheaper than building a highway.

In conclusion, I believe that public transport should be the priority for governments. It saves time and money, and it protects the environment for the future generations.`

const AI_REVIEW = {
  band: 6.5,
  criteria: { task: 6.5, coherence: 7, lexis: 6.5, grammar: 6 },
  focus: [
    { type: 'Subject-verb agreement', why: 'With plural subjects the verb must stay plural, and with singular ones it takes -s.', examples: [{ was: 'a lot of children has problems', fix: 'a lot of children have problems' }, { was: 'not every district have a metro station', fix: 'not every district has a metro station' }] },
    { type: 'Articles', why: 'Abstract plural nouns usually need no article.', examples: [{ was: 'for the future generations', fix: 'for future generations' }] },
  ],
  errors: [
    { was: 'a lot of children has problems with breathing', fix: 'a lot of children have problems with breathing', type: 'grammar' },
    { was: 'not every district have a metro station', fix: 'not every district has a metro station', type: 'grammar' },
    { was: 'for the future generations', fix: 'for future generations', type: 'article' },
    { was: 'people who earn little money', fix: 'low-income people', type: 'lexis' },
  ],
  strengths: ['Clear position stated in the introduction and repeated in the conclusion', 'Good linking words (Firstly, Moreover, However)', 'A concrete example from the local context (Almaty)'],
  improve: ['Add a more developed counter-argument in paragraph 4', 'Use a wider range of complex sentences'],
  rewrites: [{ was: 'It saves time and money', better: 'It reduces both journey times and household expenses' }],
}

const MATERIALS = [
  {
    lang: 'en', level: 'A2', topic: 'Daily routine', format: 'рассказ', length_range: '50-100', title: 'My morning routine',
    body: 'I get up at seven o\'clock. First, I wash my face and brush my teeth. Then I make breakfast: usually an egg and a cup of tea. At eight I leave home and take the bus to work. The bus ride takes twenty minutes, and I often listen to music.',
    exercises: [
      { kind: 'comprehension', type: 'mcq', prompt: 'What time does the speaker get up?', options: ['At six', 'At seven', 'At eight', 'At nine'], answer: 1 },
      { kind: 'comprehension', type: 'mcq', prompt: 'How does the speaker go to work?', options: ['By car', 'On foot', 'By bus', 'By bike'], answer: 2 },
      { kind: 'vocab', type: 'fill', prompt: 'I ___ the bus to work every day.', answer: 'take' },
    ],
  },
  {
    lang: 'en', level: 'A2', topic: 'Food', format: 'диалог', length_range: '100-250', title: 'Ordering lunch in a café',
    body: 'Waiter: Good afternoon! Are you ready to order?\nAnna: Yes, please. I\'d like the chicken soup and a salad.\nWaiter: Would you like something to drink?\nAnna: Just water, please.\nWaiter: Of course. Anything else?\nAnna: No, thank you. That\'s all.',
    exercises: [
      { kind: 'comprehension', type: 'mcq', prompt: 'What does Anna order to drink?', options: ['Tea', 'Juice', 'Water', 'Coffee'], answer: 2 },
      { kind: 'grammar', type: 'fill', prompt: 'I ___ like the chicken soup, please.', answer: 'would' },
    ],
  },
  {
    lang: 'en', level: 'B1', topic: 'Work', format: 'статья', length_range: '250-400', title: 'Working from home: pros and cons',
    body: 'More and more people work from home. The main advantage is flexibility: you save time on the way to the office and can plan your day yourself. However, many remote workers say they feel lonely and find it hard to separate work from private life.\n\nCompanies also notice differences. Some managers say that teams communicate less, while others report higher productivity. Experts suggest a mixed model, with two or three days at the office.',
    exercises: [
      { kind: 'comprehension', type: 'mcq', prompt: 'What is the main advantage of working from home?', options: ['Higher salary', 'Flexibility', 'Fewer meetings', 'Better equipment'], answer: 1 },
      { kind: 'comprehension', type: 'mcq', prompt: 'What do experts suggest?', options: ['Only remote work', 'Only office work', 'A mixed model', 'Shorter weeks'], answer: 2 },
      { kind: 'vocab', type: 'mcq', prompt: 'Which word means "able to change easily"?', options: ['flexible', 'lonely', 'private', 'mixed'], answer: 0 },
    ],
  },
  {
    lang: 'en', level: 'B1', topic: 'Travel', format: 'рассказ', length_range: '250-400', title: 'A trip that went wrong',
    body: 'Last summer my friends and I decided to go to Lake Issyk-Kul by car. We had been driving for three hours when the engine suddenly stopped. Nobody knew what to do, because there was no signal on our phones. Luckily, a farmer passed by and helped us call a mechanic. We reached the lake only the next morning, but we still remember that trip as the best one.',
    exercises: [
      { kind: 'comprehension', type: 'mcq', prompt: 'Why were they unable to call for help at first?', options: ['No money', 'No signal', 'No friends', 'No car'], answer: 1 },
      { kind: 'grammar', type: 'fill', prompt: 'We ___ driving for three hours when the engine stopped. (past perfect continuous: had been)', answer: 'had been' },
    ],
  },
]

const KEYS = ['teacher', 'aigerim', 'asel', 'meir', 'solo', 'newbie']

/** Студия с почтами `<prefix>-<кто>@recall.test`. */
export function studio(prefix) {
  const E = (k) => `${prefix}-${k}@recall.test`
  const made = []

  async function makeUser(key, name, level = 'B1') {
    const email = E(key)
    await admin.from('allowed_emails').upsert({ email, note: `${prefix} (временный)` })
    for (const u of await sql(`select id from auth.users where lower(email) = '${email}'`)) await deleteTestUser(admin, sql, u.id)
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { display_name: name } })
    if (error) throw new Error(error.message)
    made.push(data.user.id)
    await admin.from('profiles').update({ display_name: name, level }).eq('id', data.user.id)
    const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
    must(await client.auth.signInWithPassword({ email, password: PASS }), `вход ${key}`)
    return { id: data.user.id, email, client }
  }

  async function seed() {
    const t = await makeUser('teacher', 'Мадина Сейткали')
    await sql(`update public.profiles set role = 'teacher', plan = 'teacher_mini', plan_expires_at = now() + interval '30 days' where id = '${t.id}'`)
    must(await t.client.rpc('set_default_lesson_link', { p_link: 'https://meet.google.com/abc-defg-hij' }), 'ссылка')
    const a = await makeUser('aigerim', 'Айгерим Нурланова', 'B1')
    const s = await makeUser('asel', 'Әсел Жұмабаева', 'A2')
    const m = await makeUser('meir', 'Мейір Сапар', 'B1')
    const solo = await makeUser('solo', 'Диас Омаров', 'A2')
    const nw = await makeUser('newbie', 'Динара Кали', 'B1')
    for (const u of [a, s, m]) must(await admin.from('teacher_students').upsert({ teacher_id: t.id, student_id: u.id, seat: true }, { onConflict: 'teacher_id,student_id' }), 'привязка')
    const cards = must(await t.client.rpc('get_my_student_cards'), 'карточки')
    const cardOf = (u) => cards.find((c) => c.user_id === u.id)?.id
    const [ca, cs, cm] = [cardOf(a), cardOf(s), cardOf(m)]
    // у Айгерим есть номер — строка контактов в шапке карточки, как в d10-1 и t6-2
    must(await t.client.rpc('update_student_card', { p_card: ca, p_name: 'Айгерим Нурланова', p_contact: '+7 701 555 12 34' }), 'контакт Айгерим')
    const plain = [['Нұрсұлтан Ахметов', 'trial', '+7 705 220 11 90'], ['Камила Оспан', 'active', '+7 707 334 56 12'], ['Тимур Ким', 'active', '@timur_kim'], ['Алина Ли', 'active', '+7 701 888 02 45'], ['Данияр Беков', 'paused', '+7 747 100 20 30']]
    const card = {}
    for (const [name, status, contact] of plain) {
      const id = must(await t.client.rpc('create_student_card', { p_name: name, p_status: status === 'paused' ? 'active' : status, p_contact: contact }), name)
      if (status === 'paused') must(await t.client.rpc('set_student_card_status', { p_card: id, p_status: 'paused' }), 'пауза')
      card[name.split(' ')[0]] = id
    }

    // уроки Айгерим: прошлые (списаны), ближайший и ещё два на неделе.
    // Ближайший — в 19:00 по Алматы, как в общем контексте макетов: сегодня,
    // если до него больше часа, иначе завтра (вечерний прогон с «через 3 часа»
    // давал «Завтра, 02:49»)
    const [{ now }] = await sql('select now() as now')
    const ALMATY = 5 * 3600_000
    const local = new Date(Date.parse(now) + ALMATY)
    let next = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 19) - ALMATY
    if (next - Date.parse(now) < 3600_000) next += 86400_000
    // точной отметкой, а не минутами от now: у now есть секунды — было «18:59–19:59»
    const atNext = (days, hours = 0) => new Date(next + days * 86400_000 + hours * 3600_000).toISOString()
    must(await t.client.rpc('add_paid_lessons', { p_card: ca, p_count: 5 }), 'оплата')
    for (const d of [-9, -2]) {
      const l = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(d), p_minutes: 60, p_cards: [ca] }), 'прошлый урок')
      must(await t.client.rpc('mark_lesson_participant', { p_lesson: l, p_card: ca, p_outcome: 'present' }), 'отметка')
    }
    for (const days of [0, 2, 5]) must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(days), p_minutes: 60, p_cards: [ca] }), 'урок')
    must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(1, -2), p_minutes: 60, p_cards: [cs] }), 'урок Әсел')
    must(await t.client.rpc('add_paid_lessons', { p_card: cs, p_count: 4 }), 'оплата Әсел')
    must(await t.client.rpc('add_paid_lessons', { p_card: cm, p_count: 1 }), 'оплата Мейір')

    // Как в общем контексте макетов d3, t6 (Ф2.17-4б-1): группы «IELTS вечер»
    // (Әсел, Мейір, Камила, 17:00 — сегодня и через день) и «Разговорный клуб»
    // (сб 11:00), пробный Нұрсұлтана прошёл вчера — «остаётся?», у Тимура
    // оплачен 1 урок, у Алины минус 2, у Камилы 8.
    const day0 = local.toISOString().slice(0, 10)
    const iso = ((local.getUTCDay() + 6) % 7) + 1
    must(await t.client.rpc('create_series', {
      p_kind: 'group', p_weekdays: [iso, ((iso + 1) % 7) + 1], p_time: '17:00', p_minutes: 90, p_every_weeks: 1,
      p_starts_on: day0, p_cards: [cs, cm, card['Камила']], p_title: 'IELTS вечер',
    }), 'группа IELTS вечер')
    must(await t.client.rpc('create_series', {
      p_kind: 'group', p_weekdays: [6], p_time: '11:00', p_minutes: 60, p_every_weeks: 1,
      p_starts_on: day0, p_cards: [ca, card['Тимур'], card['Алина'], card['Камила']], p_title: 'Разговорный клуб',
    }), 'группа Разговорный клуб')
    must(await t.client.rpc('create_lesson', { p_kind: 'trial', p_starts_at: atNext(-1, -3), p_minutes: 45, p_cards: [card['Нұрсұлтан']] }), 'пробный')
    must(await t.client.rpc('add_paid_lessons', { p_card: card['Тимур'], p_count: 1 }), 'оплата Тимура')
    must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(5, -9), p_minutes: 60, p_cards: [card['Тимур']] }), 'урок Тимура')
    must(await t.client.rpc('add_paid_lessons', { p_card: card['Алина'], p_count: 2 }), 'оплата Алины')
    for (const d of [-6, -5, -4, -3]) {
      const l = must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(d, -3), p_minutes: 60, p_cards: [card['Алина']] }), 'прошлый урок Алины')
      must(await t.client.rpc('mark_lesson_participant', { p_lesson: l, p_card: card['Алина'], p_outcome: 'present' }), 'отметка Алины')
    }
    must(await t.client.rpc('create_lesson', { p_kind: 'individual', p_starts_at: atNext(4, -3), p_minutes: 60, p_cards: [card['Алина']] }), 'урок Алины')
    must(await t.client.rpc('add_paid_lessons', { p_card: card['Камила'], p_count: 8 }), 'оплата Камилы')

    // домашка Айгерим: слова (частично), чтение, письмо, свободный пункт (сделан)
    const due = new Date(Date.parse(now) + 5 * 86400_000).toISOString()
    const hw = must(await t.client.rpc('create_homework', {
      p_student_id: a.id, p_lang: 'en', p_due: due, p_note: 'Focus on past tenses this week',
      p_items: [
        { kind: 'words', title: 'Review 10 words', target: 10 },
        { kind: 'text', title: 'Read "A trip that went wrong"', target: 1 },
        { kind: 'writing', title: 'Write 120 words about your last holiday', target: 1 },
        { kind: 'free', title: 'Watch one episode of a series with English subtitles', target: 1 },
      ],
    }), 'домашка')
    void hw
    const items = must(await a.client.rpc('get_homework'), 'домашка ученицы').items
    const free = items.find((i) => i.kind === 'free')
    if (free) await a.client.rpc('complete_homework_item', { p_item: free.id })
    // серия: четыре дня подряд + сегодня; на сегодня — 4 повторённых слова
    const day = (n) => new Date(Date.parse(now) - n * 86400_000).toISOString().slice(0, 10)
    for (const n of [1, 2, 3, 4]) {
      await admin.from('activity_log').upsert({ user_id: a.id, day: day(n), type: 'flashcards', items_done: 8 + n, duration_sec: 300 }, { onConflict: 'user_id,day,type' })
    }
    await a.client.rpc('log_activity', { p_type: 'flashcards', p_day: day(0), p_items: 4, p_sec: 180 })
    // буксующие слова
    const deck = must(await admin.from('decks').insert({ owner_id: a.id, title: 'Мой словарь', lang: 'en' }).select('id').single(), 'колода')
    const words = [['reluctant', 'неохотный'], ['although', 'хотя'], ['accommodation', 'жильё'], ['bargain', 'выгодная покупка'], ['deadline', 'крайний срок']]
    for (const [i, [front, back]] of words.entries()) {
      const c = must(await admin.from('cards').insert({ deck_id: deck.id, front, back, source: 'manual' }).select('id').single(), 'карточка')
      await admin.from('review_states').insert({ card_id: c.id, user_id: a.id, stability: 1.2, difficulty: 8, due: new Date(Date.parse(now) - 3600_000).toISOString(), last_review: new Date(Date.parse(now) - 86400_000).toISOString(), reps: 6 + i, lapses: i < 3 ? 4 - i : 0, state: i < 3 ? 'relearning' : 'review' })
    }

    // письменные задания и сданные работы
    const task2 = must(await admin.from('writing_tasks').insert({ teacher_id: t.id, lang: 'en', mode: 'ielts', level: 'B2', prompt: 'Some people think that governments should spend money on public transport rather than on building new roads. To what extent do you agree or disagree?', settings: { ieltsTask: 'task2', targetBand: '6.5' } }).select('id').single(), 'письмо 1')
    must(await admin.from('writing_tasks').insert({ teacher_id: t.id, lang: 'en', mode: 'regular', level: 'A2', prompt: 'Write an email to a friend about your weekend plans (80-100 words).', settings: { targetWords: ['weekend', 'plan', 'visit'], targetGrammar: ['going to'], minWords: 80 } }).select('id').single(), 'письмо 2')
    const wa = must(await admin.from('writing_task_assignments').insert({ task_id: task2.id, student_id: a.id, status: 'submitted', submitted_at: new Date(Date.parse(now) - 5 * 3600_000).toISOString(), essay: ESSAY, ai_review: AI_REVIEW }).select('id').single(), 'сданное письмо')

    const mats = []
    for (const mt of MATERIALS) mats.push(must(await admin.from('materials').insert({ teacher_id: t.id, ...mt }).select('id').single(), 'материал'))
    const ma = must(await admin.from('material_assignments').insert({
      material_id: mats[3].id, student_id: s.id, status: 'submitted', submitted_at: new Date(Date.parse(now) - 26 * 3600_000).toISOString(),
      answers: [{ index: 0, given: 'No signal', auto_ok: true }, { index: 1, given: 'was driving', auto_ok: false }], auto_score: 1, auto_total: 2,
      // готовый разбор: без него экран проверки сам зовёт AI (ReviewScreen), а
      // снимок ловит «AI разбирает работу…» вместо проверки
      ai_review: [
        { index: 0, ok: true, comment: 'Верно: связи не было, поэтому друзья не могли позвать на помощь.' },
        { index: 1, ok: false, comment: 'Нужно «had been driving»: действие длилось до момента в прошлом — Past Perfect Continuous.' },
      ],
    }).select('id').single(), 'сданное задание')
    await admin.from('material_assignments').insert({ material_id: mats[2].id, student_id: a.id, status: 'assigned' })
    return { t, a, s, m, solo, nw, ca, card, wa: wa.id, ma: ma.id }
  }

  async function cleanup() {
    for (const id of made) await deleteTestUser(admin, sql, id).catch((e) => console.log(`  ⚠ ${e.message}`))
    for (const k of KEYS) await admin.from('allowed_emails').delete().eq('email', E(k))
  }

  return { E, seed, cleanup }
}
