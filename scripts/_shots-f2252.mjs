/**
 * Снимки Ф2.25-2 — упражнения плана (макет d16) для
 * `shots-screens.mjs --only exercise-plan`. Мастер открывается черновиком
 * (как после перезагрузки; строку «Черновик восстановлен» перед снимком
 * убираем — в кадре мастер открыт впервые), AI не зовётся (`shots.aiHang`):
 *   plan-exercises — d16-1: план от AI, четыре вида, «Каверзные» включены,
 *                    правка к плану набрана;
 *   plan-picker    — d16-2: открыт выбор видов, «Соедини слово и объяснение»
 *                    под курсором;
 *   own-exercises  — d16-3: «Мой текст», упражнения прямо в заявке, вопросов
 *                    10 — «Максимум 10 в одном виде»;
 *   plan-pairs6    — d16-4: пар 6 при 5 целевых словах (кадр — 390, полоса
 *                    «4 вида · 11 заданий» внизу).
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// текст кадров d8-4 и d16-3
const BODY =
  'Last summer Dana flew from Almaty to Istanbul. She came to the airport early, but the screen said: “Delay — 3 hours”. Dana was not happy. She bought a coffee and waited near the gate.\n\n' +
  'The plane left very late, and in Istanbul Dana had only forty minutes for her next flight. She ran through the airport with her boarding pass in her hand. But the gate was already closed. She missed her flight!\n\n' +
  'A woman at the desk was very kind. She gave Dana a ticket for the evening flight. Then Dana went to get her luggage, but her bag was not there. “Don’t worry,” the woman said. “It is on the next plane.” Dana laughed. What a day!'

const row = (format, kind, type, count, tricky) => ({ format, kind, type, count, note: '', ...(tricky ? { tricky } : {}) })
/** Четыре вида кадров d16: вопросы, каверзные True / False, пары, «Вставь форму». */
const ROWS = (questions, pairs) => [
  row('mcq', 'comprehension', 'mcq', questions),
  row('tfng', 'comprehension', 'mcq', 3, true),
  row('match_translation', 'vocab', 'match', pairs),
  row('fill_form', 'grammar', 'fill', 4),
]

export async function shotsExercisePlan({ screen, t, a, s }) {
  console.log('── упражнения плана (d16)')
  const req = { lang: 'en', level: 'A2', topic: 'Travel problems', format: 'рассказ', lengthRange: '100-140', vocabulary: 'delay, luggage, boarding pass', grammar: 'Past Simple', studentIds: [a.id, s.id] }
  const plan = (pairs) => ({
    comments: 'Рассказ: Дана летит из Алматы в Стамбул — рейс задерживают, она опаздывает на пересадку, а багаж теряется. Короткие предложения в Past Simple, слова — на уровне A2.',
    vocabulary: ['delay', 'luggage', 'boarding pass', 'gate', 'miss a flight'],
    grammar_focus: 'Past Simple',
    exercise_plan: ROWS(3, pairs),
  })
  /** Черновики мастера: шаги, заявка и правка к плану — как будто учитель уже тут был. */
  const drafts = (flow, form, feedback) => async (page) =>
    page.evaluate(
      (uid, flow, form, feedback) => {
        const put = (k, v) => localStorage.setItem(`recall.draft.${uid}.${k}`, JSON.stringify({ v, at: Date.now() }))
        for (const k of Object.keys(localStorage)) if (k.startsWith(`recall.draft.${uid}.material-`)) localStorage.removeItem(k)
        put('material-flow', flow)
        put('material-request', form)
        if (feedback) put('material-plan-feedback', feedback)
        localStorage.setItem('shots.aiHang', '1')
      },
      t.id,
      flow,
      form,
      feedback,
    )
  const planAt = (pairs) =>
    drafts(
      { steps: [{ name: 'form' }, { name: 'plan', req, plan: plan(pairs), replan: { id: '00000000-0000-4000-8000-000000000000', left: 3 } }], at: 1 },
      { source: 'generate', ...req, body: '' },
      'Добавь короткий диалог у стойки',
    )
  const own = drafts({ steps: [{ name: 'form' }], at: 0 }, { source: 'own', ...req, topic: '', vocabulary: '', body: BODY, rows: ROWS(10, 5) })
  const fresh = (page) => page.evaluate(() => [...document.querySelectorAll('main p')].filter((p) => p.textContent.startsWith('Черновик восстановлен')).forEach((p) => p.remove()))
  const picker = async (page) => {
    await fresh(page)
    await page.evaluate(() => [...document.querySelectorAll('[data-exercise-plan] button')].find((b) => b.textContent.includes('Добавить упражнения'))?.click())
    await sleep(300)
    await page.hover('[data-pick="Соедини слово и объяснение"]').catch(() => {})
  }
  const path = '/tasks?tab=materials'
  await screen(t.email, [
    { name: 'plan-exercises', path, before: planAt(5), prepare: fresh, expect: /Упражнения · 4 вида/ },
    // окно во всю высоту: наведение не прокручивает страницу, «Итог» и меню — на своих местах
    { name: 'plan-picker', path, before: planAt(5), prepare: picker, tall: 1600, expect: /Упражнения · 4 вида/ },
    { name: 'own-exercises', path, before: own, prepare: fresh, expect: /Максимум 10 в одном виде/ },
    { name: 'plan-pairs6', path, before: planAt(6), prepare: fresh, expect: /5 целевых слов \+ 1 из текста/ },
  ])
}
