/**
 * Снимки Ф2.25-3 и -4б — правка упражнений руками и замена через AI на шаге
 * «Текст» мастера (макет d17) для `shots-screens.mjs --only exercise-edit`.
 * Мастер открывается черновиком (как после перезагрузки; строку «Черновик
 * восстановлен» перед снимком убираем — в кадре мастер открыт впервые),
 * открытая форма — своим черновиком `material-exercise-edit`; AI не зовётся
 * (`shots.aiHang`: запрос висит — «AI пишет» не кончается). Остаток замен —
 * как в кадре: строки `ai_calls` со `swap` на сегодня (`swapsUsed`):
 *   edit-mcq    — d17-1: упражнение 2 на правке, четвёртый вариант набран,
 *                 верный не отмечен — «Отметь верный вариант» у вариантов;
 *                 «Замен через AI сегодня: 24 из 25»;
 *   swap-run    — d17-2: пары на правке (пятая без перевода), упражнение 1
 *                 заменяется — скелетон «AI пишет…», «23 из 25»;
 *   edit-pick   — d17-3: «+ Упражнение» открыт, выбрана «Выбери правильную
 *                 форму», «Составит AI · ещё 23 сегодня» и «Напишу сам»;
 *   edit-new    — d17-3б: пустая форма «Выбери правильную форму · новое»;
 *   swaps-out   — d17-3в: замены кончились — плашка, «Заменить» выключен;
 *   edit-phone  — только 390, окном: форма от верха экрана, «Готово · Отмена»
 *                 сразу после вариантов, рамка цела (решение владельца 04.11).
 * Библиотека (Ф2.25-3б):
 *   lib-lock    — d17-4: «A long day at the airport» — Әсел сдала и
 *                 проверена, Айгерим ещё не сдала: плашка с копией, «Выдан»
 *                 со статусами, у упражнений «правка закрыта»;
 *   lib-edit    — материал без сданных работ: «Изменить» открыл форму
 *                 упражнения 1 на месте (та же, что в мастере).
 * Рамка формы на снимке (для пары с фрагментом d17-3б) пишется в
 * `<папка>/boxes.json`: { "<снимок>": { x, y, w, h } }.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// текст кадров d17 (тот же, что d8-4 и d16)
const BODY =
  'Last summer Dana flew from Almaty to Istanbul. She came to the airport early, but the screen said: “Delay — 3 hours”. Dana was not happy. She bought a coffee and waited near the gate.\n\n' +
  'The plane left very late, and in Istanbul Dana had only forty minutes for her next flight. She ran through the airport with her boarding pass in her hand. But the gate was already closed. She missed her flight!\n\n' +
  'A woman at the desk was very kind. She gave Dana a ticket for the evening flight. Then Dana went to get her luggage, but her bag was not there. “Don’t worry,” the woman said. “It is on the next plane.” Dana laughed. What a day!'

/** Пять упражнений кадров d17: выбор ×2, True / False, пары, «Вставь форму». */
const EXERCISES = [
  { kind: 'comprehension', type: 'mcq', prompt: 'Why did Dana wait near the gate for three hours?', options: ['Her flight had a delay.', 'She came to the airport late.', 'She wanted a coffee.', 'Her bag was lost.'], answer: 0 },
  { kind: 'comprehension', type: 'mcq', prompt: 'What did the woman at the desk give Dana?', options: ['A ticket for the evening flight.', 'A new boarding pass.', 'Her luggage.'], answer: 0 },
  { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana missed her flight because she came to the airport late.', options: ['True', 'False'], answer: 1, quote: 'She came to the airport early', mark: 'early', why: 'В тексте — she came early' },
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
      { left: 'miss a flight', right: 'опоздать на рейс' },
    ],
    extra: ['паспорт'],
  },
  { kind: 'grammar', type: 'fill', prompt: 'She ___ (buy) a coffee and waited near the gate.', answer: 'bought', hint: 'Past Simple от buy' },
]

const draft = (format, patch) => ({ format, prompt: '', options: [], answer: null, text: '', note: '', pairs: [], extra: [], ...patch })

export async function shotsExerciseEdit({ screen, admin, must, sql, t, a, s, dir }) {
  console.log('── правка упражнений (d17)')
  const req = { lang: 'en', level: 'A2', topic: 'Travel problems', format: 'рассказ', lengthRange: '100-140', vocabulary: 'delay, luggage, boarding pass', grammar: 'Past Simple', studentIds: [a.id, s.id] }
  const plan = {
    comments: 'Рассказ: Дана летит из Алматы в Стамбул — рейс задерживают, она опаздывает на пересадку, а багаж теряется.',
    vocabulary: ['delay', 'luggage', 'boarding pass', 'gate', 'miss a flight'],
    grammar_focus: 'Past Simple',
    exercise_plan: [
      { format: 'mcq', kind: 'comprehension', type: 'mcq', count: 2, note: '' },
      { format: 'tfng', kind: 'comprehension', type: 'mcq', count: 1, note: '' },
      { format: 'match_translation', kind: 'vocab', type: 'match', count: 5, note: '' },
      { format: 'fill_form', kind: 'grammar', type: 'fill', count: 1, note: '' },
    ],
  }
  const flow = {
    steps: [{ name: 'form' }, { name: 'plan', req, plan }, { name: 'preview', req, plan, content: { title: 'A long day at the airport', body: BODY, exercises: EXERCISES } }],
    at: 2,
  }
  /** Черновики мастера и открытой формы — как будто учитель уже тут был. */
  const drafts = (open) => async (page) =>
    page.evaluate(
      (uid, flow, form, open) => {
        const put = (k, v) => localStorage.setItem(`recall.draft.${uid}.${k}`, JSON.stringify({ v, at: Date.now() }))
        for (const k of Object.keys(localStorage)) if (k.startsWith(`recall.draft.${uid}.material-`)) localStorage.removeItem(k)
        put('material-flow', flow)
        put('material-request', form)
        if (open) put('material-exercise-edit', open)
        localStorage.setItem('shots.aiHang', '1')
      },
      t.id,
      flow,
      { source: 'generate', ...req, body: '' },
      open,
    )
  const fresh = (page) => page.evaluate(() => [...document.querySelectorAll('main p')].filter((p) => p.textContent.startsWith('Черновик восстановлен')).forEach((p) => p.remove()))
  // d17-1: четвёртый вариант набран, верный не отмечен, «Готово» уже нажимали
  const mcqOpen = {
    at: 1,
    draft: draft('mcq', { prompt: EXERCISES[1].prompt, options: [...EXERCISES[1].options, 'A cup of coffee.'], answer: null }),
    was: EXERCISES[1],
    tried: true,
  }
  const newOpen = { at: 'new', draft: draft('form', { options: ['', '', ''] }), was: null, count: EXERCISES.length, tried: false }
  // d17-2: пары на правке, пятая — «ticket» без перевода
  const pairsOpen = {
    at: 3,
    draft: draft('match_translation', { pairs: [...EXERCISES[3].pairs.slice(0, 4), { left: 'ticket', right: '' }], extra: [...EXERCISES[3].extra] }),
    was: EXERCISES[3],
    tried: false,
  }
  /** Сколько замен учитель уже потратил сегодня — остаток как в кадре (25 − n). */
  const swapsUsed = (n) => async () => {
    await sql(`delete from public.ai_calls where user_id = '${t.id}' and swap is not null`)
    if (n > 0) await sql(`insert into public.ai_calls (user_id, kind, cost_energy, is_generation, swap, called_at) select '${t.id}', 'heavy', 0, false, 'light', now() from generate_series(1, ${n})`)
  }
  const both = (...fns) => async (page) => {
    for (const f of fns) await f(page)
  }
  const boxes = existsSync(`${dir}/boxes.json`) ? JSON.parse(readFileSync(`${dir}/boxes.json`, 'utf8')) : {}
  /** Рамка формы — для пары с фрагментом кадра; фокус — как в кадре. */
  const focus = (name, sel) => async (page) => {
    await fresh(page)
    await page.focus(sel).catch(() => {})
    await sleep(200)
    const box = await page.evaluate(() => {
      const r = document.querySelector('[data-exercise-edit]')?.getBoundingClientRect()
      return r && { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth }
    })
    if (box) {
      boxes[`${name}-${box.vw}`] = box
      writeFileSync(`${dir}/boxes.json`, JSON.stringify(boxes, null, 2))
    }
  }
  const pick = async (page) => {
    await fresh(page)
    await page.evaluate(() => [...document.querySelectorAll('[data-add-exercise] > button')][0]?.click())
    await sleep(300)
    await page.evaluate(() => document.querySelector('[data-pick="Выбери правильную форму"]')?.click())
    await sleep(300)
  }
  // телефон окном: форма от верха экрана — видна целиком, кнопки после вариантов
  const phone = async (page) => {
    await fresh(page)
    await page.evaluate(() => {
      const r = document.querySelector('[data-exercise-edit]')?.getBoundingClientRect()
      if (r) window.scrollBy(0, r.top - 72)
    })
    await sleep(400)
  }
  // d17-2: фокус на пустом переводе, затем «↻ Заменить» у упражнения 1 — запрос висит, строка «AI пишет»
  const swapRun = async (page) => {
    await focus('swap-run', 'textarea[aria-label="перевод 5"]')(page)
    await page.evaluate(() => document.querySelector('button[aria-label="Заменить упражнение 1"]')?.click())
    await page.waitForSelector('[data-swapping]', { timeout: 5000 }).catch(() => {})
    await page.focus('textarea[aria-label="перевод 5"]').catch(() => {})
    await sleep(300)
  }
  // d17-3в: рамка от упражнения 1 до плашки — для пары с фрагментом кадра
  const outBox = async (page) => {
    await fresh(page)
    const box = await page.evaluate(() => {
      const a = document.querySelector('[data-exercise="1"]')?.getBoundingClientRect()
      const b = document.querySelector('[data-swaps-out]')?.getBoundingClientRect()
      return a && b && { x: Math.round(a.x + scrollX), y: Math.round(a.y + scrollY), w: Math.round(a.width), h: Math.round(b.bottom - a.top), vw: innerWidth }
    })
    if (box) {
      boxes[`swaps-out-${box.vw}`] = box
      writeFileSync(`${dir}/boxes.json`, JSON.stringify(boxes, null, 2))
    }
  }
  const path = '/tasks?tab=materials'
  await screen(t.email, [
    { name: 'edit-mcq', path, before: both(swapsUsed(1), drafts(mcqOpen)), prepare: focus('edit-mcq', 'textarea[aria-label="вариант 4"]'), tall: 1900, expect: /Отметь верный вариант/ },
    { name: 'swap-run', path, before: both(swapsUsed(1), drafts(pairsOpen)), prepare: swapRun, tall: 1900, expect: /Соедини слово и перевод · правка/, skeleton: true },
    // окно выше страницы с открытым выбором: снимок «во всю страницу» не меняет окно, и выбор не закрывается
    { name: 'edit-pick', path, before: both(swapsUsed(2), drafts(null)), prepare: pick, tall: 2500, expect: /Упражнения \(5\)/, wait: /23 из 25/ },
    { name: 'edit-new', path, before: both(swapsUsed(2), drafts(newOpen)), prepare: focus('edit-new', '[data-exercise-edit] textarea[name="prompt"]'), tall: 1900, expect: /Выбери правильную форму · новое/ },
    { name: 'swaps-out', path, before: both(swapsUsed(25), drafts(null)), prepare: outBox, tall: 1900, expect: /Упражнения \(5\)/, wait: /Замены кончились/ },
    { name: 'edit-phone', path, before: both(swapsUsed(1), drafts(mcqOpen)), prepare: phone, overlay: true, phone: true, expect: /Отметь верный вариант/ },
  ])
  await swapsUsed(0)()

  // ---- библиотека (3б): d17-4 и правка до сдачи ----
  const day = (h) => new Date(Date.now() - h * 3600_000).toISOString()
  const lock = must(
    await admin
      .from('materials')
      .insert({ teacher_id: t.id, lang: 'en', level: 'A2', topic: 'Travel problems', format: 'рассказ', length_range: '100-140', title: 'A long day at the airport', body: BODY, exercises: EXERCISES, plan, created_at: day(1) })
      .select('id')
      .single(),
    'материал d17-4',
  )
  const answers = EXERCISES.map((ex, index) => (ex.type === 'match' ? { index, given: '', auto_ok: true, pairs: ex.pairs.map((p) => p.right) } : { index, given: ex.type === 'fill' ? ex.answer : ex.options[ex.answer], auto_ok: true }))
  must(
    await admin.from('material_assignments').insert([
      { material_id: lock.id, student_id: s.id, status: 'reviewed', answers, auto_score: 9, auto_total: 9, teacher_review: answers.map((x) => ({ index: x.index, ok: true, comment: '' })), created_at: day(30), submitted_at: day(26), reviewed_at: day(20) },
      // вставка пачкой: колонки, которых нет в строке, приходят null, а не по умолчанию
      { material_id: lock.id, student_id: a.id, status: 'assigned', created_at: day(30) },
    ]),
    'выдачи d17-4',
  )
  const [morning] = must(await admin.from('materials').select('id').eq('teacher_id', t.id).eq('title', 'My morning routine'), 'материал без сданных')
  const openFirst = async (page) => {
    await page.evaluate(() => document.querySelector('button[aria-label="Изменить упражнение 1"]')?.click())
    await page.waitForSelector('[data-exercise-edit]', { timeout: 5000 }).catch(() => {})
    await sleep(300)
  }
  await screen(t.email, [
    { name: 'lib-lock', path: `/tasks?tab=materials&mat=${lock.id}`, expect: /Работу уже сдали[\s\S]*правка закрыта/ },
    { name: 'lib-edit', path: `/tasks?tab=materials&mat=${morning.id}`, prepare: openFirst, tall: 1400, expect: /Упражнени/ },
  ])
}
