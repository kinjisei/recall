// ============================================================================
// Снимки захода 4г (PLAN.md Ф2.17-4г) для shots-screens.mjs — отдельным
// модулем, чтобы общий скрипт не рос (в нём уже ~420 строк).
//
// 4г-1 (макеты d11, d12):
//   placement       — «Тест уровня» Айгерим: английский назначен 11 дней
//                     назад и ждёт, раньше пройден B1 (d11-1);
//   placement-empty — у Мейір тестов не было (схема d11-1);
//   program-form    — «Программа» без программы: EN, B1, 4 недели, цель
//                     набрана (d11-2);
//   program-draft   — «Составить программу» → черновик AI (d11-3, во всю
//                     высоту); ответ AI подставляет сам браузер (shots.aiReply);
//   program-saved   — программа назначена, Айгерим отметила 2 пункта первой
//                     недели (легенда d11-3: «Сохранённая программа»);
//   program-student — она же у Айгерим, /program: пункты нажимаются;
//   learn           — «Моя учёба» Мадины: испанский A2, серия 5, к повторению
//                     9, разговор уже был (d12-1);
//   learn-empty     — всё повторено, разговора не было (d12-2).
// AI не вызывается, наружу ничего не уходит.
// ============================================================================

const DAY = 86400_000

/** Программа из кадра d11-3 — её «составляет AI» в снимке черновика и её же назначаем. */
export const PROGRAM = {
  summary: '4 недели к IELTS 6.5: связки и сложные предложения для Task 2, буксующие слова и тема работы. Каждую неделю — одна запись речи.',
  weeks: [
    {
      title: 'Неделя 1: связки и буксующие слова',
      focus: 'Связки уступки и противопоставления, буксующие слова.',
      items: [
        { type: 'grammar', title: 'Although, despite, however', note: '10 предложений по образцу: уступка и противопоставление' },
        { type: 'words', title: 'Буксующие: reluctant, although, accommodation', note: 'повторять каждый день, пока не станут «выучено»' },
        { type: 'speech', title: '«Online or school?»', note: 'монолог 2 минуты, запись голосом' },
      ],
    },
    {
      title: 'Неделя 2: работа и опыт',
      focus: 'Лексика темы работы, времена.',
      items: [
        { type: 'reading', title: '«Remote work»', note: 'прочитать статью и ответить на 3 вопроса' },
        { type: 'grammar', title: 'Present Perfect и Past Simple', note: '12 предложений: выбрать время и объяснить' },
      ],
    },
    {
      title: 'Неделя 3: собеседование',
      focus: 'Разговор о работе, условные предложения.',
      items: [
        { type: 'dialog', title: '«Job interview»', note: 'разыграть с AI, 8 реплик' },
        { type: 'grammar', title: 'Условные 1-го и 2-го типа', note: 'переписать 6 советов: if I were you…' },
        { type: 'words', title: 'Тема «Работа»', note: '15 слов из статьи и диалога' },
      ],
    },
    {
      title: 'Неделя 4: письмо Task 2',
      focus: 'Эссе Task 2 на band 7.',
      items: [
        { type: 'reading', title: 'Образец эссе на band 7', note: 'найти 5 связок и 3 сложных предложения' },
        { type: 'speech', title: 'Cue card «Describe a teacher»', note: '1–2 минуты, запись голосом' },
      ],
    },
  ],
}

/** «Тест уровня», «Программа» и «Моя программа» ученика (d11). */
export async function shotsProgram({ screen, sql, must, t, a, ca, cm, sleep }) {
  const ago = (d) => new Date(Date.now() - d * DAY).toISOString()
  await sql(`insert into public.placement_requests (teacher_id, student_id, lang, status, result_level, created_at, completed_at) values
    ('${t.id}', '${a.id}', 'en', 'done', 'B1', '${ago(41)}', '${ago(39)}'),
    ('${t.id}', '${a.id}', 'en', 'assigned', null, '${ago(11)}', null)`)

  // программы ещё нет: черновик формы — с чистого листа в каждом варианте вида
  const fresh = (reply) => async (page) =>
    page.evaluate(
      (uid, r) => {
        for (const k of Object.keys(localStorage)) if (k.startsWith(`recall.draft.${uid}.program:`)) localStorage.removeItem(k)
        if (r) localStorage.setItem('shots.aiReply', r)
        else localStorage.removeItem('shots.aiReply')
      },
      t.id,
      reply,
    )
  const typeGoal = async (page) => {
    await page.evaluate(() => document.querySelector('[data-studio-section="program"] textarea')?.focus())
    await page.keyboard.type('IELTS 6.5 к декабрю, больше письма')
    await page.evaluate(() => document.activeElement?.blur())
    await sleep(300)
  }
  const compose = async (page) => {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Составить программу/.test(b.textContent))?.click())
    await page.waitForFunction(() => document.querySelector('[data-program-draft]'), { polling: 250, timeout: 15000 }).catch(() => {})
    await sleep(400)
  }
  const sec = (card, s) => `/teacher?student=${card}&sec=${s}`
  await screen(t.email, [
    { name: 'placement', path: sec(ca, 'placement'), expect: /Назначить тест уровня[\s\S]*История/ },
    { name: 'placement-empty', path: sec(cm, 'placement'), expect: /Тестов пока не было/ },
    { name: 'program-form', path: sec(ca, 'program'), before: fresh(null), prepare: typeGoal, expect: /Новая программа[\s\S]*План дня/ },
    { name: 'program-draft', path: sec(ca, 'program'), before: fresh(JSON.stringify(PROGRAM)), prepare: compose, expect: /Новая программа/, tall: 1500 },
  ])

  // назначена; Айгерим отметила два пункта первой недели
  const plan = must(await t.client.rpc('replace_study_plan', { p_student_id: a.id, p_lang: 'en', p_level: 'B1', p_goal: 'IELTS 6.5 к декабрю, больше письма', p_summary: PROGRAM.summary, p_weeks: PROGRAM.weeks }), 'программа')
  for (const item of [0, 1]) must(await a.client.rpc('set_plan_item_done', { p_plan_id: plan, p_week: 0, p_item: item, p_done: true }), 'отметка')
  await screen(t.email, [{ name: 'program-saved', path: sec(ca, 'program'), before: fresh(null), expect: /Назначена[\s\S]*План дня/, tall: 1500 }])
  await screen(a.email, [{ name: 'program-student', path: '/program', expect: /Моя программа[\s\S]*Неделя 1/ }])
}

/** «Моя учёба» репетитора (d12): разговор был и к повторению 9 — потом всё повторено и разговора нет. */
export async function shotsLearn({ screen, sql, admin, must, t }) {
  const now = Date.now()
  const day = (n) => new Date(now - n * DAY).toISOString().slice(0, 10)
  for (const n of [0, 1, 2, 3, 4]) {
    must(await admin.from('activity_log').upsert({ user_id: t.id, day: day(n), type: 'flashcards', items_done: 10, duration_sec: 300 }, { onConflict: 'user_id,day,type' }), 'серия')
  }
  const [deck] = await sql(`select id from public.decks where owner_id = '${t.id}' and lang = 'es' limit 1`)
  const words = ['la hermana', 'el mercado', 'comprar', 'el fin de semana', 'la tienda', 'barato', 'caro', 'la fruta', 'el pan']
  const cards = []
  for (const front of words) cards.push(must(await admin.from('cards').insert({ deck_id: deck.id, front, back: '—', source: 'manual' }).select('id').single(), 'карточка').id)
  for (const id of cards) {
    must(await admin.from('review_states').insert({ card_id: id, user_id: t.id, stability: 2, difficulty: 5, due: new Date(now - 3600_000).toISOString(), last_review: new Date(now - 2 * DAY).toISOString(), reps: 3, lapses: 0, state: 'review' }), 'расписание')
  }
  const [conv] = await sql(`insert into public.conversations (user_id, lang, started_at) values ('${t.id}', 'es', now() - interval '1 day') returning id`)
  const turns = [
    ['assistant', '¡Hola, Madina! ¿Qué hiciste el fin de semana?'],
    ['user', 'El sábado yo fui al mercado con mi hermana.'],
    ['assistant', '[ok] Верно! «yo» можно опустить: El sábado fui al mercado\n¡Qué bien! ¿Y qué compraron?'],
  ]
  for (const [i, [role, content]] of turns.entries()) {
    must(await admin.from('messages').insert({ conversation_id: conv.id, role, content, created_at: new Date(now - DAY + i * 60_000).toISOString() }), 'реплика')
  }
  // учится испанскому A2 (язык и уровень испанского живут на устройстве)
  const spanish = async (page) => page.evaluate(() => {
    localStorage.setItem('shots.lang', 'es')
    localStorage.setItem('recall.es_level', 'A2')
  })
  await screen(t.email, [{ name: 'learn', path: '/learn', before: spanish, expect: /Моя учёба/, wait: /К повторению: 9|Тест уровня|Ответь по-испански/ }])

  // всё повторено (следующие — завтра), разговора не было
  await sql(`update public.review_states set due = now() + interval '1 day' where user_id = '${t.id}'`)
  await sql(`delete from public.conversations where user_id = '${t.id}'`)
  await screen(t.email, [{ name: 'learn-empty', path: '/learn', before: spanish, expect: /Моя учёба/, wait: /всё повторено/ }])
}
