/**
 * Смоук «Домашки на неделю».
 *
 * Зачем. Домашка — единственное место, где сходятся обе стороны продукта:
 * учитель по ней планирует урок, ученик по ней понимает, что делать. Если
 * цифра «3 из 5» врёт, врёт весь экран преподавателя — а заметить это можно
 * только по жалобе живого репетитора, то есть поздно.
 *
 * Проверяем ровно те правила, ради которых всё затевалось:
 *   • пункт закрывает СЕРВЕР по факту действия, а не галочка ученика;
 *   • галочка возможна только там, где измерить нечем ('free');
 *   • чужой учитель не видит домашку и не может её выдать;
 *   • ученик не может закрыть чужой пункт и не может писать в таблицы напрямую;
 *   • закрытый пункт назад не открывается.
 *
 * Работает по API (без браузера): здесь важны серверные правила, а не экраны.
 * Запуск: node scripts/smoke-homework.mjs
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

const PASSWORD = 'Homework!Smoke2026'
const EMAILS = {
  teacher: 'hw-teacher@recall.test',
  other: 'hw-other-teacher@recall.test',
  student: 'hw-student@recall.test',
  mate: 'hw-mate@recall.test',
}

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const errText = (e) => (e ? e.message ?? String(e) : '')

async function makeUser(email, role = 'learner') {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  for (const u of list.users.filter((u) => u.email === email)) {
    await admin.auth.admin.deleteUser(u.id)
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`${email}: ${error.message}`)
  await admin.from('profiles').update({ role }).eq('id', data.user.id)
  return data.user.id
}

async function signIn(email) {
  const c = createClient(URL_, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`вход ${email}: ${error.message}`)
  return c
}

const ids = {}
try {
  // ---- аккаунты и связи ------------------------------------------------------
  ids.teacher = await makeUser(EMAILS.teacher, 'teacher')
  ids.other = await makeUser(EMAILS.other, 'teacher')
  ids.student = await makeUser(EMAILS.student)
  ids.mate = await makeUser(EMAILS.mate)
  for (const s of [ids.student, ids.mate]) {
    await admin
      .from('teacher_students')
      .upsert({ teacher_id: ids.teacher, student_id: s }, { onConflict: 'teacher_id,student_id' })
  }
  check('аккаунты созданы, ученики привязаны', true)

  const teacher = await signIn(EMAILS.teacher)
  const other = await signIn(EMAILS.other)
  const student = await signIn(EMAILS.student)
  const mate = await signIn(EMAILS.mate)

  const due = new Date(Date.now() + 7 * 86400_000).toISOString()

  // ---- 1. чужой учитель не может выдать домашку -----------------------------
  const alien = await other.rpc('create_homework', {
    p_student_id: ids.student,
    p_lang: 'en',
    p_due: due,
    p_items: [{ kind: 'free', title: 'Ничего', target: 1 }],
  })
  check(
    'чужой учитель не может выдать домашку',
    !!alien.error && /NOT_YOUR_STUDENT/.test(errText(alien.error)),
    errText(alien.error) || 'ПРОШЛО',
  )

  // ---- 2. свой учитель выдаёт ------------------------------------------------
  const made = await teacher.rpc('create_homework', {
    p_student_id: ids.student,
    p_lang: 'en',
    p_due: due,
    p_items: [
      { kind: 'words', title: 'Повторить 3 слова', target: 3 },
      { kind: 'writing', title: 'Письмо про выходные', target: 1 },
      { kind: 'free', title: 'Посмотреть серию с субтитрами', target: 1 },
    ],
    p_note: 'К вторнику',
  })
  check('учитель выдал домашку', !made.error && !!made.data, errText(made.error))
  const hwId = made.data

  // ---- 3. обе стороны видят одно и то же ------------------------------------
  const asStudent = await student.rpc('get_homework')
  const asTeacher = await teacher.rpc('get_homework', { p_student: ids.student })
  check('ученик видит свою домашку', !asStudent.error && asStudent.data?.id === hwId, errText(asStudent.error))
  check('учитель видит ту же домашку', !asTeacher.error && asTeacher.data?.id === hwId, errText(asTeacher.error))
  check(
    'пунктов трое и все открыты',
    asStudent.data?.items?.length === 3 && asStudent.data.items.every((i) => !i.done_at),
    JSON.stringify(asStudent.data?.items?.map((i) => i.kind)),
  )

  // ---- 4. чужой учитель домашку не видит ------------------------------------
  const peek = await other.rpc('get_homework', { p_student: ids.student })
  check(
    'чужой учитель домашку не видит',
    !!peek.error && /NOT_YOUR_STUDENT/.test(errText(peek.error)),
    errText(peek.error) || 'УВИДЕЛ',
  )
  const { data: peekRows } = await other.from('homework').select('id')
  check('и через таблицу тоже не видит', (peekRows ?? []).length === 0, `строк: ${peekRows?.length ?? 0}`)

  // ---- 5. прямая запись ученику запрещена ------------------------------------
  const items = asStudent.data.items
  const wordsItem = items.find((i) => i.kind === 'words')
  const freeItem = items.find((i) => i.kind === 'free')
  const writingItem = items.find((i) => i.kind === 'writing')

  const forge = await student
    .from('homework_items')
    .update({ done_at: new Date().toISOString(), done_by: 'server' })
    .eq('id', wordsItem.id)
    .select()
  check(
    'ученик не может закрыть пункт напрямую',
    !!forge.error || (forge.data ?? []).length === 0,
    errText(forge.error) || 'ЗАПИСЬ ПРОШЛА',
  )
  const forgeHw = await student
    .from('homework')
    .insert({ teacher_id: ids.teacher, student_id: ids.student, lang: 'en', due_at: due })
    .select()
  check(
    'ученик не может выдать домашку сам себе',
    !!forgeHw.error,
    errText(forgeHw.error) || 'ВСТАВКА ПРОШЛА',
  )

  // ---- 6. СЕРВЕР закрывает пункт по факту повторений -------------------------
  // Три карточки в личной колоде ученика + отметки о повторении.
  const { data: deck } = await admin
    .from('decks')
    .select('id')
    .eq('owner_id', ids.student)
    .eq('lang', 'en')
    .limit(1)
    .single()
  const { data: cards } = await admin
    .from('cards')
    .insert([
      { deck_id: deck.id, front: 'harvest', back: 'урожай', source: 'teacher' },
      { deck_id: deck.id, front: 'brave', back: 'храбрый', source: 'teacher' },
      { deck_id: deck.id, front: 'ancient', back: 'древний', source: 'teacher' },
    ])
    .select()
  const now = new Date().toISOString()
  for (const c of cards) {
    await student.from('review_states').insert({
      user_id: ids.student,
      card_id: c.id,
      state: 'review',
      due: new Date(Date.now() + 86400_000).toISOString(),
      last_review: now,
      reps: 1,
      stability: 2,
      difficulty: 5,
    })
  }
  // Действие ученика проходит через log_activity — там же и автозачёт.
  const day = new Date().toISOString().slice(0, 10)
  await student.rpc('log_activity', { p_type: 'flashcards', p_day: day, p_items: 3, p_sec: 60 })

  const afterWords = await teacher.rpc('get_homework', { p_student: ids.student })
  const wordsAfter = afterWords.data.items.find((i) => i.id === wordsItem.id)
  check(
    'сервер сам закрыл пункт по повторённым словам',
    !!wordsAfter.done_at && wordsAfter.done_by === 'server',
    `done_by=${wordsAfter.done_by}, прогресс=${wordsAfter.progress}`,
  )

  // ---- 7. письменная работа закрывает свой пункт -----------------------------
  await student.from('writing_submissions').insert({
    user_id: ids.student,
    prompt: 'My weekend',
    text: 'Last weekend I visited my grandmother and helped her in the garden.',
  })
  await student.rpc('log_activity', { p_type: 'writing', p_day: day, p_items: 1, p_sec: 300 })
  const afterWriting = await teacher.rpc('get_homework', { p_student: ids.student })
  const writingAfter = afterWriting.data.items.find((i) => i.id === writingItem.id)
  check(
    'сданная работа закрыла пункт «письмо»',
    !!writingAfter.done_at && writingAfter.done_by === 'server',
    `done_by=${writingAfter.done_by}`,
  )

  // ---- 7б. работа, ЗАДАННАЯ УЧИТЕЛЕМ, тоже закрывает пункт -------------------
  // ⚠️ Проверка появилась после находки: письменных работ два пути. Свободное
  // письмо пишется в writing_submissions, а работа по заданию учителя — в
  // writing_task_assignments, и сдача её не логируется как занятие. Первая
  // версия автозачёта считала только первый путь, то есть НЕ закрывала пункт
  // ровно тогда, когда ученик сделал именно то, что задали.
  const hw2 = await teacher.rpc('create_homework', {
    p_student_id: ids.mate,
    p_lang: 'en',
    p_due: due,
    p_items: [{ kind: 'writing', title: 'Эссе по заданию учителя', target: 1 }],
  })
  check('вторая домашка выдана (проверяем учительское письмо)', !hw2.error, errText(hw2.error))

  const { data: task, error: taskErr } = await admin
    .from('writing_tasks')
    .insert({
      teacher_id: ids.teacher,
      lang: 'en',
      mode: 'ielts', // допустимые: 'ielts' | 'regular'
      level: 'B1',
      prompt: 'Some people think homework is useless. Discuss.',
    })
    .select()
    .single()
  check('задание на письмо создано', !taskErr && !!task, errText(taskErr))
  const assign = await teacher.rpc('assign_writing_task', {
    p_task_id: task.id,
    p_student_id: ids.mate,
  })
  check('задание на письмо назначено', !assign.error, errText(assign.error))

  const { data: wa } = await admin
    .from('writing_task_assignments')
    .select('id')
    .eq('task_id', task.id)
    .eq('student_id', ids.mate)
    .single()
  const sent = await mate.rpc('submit_writing', {
    p_id: wa.id,
    p_essay: 'Homework is useful when it is short and regular. I practise every day.',
    p_grade: { band: 6 },
    p_band: '6.0',
  })
  check('ученик сдал работу учителю', !sent.error, errText(sent.error))

  // ⚠️ Читаем состояние ПРЯМО ИЗ ТАБЛИЦЫ, а не через get_homework. Разница
  // принципиальная: get_homework пересчитывает домашку при каждом чтении, и
  // проверка через него зелёная даже без триггеров — то есть не проверяет
  // ничего. Здесь мы требуем, чтобы пункт был закрыт В БАЗЕ уже в момент сдачи:
  // на это будет опираться список учеников, который читает счётчики пачкой и
  // пересчитывать каждому не станет.
  const { data: rawItems } = await admin
    .from('homework_items')
    .select('id, kind, done_at, done_by')
    .eq('homework_id', hw2.data)
  const mateWriting = (rawItems ?? []).find((i) => i.kind === 'writing')
  check(
    'сданная УЧИТЕЛЬСКАЯ работа закрыла пункт в момент сдачи (без чтения домашки)',
    !!mateWriting?.done_at && mateWriting.done_by === 'server',
    `done_by=${mateWriting?.done_by ?? 'null'}`,
  )

  // И то же самое глазами учителя — цифра в карточке обязана совпасть.
  const mateHwAfter = await teacher.rpc('get_homework', { p_student: ids.mate })
  const mateWritingView = mateHwAfter.data.items.find((i) => i.kind === 'writing')
  check(
    'учитель видит тот же закрытый пункт',
    !!mateWritingView?.done_at && mateWritingView.done_by === 'server',
    `прогресс=${mateWritingView?.progress}`,
  )

  // ---- 8. галочка ученика — только для 'free' --------------------------------
  const mark = await student.rpc('complete_homework_item', { p_item: freeItem.id })
  check('ученик отметил пункт, который нечем измерить', !mark.error, errText(mark.error))
  const afterMark = await teacher.rpc('get_homework', { p_student: ids.student })
  const freeAfter = afterMark.data.items.find((i) => i.id === freeItem.id)
  check(
    'в карточке видно, что отметил ученик, а не сервер',
    freeAfter.done_by === 'student',
    `done_by=${freeAfter.done_by}`,
  )
  check(
    'домашка выполнена целиком',
    afterMark.data.items.every((i) => !!i.done_at),
    afterMark.data.items.map((i) => `${i.kind}:${i.done_by}`).join(', '),
  )

  // ---- 8б. галочкой НЕЛЬЗЯ закрыть измеримый пункт ---------------------------
  // ⚠️ Найдено аудитом того же захода: complete_homework_item проверяла «твой ли
  // пункт», но не проверяла ТИП. Ученик закрывал «повторить 20 слов» одним
  // вызовом, не повторив ни одного. Клиент такую кнопку не рисует — но клиент
  // здесь ничего не решает.
  const hwCheat = await teacher.rpc('create_homework', {
    p_student_id: ids.mate,
    p_lang: 'en',
    p_due: due,
    p_items: [{ kind: 'words', title: 'Повторить 20 слов', target: 20 }],
  })
  check('домашка для проверки галочки выдана', !hwCheat.error, errText(hwCheat.error))
  const cheatItems = (await mate.rpc('get_homework')).data.items
  const cheatWords = cheatItems.find((i) => i.kind === 'words')
  const cheat = await mate.rpc('complete_homework_item', { p_item: cheatWords.id })
  check(
    'галочкой нельзя закрыть измеримый пункт',
    !!cheat.error && /MEASURED_ITEM/.test(errText(cheat.error)),
    errText(cheat.error) || 'ЗАКРЫЛ БЕЗ ЕДИНОГО ПОВТОРЕНИЯ',
  )
  const { data: cheatRaw } = await admin
    .from('homework_items')
    .select('done_at, done_by')
    .eq('id', cheatWords.id)
    .single()
  check('и в базе пункт остался открытым', !cheatRaw?.done_at, `done_by=${cheatRaw?.done_by ?? 'null'}`)

  // ---- 8в. чужая домашка не видна другому преподавателю ----------------------
  // ⚠️ У ученика бывает два репетитора. get_homework — security definer, то есть
  // RLS ему не указ, и он отдавал последнюю домашку ЛЮБОГО учителя вместе с
  // заметкой. Политика на таблице была строже — правой оказалась политика.
  await admin
    .from('teacher_students')
    .upsert({ teacher_id: ids.other, student_id: ids.mate }, { onConflict: 'teacher_id,student_id' })
  const secret = 'Личная заметка второго преподавателя'
  await other.rpc('create_homework', {
    p_student_id: ids.mate,
    p_lang: 'en',
    p_due: due,
    p_items: [{ kind: 'free', title: 'Задание второго учителя', target: 1 }],
    p_note: secret,
  })
  const firstSees = await teacher.rpc('get_homework', { p_student: ids.mate })
  check(
    'учитель не видит домашку другого учителя',
    firstSees.data?.note !== secret,
    firstSees.data?.note === secret ? 'ВИДИТ ЧУЖУЮ ЗАМЕТКУ' : '',
  )
  const studentSees = await mate.rpc('get_homework')
  check(
    'а ученик свою последнюю домашку видит',
    studentSees.data?.note === secret,
    `заметка: ${studentSees.data?.note ?? 'нет'}`,
  )

  // ---- 9. чужой пункт закрыть нельзя ----------------------------------------
  const mateHw = await teacher.rpc('create_homework', {
    p_student_id: ids.mate,
    p_lang: 'en',
    p_due: due,
    p_items: [{ kind: 'free', title: 'Чужой пункт', target: 1 }],
  })
  const mateItems = (await mate.rpc('get_homework')).data.items
  const steal = await student.rpc('complete_homework_item', { p_item: mateItems[0].id })
  check(
    'чужой пункт закрыть нельзя',
    !!steal.error && /NOT_YOURS/.test(errText(steal.error)),
    errText(steal.error) || 'ЗАКРЫЛ',
  )
  check('домашка второго ученика создана', !mateHw.error, errText(mateHw.error))

  // ---- 10. закрытый пункт назад не открывается -------------------------------
  await admin.from('review_states').delete().eq('user_id', ids.student)
  const afterUndo = await teacher.rpc('get_homework', { p_student: ids.student })
  const wordsUndo = afterUndo.data.items.find((i) => i.id === wordsItem.id)
  check(
    'закрытый пункт не открывается обратно',
    !!wordsUndo.done_at,
    wordsUndo.done_at ? '' : 'ОТКРЫЛСЯ',
  )

  // ---- 11. ЧТЕНИЕ: две дороги к одной работе ведут себя одинаково ------------
  //
  // ⚠️ Класс, ради которого заход и делался. «Прочитать текст» можно закрыть
  // читалкой (activity_log type='reader') ИЛИ разобрав задание преподавателя
  // (type='assignment') — это одно и то же дело, просто открытое из разных
  // списков. Пока в зачёт шло только 'reader', ученик делал заданный материал и
  // видел пункт незакрытым.
  //
  // ⚠️ И вторая половина: занятия ДО выдачи не должны засчитываться. Проверяем
  // это специально, потому что в activity_log одна строка на день и тип —
  // наивный подсчёт «по created_at» ломался ровно здесь.
  const dayNow = new Date().toISOString().slice(0, 10)
  // читал ДО выдачи домашки — это не должно пойти в зачёт
  await student.rpc('log_activity', { p_type: 'reader', p_day: dayNow, p_items: 4 })

  const readHw = await teacher.rpc('create_homework', {
    p_student_id: ids.student,
    p_lang: 'en',
    p_due: new Date(Date.now() + 7 * 86400000).toISOString(),
    p_items: [{ kind: 'text', title: 'Прочитать и разобрать', target: 2 }],
    p_note: null,
  })
  check('домашка на чтение выдана', !readHw.error, errText(readHw.error))

  const readState = async () => {
    const r = await teacher.rpc('get_homework', { p_student: ids.student })
    return r.data.items[0]
  }
  const beforeAny = await readState()
  check(
    'прошлое чтение НЕ засчитано (счётчик снят на момент выдачи)',
    beforeAny.progress === 0,
    `прогресс: ${beforeAny.progress}`,
  )

  // одна единица чтения ПОСЛЕ выдачи
  await student.rpc('log_activity', { p_type: 'reader', p_day: dayNow, p_items: 1 })
  const afterRead = await readState()
  check(
    'чтение после выдачи засчитано, пункт ещё открыт',
    afterRead.progress === 1 && !afterRead.done_at,
    `прогресс: ${afterRead.progress}`,
  )

  // вторая единица — но уже ЗАДАНИЕМ преподавателя, другой дорогой
  await student.rpc('log_activity', { p_type: 'assignment', p_day: dayNow, p_items: 1 })
  const afterAssign = await readState()
  check(
    'разобранное задание закрывает тот же пункт, что и читалка',
    afterAssign.progress >= 2 && !!afterAssign.done_at,
    `прогресс: ${afterAssign.progress}, закрыт: ${!!afterAssign.done_at}`,
  )
  check('и закрыл его сервер, а не ученик', afterAssign.done_by === 'server', afterAssign.done_by)

  // ---- 12. РЕЧЬ: тот же счётчик-от-отметки -----------------------------------
  await student.rpc('log_activity', { p_type: 'pronunciation', p_day: dayNow, p_items: 9 })
  const speechHw = await teacher.rpc('create_homework', {
    p_student_id: ids.student,
    p_lang: 'en',
    p_due: new Date(Date.now() + 7 * 86400000).toISOString(),
    p_items: [{ kind: 'speech', title: 'Проговорить вслух 5 выученных слов', target: 5 }],
    p_note: null,
  })
  check('домашка на речь выдана', !speechHw.error, errText(speechHw.error))
  const speechBefore = (await teacher.rpc('get_homework', { p_student: ids.student })).data.items[0]
  check(
    'девять прошлых заходов в речь не закрыли пункт на пять',
    speechBefore.progress === 0 && !speechBefore.done_at,
    `прогресс: ${speechBefore.progress}`,
  )
  await student.rpc('log_activity', { p_type: 'pronunciation', p_day: dayNow, p_items: 5 })
  const speechAfter = (await teacher.rpc('get_homework', { p_student: ids.student })).data.items[0]
  check(
    'пять новых заходов пункт закрыли',
    speechAfter.progress >= 5 && !!speechAfter.done_at,
    `прогресс: ${speechAfter.progress}`,
  )
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  for (const id of Object.values(ids)) {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  console.log('Тестовые аккаунты удалены.')
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exit(ok === results.length ? 0 : 1)
}
