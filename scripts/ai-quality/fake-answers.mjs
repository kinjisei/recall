/**
 * Заготовки ХОРОШИХ ответов модели — по одному примеру на задачу (PLAN.md
 * Ф2.20). Нужны троим:
 *   • `check-ai-*.mjs --fake` — весь путь проверки (сервер, тестовая база,
 *     правила, файлы, итог) без единого запроса к AI: модель «отвечает»
 *     отсюда;
 *   • `test-ai-quality-rules.mjs` — правила зелёные на хорошем ответе и
 *     краснеют на испорченном;
 *   • `test-writing-rescore.mjs` — пересчёт балла письма на сохранённом
 *     прогоне (`fakeWritingRun` внизу: answers.json письма целиком).
 * Ключ — номер примера, значение — ответы модели по порядку запросов
 * (у материала два: план и текст).
 */
import { officialExample } from './examples/official.mjs'
import { WRITING } from './examples/writing.mjs'

const json = (o) => JSON.stringify(o)

export const FAKE = {
  'en-a1-family': [
    json({
      comments:
        'Проверил заявку: nevertheless — слово уровня B2, для A1 слишком сложное, заменил на also. Остальные слова подходят A1. ' +
        'Грамматика — Present Simple с -s для he/she, тема A1, оставил.',
      vocabulary: ['mother', 'brother', 'kitchen', 'every day', 'also', 'father'],
      grammar_focus: 'Present Simple: he/she + -s',
      // вид — id каталога (Ф2.25-2), у пар count — число пар
      exercise_plan: [
        { format: 'mcq', count: 3, note: 'вопросы по смыслу текста' },
        { format: 'tfng', count: 1, note: 'утверждение по тексту', tricky: false },
        { format: 'fill_form', count: 2, note: 'he/she + -s' },
        { format: 'order', count: 2, note: 'собрать предложение из слов' },
        { format: 'match_translation', count: 4, note: 'соедини слово и перевод' },
        { format: 'word_by_definition', count: 2, note: 'определение → слово' },
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
        {
          kind: 'comprehension',
          type: 'mcq',
          format: 'tfng',
          prompt: 'Tom’s mother cooks dinner every day.',
          options: ['True', 'False'],
          answer: 1,
          quote: 'My father cooks dinner every day.',
          mark: 'My father',
          why: 'Ужин каждый день готовит папа, а мама работает врачом.',
        },
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
        {
          kind: 'vocab',
          type: 'match',
          format: 'translation',
          prompt: 'Соедини слово и перевод',
          pairs: [
            { left: 'mother', right: 'мама' },
            { left: 'brother', right: 'брат' },
            { left: 'kitchen', right: 'кухня' },
            { left: 'play football', right: 'играть в футбол' },
          ],
          extra: ['больница'],
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
      // лист CEFR (журнал п.77): уровень считает код — вторая снизу сторона текста
      aspects: {
        task: { level: 'B1', fits: 'Все пункты задания раскрыты связным текстом', next: { need: 'Подкрепи мнение примером: что именно нравится и почему', was: '', fix: '' } },
        range: { level: 'B1', fits: 'Хватает слов о работе', next: { need: 'Бери точные слова вместо общих: вместо «prepare documents» можно «draw up documents»', was: '', fix: '' } },
        accuracy: { level: 'A2', fits: 'Повторяются ошибки в предлогах', next: { need: 'Предлоги после глаголов и прилагательных: interested in, depend on', was: 'interested on', fix: 'interested in' } },
        coherence: { level: 'B1', fits: 'Мысли идут по порядку', next: { need: 'Связывай абзацы: However, Also', was: '', fix: '' } },
      },
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
      // лист экзаменатора (журнал п.77): итог 5,5 считает код из 6/6/5/5
      criteria: {
        task: { band: 6, fits: 'Обе точки зрения и своё мнение есть', next: { need: 'Раскрой каждую идею примером', was: '', fix: '' } },
        coherence: { band: 6, fits: 'Абзацы и связки есть, местами механически', next: { need: 'Связывай мысли внутри абзаца, а не только началом абзаца', was: '', fix: '' } },
        lexis: { band: 5, fits: 'Ошибки в формах слов заметны', next: { need: 'Неисчисляемые и степени сравнения: information, easier', was: 'wrong informations', fix: 'wrong information' } },
        grammar: { band: 5, fits: 'Частые ошибки в артиклях и согласовании', next: { need: 'Артикли перед исчисляемыми в единственном числе', was: 'If child starts', fix: 'If a child starts' } },
      },
      limits: [],
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

// ── Прогон письма для пересчёта балла (Ф2.20-4, ai-quality/rescore.mjs) ─────

/** Лист экзаменатора в форме схемы письма (`domains/writing/schema.ts`). */
const sheet = (bands, grammar, { limits = [], errors = [] } = {}) =>
  json({
    errors: [...grammar.map(([was, fix]) => ({ was, fix, type: 'grammar' })), ...errors],
    criteria: Object.fromEntries(Object.entries(bands).map(([k, band]) => [k, { band, fits: 'выдумано для теста', next: null }])),
    limits,
    focus: [],
    strengths: [],
    topics: [],
    words: [],
    rewrites: [],
  })

/**
 * «Официальные» работы — ВЫДУМАННЫЕ (настоящие вне git), в форме записи
 * essays.json. Листы подобраны так, чтобы варианты калибровки давали разный
 * итог; `ran` — что записал бы прогон (балл кода при порогах 0,35 / 0,5 и
 * округлении вниз), сверяет тест с настоящим `parseIelts`:
 *   a — без ошибок 4 из 10 (0,4): «большинство», Grammar ≤ 7; порог 7 выше
 *       0,4 — «часто», Grammar 6. Правка vocab в долю не идёт;
 *   b — 6 из 10 (0,6): потолка нет, 7/7/7/8 = 7,25 — вниз 7, до половины 7,5;
 *       порог 8 от 0,6 — Grammar 7;
 *   c — модель назвала «incomplete»: Task 5, итог 5,25;
 *   d — один абзац на 106 слов: код ставит «no_paragraphs», Coherence 5,
 *       итог 4,75;
 *   e — ответа нет (лимит): пересчёт его называет, а не молчит.
 */
const FAKE_OFFICIAL = [
  {
    id: 'fake-a',
    task: 'academic-task2',
    band: 6,
    prompt: 'Some people think that living in a city is better than living in the countryside. Discuss both views and give your own opinion.',
    essay:
      'Nowadays many people thinks that city life is better than village life. They says that cities offer more jobs and better schools. I partly agree with this view. However, life in a village have its own advantages. For example, the air is more cleaner there.\n\n' +
      'In the city people spend hours in traffic every day. This make them tired and stressed. In a village, by contrast, neighbours know and help each other. In conclusion, both places has good and bad sides. The best choice depends on what a person values most.',
    sheet: sheet(
      { task: 7, coherence: 6, lexis: 6, grammar: 7 },
      [
        ['many people thinks', 'many people think'],
        ['They says', 'They say'],
        ['a village have', 'a village has'],
        ['more cleaner', 'cleaner'],
        ['This make', 'This makes'],
        ['places has', 'places have'],
      ],
      { errors: [{ was: 'spend hours in traffic', fix: 'spend hours stuck in traffic', type: 'vocab' }] },
    ),
    ran: { band: 6.5, criteria: { task: 7, coherence: 6, lexis: 6, grammar: 7 } },
  },
  {
    id: 'fake-b',
    task: 'academic-task2',
    band: 7,
    prompt: 'Some people believe that university education should be free for everyone. To what extent do you agree or disagree?',
    essay:
      'Some people believe that university education should be free for everyone. Others argue that students should pay for their own studies. In my opinion, the government should cover most of the cost. Firstly, education benefit the whole society, not only the graduate. Doctors, engineers and teachers trained at public expense serve everyone.\n\n' +
      'Secondly, high fees discourages talented students from poor families. On the other hand, free education may lead to overcrowded universities. This problem can be solved by strict entrance exam. Overall, I am convinced that the advantages outweighs the drawbacks. Society should therefore invest in its young people.',
    sheet: sheet({ task: 7, coherence: 7, lexis: 7, grammar: 8 }, [
      ['education benefit', 'education benefits'],
      ['high fees discourages', 'high fees discourage'],
      ['by strict entrance exam', 'by a strict entrance exam'],
      ['advantages outweighs', 'advantages outweigh'],
    ]),
    ran: { band: 7, criteria: { task: 7, coherence: 7, lexis: 7, grammar: 8 } },
  },
  {
    id: 'fake-c',
    task: 'gt-task2',
    band: 5,
    prompt: 'Social media has more negative than positive effects on young people. Do you agree or disagree?',
    essay:
      'Many young people today uses social media every day. It have both positive and negative effects. Social media help peoples to stay in touch with friends. But it also waste a lot of time.\n\n' +
      'Some students cannot concentrate on there homework. I think parents should control it. Also schools can teach children to use it wisely. In conclusion social media is useful but dangerous if people uses it too much.',
    sheet: sheet(
      { task: 6, coherence: 6, lexis: 5, grammar: 5 },
      [
        ['young people today uses', 'young people today use'],
        ['It have', 'It has'],
        ['help peoples', 'help people'],
        ['it also waste', 'it also wastes'],
        ['on there homework', 'on their homework'],
        ['people uses', 'people use'],
      ],
      { limits: ['incomplete'] },
    ),
    ran: { band: 5, criteria: { task: 5, coherence: 6, lexis: 5, grammar: 5 } },
  },
  {
    id: 'fake-d',
    task: 'academic-task2',
    band: 4,
    prompt: 'Traffic is growing in many cities. Should governments build more roads or improve public transport?',
    essay:
      'In many countries the number of cars on the roads grow every year. This cause traffic jams and air pollution in big cities. Some people think that the government should simply build more and wider roads. Other people thinks public transport is the better answer. In my opinion, public transport is more better for everyone. Buses and trains can carry many passengers at once. They also produces less pollution than private cars. But many buses is old and uncomfortable. The government should spend money to make them more modern and more cheap. Then more people will happily leave their cars at home and take the bus.',
    sheet: sheet({ task: 5, coherence: 6, lexis: 5, grammar: 4 }, [
      ['grow every year', 'grows every year'],
      ['This cause', 'This causes'],
      ['Other people thinks', 'Other people think'],
      ['more better', 'better'],
      ['They also produces', 'They also produce'],
      ['many buses is', 'many buses are'],
      ['more cheap', 'cheaper'],
    ]),
    ran: { band: 4.5, criteria: { task: 5, coherence: 5, lexis: 5, grammar: 4 } },
  },
  {
    id: 'fake-e',
    task: 'academic-task2',
    band: 8,
    prompt: 'Some say history is the most important school subject. To what extent do you agree or disagree?',
    essay: 'History explains how societies came to be the way they are, and that is why every pupil should study it.',
    sheet: null,
    ran: null,
  },
]

/** Наши примеры в том же прогоне: IELTS (коридор эталона) и обычное эссе — его пересчёт обходит. */
const OURS = [
  { id: 'ielts-t2-55', ran: { band: 5.5, criteria: { task: 6, coherence: 6, lexis: 5, grammar: 5 } } },
  { id: 'en-b1-work', ran: { level: 'B1' } },
]

/**
 * answers.json прогона письма — как его пишет harness `finish`: `input` —
 * примеры, `results` — ответ модели (`calls[].text`), разбор (`output.raw`),
 * оценка приложения (`output.grade`, здесь — только балл и критерии) и
 * итоговая строка П11. Каждый вызов — новый объект: тест портит копии.
 */
export function fakeWritingRun() {
  const works = [
    ...OURS.map((o) => ({ ex: WRITING.find((e) => e.id === o.id), text: FAKE[o.id][0], ran: o.ran })),
    ...FAKE_OFFICIAL.map((w) => ({ ex: officialExample({ ...w, set: 'fake', examinerComment: 'выдумано для теста' }), text: w.sheet, ran: w.ran })),
  ]
  const results = works.map(({ ex, text, ran }) => {
    const base = { id: ex.id, title: ex.title, note: ex.judge ?? '', judge: [] }
    if (text === null) return { ...base, calls: [{ task: 'writing', system: '', user: '' }], status: 'no-answer', error: 'лимит 20 запросов', rows: [], output: null }
    const call = { task: 'writing', system: '', user: '', ms: 1, model: 'fake', status: 200, text }
    return { ...base, calls: [call], status: 'ok', rows: [{ id: 'О1', ok: true, detail: '' }], output: { grade: structuredClone(ran), raw: JSON.parse(text) } }
  })
  results.push({ id: 'official-set', title: 'Сдвиг балла по официальным работам IELTS', note: '', calls: [], judge: [], status: 'ok', rows: [{ id: 'П11', ok: true, detail: '' }], output: null })
  const args = { dry: false, fake: true, spoil: false, limit: 20, only: null, model: null, report: null }
  return { task: 'writing', args, input: works.map((w) => structuredClone(w.ex)), results }
}
