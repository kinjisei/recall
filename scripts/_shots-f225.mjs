/**
 * Снимки Ф2.25 (упражнения материала) для `shots-screens.mjs --only material-run`.
 *
 * Ф2.25-1а — ученик решает новые форматы (макет u5). Материал «A long day at
 * the airport» (A2) у Әсел: два «Выбери ответ», «Соедини слово и перевод»,
 * «Верно / Неверно», «Соедини слово и объяснение», «Вставь форму» — шесть
 * упражнений, как в кадрах («3 / 6»). Пройденное — черновиком ответов (как
 * после перезагрузки; строку «Черновик восстановлен» перед снимком убираем —
 * в кадре задание идёт без перерыва), дальше — нажатия, как в кадре:
 *   material-match         — u5-1: delay и luggage соединены, gate ждёт пару;
 *   material-match-checked — u5-2: после «Проверить» 3 из 4 пар;
 *   material-tf            — u5-3: «Верно или неверно?» до ответа;
 *   material-tf-answered   — u5-3, мини-кадр: ответ False — верно, строка из текста;
 *   material-define        — u5-4: «Соедини слово и объяснение» на компьютере.
 * Сверх кадров — что задето тем же заходом:
 *   material-mcq      — «Выбери ответ» в той же рамке (шапка u5 для прежних видов);
 *   material-reviewed — разбор проверенной работы: счёт в баллах, пары с
 *                       отметкой учителя (вторая копия материала, проверена).
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const BODY = [
  'Dana had a holiday in Spain, and she was happy. She came to the airport early, but the screen said: “Delay — 3 hours”.',
  'Dana waited near the gate for three hours. She read a book and drank some tea. Her luggage was already on the plane.',
  'Then a woman at the desk said: “Sorry, the plane is broken. There is no flight today.” Dana missed her flight, but it was not her fault.',
  'The woman gave her a ticket for the evening flight and a new boarding pass. Dana was very tired, but she got home at midnight.',
].join('\n\n')

const AIRPORT = [
  { kind: 'comprehension', type: 'mcq', prompt: 'Why did Dana wait near the gate for three hours?', options: ['Her flight had a delay.', 'She lost her boarding pass.', 'She came to the airport late.', 'The gate was closed.'], answer: 0 },
  { kind: 'comprehension', type: 'mcq', prompt: 'What did the woman at the desk give Dana?', options: ['A ticket for the evening flight.', 'A new suitcase.', 'A cup of tea.', 'A map of the airport.'], answer: 0 },
  {
    kind: 'vocab',
    type: 'match',
    format: 'translation',
    prompt: 'Соедини слово и перевод',
    pairs: [
      { left: 'delay', right: 'задержка' },
      { left: 'gate', right: 'выход на посадку' },
      { left: 'boarding pass', right: 'посадочный талон' },
      { left: 'luggage', right: 'багаж' },
    ],
    extra: ['опоздать на рейс'],
  },
  {
    kind: 'comprehension',
    type: 'mcq',
    format: 'tfng',
    prompt: 'Dana missed her flight because she came to the airport late.',
    options: ['True', 'False'],
    answer: 1,
    quote: 'She came to the airport early, but the screen said: “Delay — 3 hours”.',
    mark: 'early',
    why: 'Она приехала рано, а опоздала из-за задержки рейса',
  },
  {
    kind: 'vocab',
    type: 'match',
    format: 'definition',
    prompt: 'Соедини слово и объяснение',
    pairs: [
      { left: 'delay', right: 'when something happens later than planned' },
      { left: 'gate', right: 'the place where you get on the plane' },
      { left: 'boarding pass', right: 'a ticket you show to get on the plane — on paper or in your phone' },
      { left: 'luggage', right: 'the bags you take on a trip' },
    ],
    extra: ['be too late to get on your plane'],
  },
  { kind: 'grammar', type: 'fill', prompt: 'She ___ (wait) near the gate for three hours.', answer: 'waited' },
]

// ответы на пройденное — как их пишет экран (useAnswerDraft)
const DONE = {
  0: { index: 0, given: 'Her flight had a delay.', auto_ok: true },
  1: { index: 1, given: 'A ticket for the evening flight.', auto_ok: true },
  2: {
    index: 2,
    given: 'delay → опоздать на рейс; gate → выход на посадку; boarding pass → посадочный талон; luggage → багаж',
    auto_ok: false,
    pairs: ['опоздать на рейс', 'выход на посадку', 'посадочный талон', 'багаж'],
  },
  3: { index: 3, given: 'False', auto_ok: true },
}
const answersBefore = (index) => Object.fromEntries(Object.entries(DONE).filter(([k]) => Number(k) < index))

/** Нажать половину пары: L — слово, R — вариант справа (по тексту). */
const pair = (side, label) => (page) =>
  page.evaluate(
    (s, l) => [...document.querySelectorAll(`button[data-pair-side="${s}"]`)].find((b) => b.lastElementChild?.textContent.trim() === l || [...b.querySelectorAll('span')].some((x) => x.textContent.trim() === l))?.click(),
    side,
    label,
  )
const tapText = (label) => (page) => page.evaluate((l) => [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === l)?.click(), label)
const fresh = (page) => page.evaluate(() => [...document.querySelectorAll('main p')].filter((p) => p.textContent.startsWith('Черновик восстановлен')).forEach((p) => p.remove()))
const steps = (...fns) => async (page) => {
  await fresh(page)
  for (const f of fns) {
    await f(page)
    await sleep(250)
  }
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await sleep(300)
}

export async function shotsMaterialRun({ screen, admin, must, t, s }) {
  const [mat] = must(
    await admin
      .from('materials')
      .insert({ teacher_id: t.id, lang: 'en', level: 'A2', topic: 'Travel problems', format: 'рассказ', length_range: '100-140', title: 'A long day at the airport', body: BODY, exercises: AIRPORT })
      .select('id'),
    'материал u5',
  )
  const [asg] = must(await admin.from('material_assignments').insert({ material_id: mat.id, student_id: s.id }).select('id'), 'назначение u5')
  const path = `/assignments?a=${asg.id}&stage=exercises`
  // черновик ответов — до загрузки страницы (снимок открывает адрес заново)
  const draftAt = (index) => (page) =>
    page.evaluate(
      (key, v) => localStorage.setItem(key, JSON.stringify({ v, at: Date.now() })),
      `recall.draft.${s.id}.assignment:${asg.id}`,
      { answers: answersBefore(index), index },
    )
  const expect = /Соедини слово|Верно или неверно/

  await screen(s.email, [
    { name: 'material-match', path, expect, before: draftAt(2), prepare: steps(pair('L', 'delay'), pair('R', 'опоздать на рейс'), pair('L', 'luggage'), pair('R', 'багаж'), pair('L', 'gate')) },
    {
      name: 'material-match-checked',
      path,
      expect,
      before: draftAt(2),
      prepare: steps(
        pair('L', 'delay'),
        pair('R', 'опоздать на рейс'),
        pair('L', 'gate'),
        pair('R', 'выход на посадку'),
        pair('L', 'boarding pass'),
        pair('R', 'посадочный талон'),
        pair('L', 'luggage'),
        pair('R', 'багаж'),
        tapText('Проверить'),
      ),
    },
    { name: 'material-tf', path, expect, before: draftAt(3), prepare: steps() },
    { name: 'material-tf-answered', path, expect, before: draftAt(3), prepare: steps(tapText('False')) },
    { name: 'material-define', path, expect, before: draftAt(4), prepare: steps(pair('L', 'delay'), pair('R', 'when something happens later than planned'), pair('L', 'gate'), pair('R', 'the place where you get on the plane'), pair('L', 'luggage')) },
    { name: 'material-mcq', path, expect: /Why did Dana/, before: draftAt(0), prepare: steps() },
  ])

  // проверенная копия: учитель засчитал пару delay вручную — 8 баллов из 12
  const [copy] = must(
    await admin
      .from('materials')
      .insert({ teacher_id: t.id, lang: 'en', level: 'A2', topic: 'Travel problems', format: 'рассказ', length_range: '100-140', title: 'A long day at the airport · проверено', body: BODY, exercises: AIRPORT })
      .select('id'),
    'проверенный материал',
  )
  const answers = [...Object.values(DONE), { index: 4, given: '', auto_ok: false, pairs: [] }, { index: 5, given: 'waited', auto_ok: true }]
  const review = answers.map((a) => ({ index: a.index, ok: a.auto_ok, comment: '' }))
  review[2] = { index: 2, ok: true, comment: 'Пару delay засчитала: «опоздать» тут по смыслу рядом.', pairs: [true, true, true, true] }
  review[4] = { index: 4, ok: false, comment: '', pairs: [false, false, false, false] }
  const [done] = must(
    await admin
      .from('material_assignments')
      .insert({ material_id: copy.id, student_id: s.id, status: 'reviewed', answers, auto_score: 7, auto_total: 13, teacher_review: review, submitted_at: new Date().toISOString(), reviewed_at: new Date().toISOString() })
      .select('id'),
    'проверенная работа',
  )
  await screen(s.email, [{ name: 'material-reviewed', path: `/assignments?a=${done.id}&stage=review`, expect: /Проверено преподавателем/, prepare: steps() }])
}
