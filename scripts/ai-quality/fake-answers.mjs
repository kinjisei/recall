/**
 * Заготовки ХОРОШИХ ответов модели — по одному примеру на задачу (PLAN.md
 * Ф2.20). Нужны двоим:
 *   • `check-ai-*.mjs --fake` — весь путь проверки (сервер, тестовая база,
 *     правила, файлы, итог) без единого запроса к AI: модель «отвечает»
 *     отсюда;
 *   • `test-ai-quality-rules.mjs` — правила зелёные на хорошем ответе и
 *     краснеют на испорченном.
 * Ключ — номер примера, значение — ответы модели по порядку запросов
 * (у материала два: план и текст).
 */

const json = (o) => JSON.stringify(o)

export const FAKE = {
  'en-a1-family': [
    json({
      comments:
        'Проверил заявку: nevertheless — слово уровня B2, для A1 слишком сложное, заменил на also. Остальные слова подходят A1. ' +
        'Грамматика — Present Simple с -s для he/she, тема A1, оставил.',
      vocabulary: ['mother', 'brother', 'kitchen', 'every day', 'also', 'father'],
      grammar_focus: 'Present Simple: he/she + -s',
      exercise_plan: [
        { kind: 'comprehension', type: 'mcq', count: 3, note: 'вопросы по смыслу текста' },
        { kind: 'grammar', type: 'fill', count: 2, note: 'he/she + -s' },
        { kind: 'grammar', type: 'order', count: 2, note: 'собрать предложение из слов' },
        { kind: 'vocab', type: 'mcq', count: 2, note: 'определение → слово' },
      ],
    }),
    json({
      title: 'My Family',
      body:
        'My name is Tom. I live with my mother, my father and my brother Sam. My mother is a doctor. She works in a big hospital. ' +
        'My father cooks dinner every day. He likes the kitchen very much.\n\nMy brother is ten. He goes to school and he plays football. ' +
        'I also play football with him. In the evening we watch TV together. I love my family.',
      exercises: [
        { kind: 'comprehension', type: 'mcq', prompt: "What is Tom's mother?", options: ['A teacher', 'A doctor', 'A cook', 'A driver'], answer: 1 },
        { kind: 'comprehension', type: 'mcq', prompt: 'Who cooks dinner every day?', options: ['Tom', 'Sam', "Tom's father", "Tom's mother"], answer: 2 },
        { kind: 'comprehension', type: 'mcq', prompt: 'How old is Sam?', options: ['Eight', 'Nine', 'Ten', 'Eleven'], answer: 2 },
        { kind: 'grammar', type: 'fill', prompt: 'She ___ in a big hospital.', answer: 'works', hint: 'work, она — добавь -s' },
        { kind: 'grammar', type: 'fill', prompt: 'He ___ the kitchen very much.', answer: 'likes', hint: 'like, он — добавь -s' },
        { kind: 'grammar', type: 'order', prompt: 'Он ходит в школу.', words: ['school', 'goes', 'He', 'to'], answer: ['He', 'goes', 'to', 'school'] },
        {
          kind: 'grammar',
          type: 'order',
          prompt: 'Вечером мы вместе смотрим телевизор.',
          words: ['TV', 'the', 'we', 'In', 'together', 'evening', 'watch'],
          answer: ['In', 'the', 'evening', 'we', 'watch', 'TV', 'together'],
        },
        { kind: 'vocab', type: 'mcq', prompt: 'the room where you cook food', options: ['kitchen', 'school', 'hospital', 'family'], answer: 0 },
        { kind: 'vocab', type: 'mcq', prompt: 'a woman who has a child is the child’s …', options: ['mother', 'brother', 'father', 'doctor'], answer: 0 },
      ],
    }),
  ],

  'en-a2-ann': [
    json({
      items: [
        { index: 0, ok: true, comment: '' },
        { index: 1, ok: false, comment: 'По тексту кофе пил брат, а Ann пила апельсиновый сок. Правильный ответ: Orange juice.' },
        { index: 2, ok: false, comment: 'Почти: пропущена буква — пишется played.' },
        { index: 3, ok: false, comment: 'go — неправильный глагол, в прошедшем времени went, а не goed.' },
        { index: 4, ok: false, comment: 'С she (Ann) нужно does: doesn’t like.' },
        { index: 5, ok: true, comment: 'Верно: large — синоним, в тексте было big.' },
        { index: 6, ok: true, comment: '' },
        { index: 7, ok: false, comment: 'tiny — «крошечный», а по определению нужно huge — «огромный».' },
        { index: 8, ok: false, comment: 'Ответа нет. Правильно: visited.' },
        { index: 9, ok: true, comment: 'Верно, регистр не важен.' },
      ],
    }),
  ],

  'en-b1-work': [
    json({
      level: 'B1',
      targetWords: [
        { w: 'deadline', used: true },
        { w: 'colleague', used: true },
        { w: 'responsible', used: true },
      ],
      targetGrammar: [
        { t: 'Present Simple', used: true },
        { t: 'Present Continuous', used: true },
      ],
      focus: [
        {
          type: 'Предлоги после глаголов и прилагательных',
          why: 'Неверный предлог ломает привычное сочетание, и читатель спотыкается на фразе.',
          examples: [
            { was: 'interested on', fix: 'interested in' },
            { was: 'depends of', fix: 'depends on' },
            { was: 'arrive to the office', fix: 'arrive at the office' },
          ],
        },
      ],
      errors: [
        { was: 'interested on', fix: 'interested in', type: 'grammar' },
        { was: 'depends of', fix: 'depends on', type: 'grammar' },
        { was: "he don't like", fix: "he doesn't like", type: 'grammar' },
        { was: 'arrive to the office', fix: 'arrive at the office', type: 'grammar' },
        { was: 'I am agree', fix: 'I agree', type: 'grammar' },
      ],
      strengths: ['Понятно описан рабочий день', 'Present Continuous верно употреблён для текущего проекта'],
      improve: ['Повтори предлоги после глаголов: interested in, depend on, arrive at'],
      topics: ['Предлоги после глаголов'],
      words: ['be in charge of'],
      rewrites: [{ was: 'I am really interested on my job', better: 'I really enjoy my job' }],
    }),
  ],

  'ielts-t2-55': [
    json({
      band: 5.5,
      criteria: { task: 6, coherence: 6, lexis: 5, grammar: 5 },
      focus: [
        {
          type: 'Артикли перед исчисляемыми существительными',
          why: 'Без артикля фраза звучит как набор слов, и читатель спотыкается.',
          examples: [
            { was: 'If child starts', fix: 'If a child starts' },
            { was: 'big advantage', fix: 'a big advantage' },
            { was: 'Government should', fix: 'The government should' },
          ],
        },
      ],
      errors: [
        { was: 'discuss about', fix: 'discuss', type: 'grammar' },
        { was: 'more easier', fix: 'more easily', type: 'grammar' },
        { was: 'If child starts', fix: 'If a child starts', type: 'grammar' },
        { was: 'some people says', fix: 'some people say', type: 'grammar' },
        { was: 'wrong informations', fix: 'wrong information', type: 'vocab' },
        { was: 'When they will go', fix: 'When they go', type: 'grammar' },
        { was: 'big advantage', fix: 'a big advantage', type: 'grammar' },
        { was: 'Government should', fix: 'The government should', type: 'grammar' },
      ],
      strengths: ['Есть вступление, две точки зрения и вывод'],
      improve: ['Артикли a/the перед исчисляемыми', 'Больше примеров в аргументах'],
      topics: ['Артикли'],
      words: ['acquire a language'],
      rewrites: [{ was: 'Their brain is like a sponge', better: 'Young learners absorb new words remarkably quickly' }],
    }),
  ],

  'en-a2-travel': [
    json({
      summary: 'Сначала закрываем неправильные глаголы в прошедшем времени и артикли — на них ученик ошибается чаще всего. Потом — речь для поездки: отель, ресторан, аэропорт.',
      weeks: [
        {
          title: 'Неделя 1: неправильные глаголы',
          focus: 'Past Simple неправильных глаголов в рассказе о поездке',
          items: [
            { type: 'grammar', topicId: 14, title: 'Past Simple: неправильные глаголы', note: 'Урок и упражнения: went, bought, saw — по 10 минут в день.' },
            { type: 'words', title: '20 слов «Отель»', note: 'По 5 слов в день на карточках, повторение по расписанию.' },
            { type: 'dialog', title: 'Заселение в отель', note: 'Диалог с AI: бронь, ключ, завтрак.' },
          ],
        },
        {
          title: 'Неделя 2: артикли',
          focus: 'Артикли a/the в просьбах и вопросах',
          items: [
            { type: 'grammar', topicId: 2, title: 'Артикли a / an и the', note: 'Урок и 2 набора упражнений.' },
            { type: 'speech', title: 'Произношение чисел и цен', note: 'Повтори за диктором 15 фраз с ценами.' },
            { type: 'dialog', title: 'Заказ в ресторане', note: 'Диалог с AI: меню, счёт, аллергия.' },
          ],
        },
        {
          title: 'Неделя 3: планы на поездку',
          focus: 'Going to для планов',
          items: [
            { type: 'grammar', topicId: 18, title: 'Going to — планы', note: 'Урок, потом 5 предложений о своей поездке.' },
            { type: 'words', title: '20 слов «Аэропорт»', note: 'По 5 слов в день.' },
            { type: 'reading', title: 'Текст про регистрацию на рейс', note: 'Прочитай и ответь на вопросы.' },
          ],
        },
        {
          title: 'Неделя 4: в дороге',
          focus: 'Will для решений на месте',
          items: [
            { type: 'grammar', topicId: 19, title: 'Will — будущее время', note: 'Урок и упражнения.' },
            { type: 'dialog', title: 'Аэропорт: регистрация и багаж', note: 'Диалог с AI, 10 минут.' },
            { type: 'custom', title: 'Мини-разговорник', note: 'Выпиши 15 фраз для поездки и проговори вслух.' },
          ],
        },
      ],
    }),
  ],
}
