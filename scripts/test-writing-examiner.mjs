/**
 * «Свой экзаменатор» письма (журнал п.77, src/domains/writing/examiner.ts):
 * балл считает код по официальной шкале, а не модель.
 *
 * Держит:
 *   1. предложения и доля предложений без ошибок (правки, не нашедшиеся в
 *      тексте, — доле не верим);
 *   2. итог IELTS — среднее четырёх вниз до половины: 6,25 → 6, 6,75 → 6,5;
 *   3. ступени — целые: 6,5 от модели → 6;
 *   4. потолки шкалы: названные моделью («incomplete» → Task ≤ 5), найденные
 *      кодом (нет абзацев → Cohesion ≤ 5, только у Task 2), чужой для вида
 *      задания — мимо; ≤ 20 слов — все по 1;
 *   5. доля без ошибок ограничивает Grammar: ≤ 0,5 → не выше 7, < 0,35 → не
 *      выше 6;
 *   6. советы по влиянию на балл: потолки → «мало слов» → критерии от
 *      слабого; у критерия с потолком своего «→» нет, у 9 — тоже;
 *   7. CEFR: общий уровень держат три стороны из четырёх; ≤ 20 слов — A1;
 *   8. разбор ответа модели: её «band» не используется, нет критерия —
 *      ошибка, фокус — сначала советы, не больше трёх;
 *   9. промпт: правило «всем признакам полностью», шкала и коды потолков
 *      своего вида; испанское правило — только у испанского.
 *
 * ⚠️ Ожидания — литералами. Запуск: node scripts/test-writing-examiner.mjs
 */
// клиентский код (импорты без расширения, shared/api/ai) — через загрузчик проверок AI
import './ai-quality/loader.mjs'

const W = await import('../src/domains/writing/index.ts')
const G = await import('../src/lib/writingGrade.ts')

let pass = 0
let fail = 0
const check = (name, ok, got) => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — получено: ${JSON.stringify(got)}`}`)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const mark = (band, need = '') => ({ band, next: need ? { need, was: '', fix: '' } : null })
const marks4 = (t, c, l, g) => ({ task: mark(t, 'нужно для Task'), coherence: mark(c, 'нужно для Cohesion'), lexis: mark(l, 'нужно для Lexis'), grammar: mark(g, 'нужно для Grammar') })
const facts = (o = {}) => ({ words: 280, paragraphs: 4, bullets: false, sentences: 12, errorFree: 0.8, ...o })

// 1. предложения и доля без ошибок
const text = 'I like it. He go home!\nDear Sir or Madam,\nShe have a cat? We are fine.'
check('предложения: точка, «!», «?», строка без точки', W.sentences(text).length === 5, W.sentences(text).length)
const f1 = W.textFacts(text, ['He go', 'She have'])
check('доля без ошибок: 2 предложения из 5 с ошибкой → 0,6', Math.abs(f1.errorFree - 0.6) < 1e-9, f1.errorFree)
const f2 = W.textFacts(text, ['He go', 'nothing like this', 'or this'])
check('правок не в тексте больше 30 % — доле не верим (null)', f2.errorFree === null, f2.errorFree)
check('без правок — всё без ошибок', W.textFacts(text, []).errorFree === 1, W.textFacts(text, []).errorFree)

// 2–3. итог и целые ступени
check('6,25 → 6', W.roundBand(6.25) === 6, W.roundBand(6.25))
check('6,75 → 6,5', W.roundBand(6.75) === 6.5, W.roundBand(6.75))
check('6,5 → 6,5', W.roundBand(6.5) === 6.5, W.roundBand(6.5))
const r1 = W.scoreIelts('task2', marks4(7, 6, 6, 6), [], facts())
check('7/6/6/6 → итог 6 (среднее 6,25 вниз)', r1.band === 6 && same(r1.criteria, { task: 7, coherence: 6, lexis: 6, grammar: 6 }), r1)
const r2 = W.scoreIelts('task2', marks4(6.5, 7, 7, 7), [], facts())
check('ступень 6,5 от модели → 6', r2.criteria.task === 6, r2.criteria)

// 4. потолки
const r3 = W.scoreIelts('task2', marks4(7, 7, 7, 7), ['incomplete', 'no_overview'], facts())
check('incomplete → Task 5, no_overview у Task 2 — мимо', r3.criteria.task === 5 && same(r3.limits.map((l) => l.id), ['incomplete']), r3.limits)
check('итог с потолком: 5/7/7/7 → 6,5', r3.band === 6.5, r3.band)
const r4 = W.scoreIelts('task2', marks4(7, 7, 7, 7), [], facts({ paragraphs: 1, words: 260 }))
check('Task 2 одним абзацем → Cohesion 5', r4.criteria.coherence === 5, r4.criteria)
const r5 = W.scoreIelts('gt1', marks4(7, 7, 7, 7), [], facts({ paragraphs: 1, words: 160 }))
check('письмо GT одним абзацем — потолка абзацев нет', r5.criteria.coherence === 7, r5.criteria)
const r6 = W.scoreIelts('task2', marks4(6, 6, 6, 6), [], facts({ words: 18 }))
check('≤ 20 слов — все критерии по 1', same(r6.criteria, { task: 1, coherence: 1, lexis: 1, grammar: 1 }), r6.criteria)
const r7 = W.scoreIelts('task2', marks4(7, 7, 7, 7), [], facts({ bullets: true }))
check('пункты списком → Task 5', r7.criteria.task === 5, r7.criteria)

// 5. доля без ошибок
const r8 = W.scoreIelts('task2', marks4(8, 8, 8, 8), [], facts({ errorFree: 0.45 }))
check('без ошибок 45 % предложений → Grammar не выше 7', r8.criteria.grammar === 7, r8.criteria)
const r9 = W.scoreIelts('task2', marks4(7, 7, 7, 7), [], facts({ errorFree: 0.2 }))
check('без ошибок 20 % → Grammar не выше 6', r9.criteria.grammar === 6, r9.criteria)
const r10 = W.scoreIelts('task2', marks4(8, 8, 8, 8), [], facts({ errorFree: null }))
check('доле не верим — потолка нет', r10.criteria.grammar === 8, r10.criteria)

// 6. советы по влиянию на балл
const r11 = W.scoreIelts(
  'task2',
  { task: mark(7, 'позиция'), coherence: mark(6, 'связки'), lexis: mark(5, 'повторы слов'), grammar: { band: 6, next: { need: 'артикли', was: 'If child starts', fix: 'If a child starts' } } },
  ['incomplete'],
  facts({ words: 210 }),
)
const types = r11.advice.map((a) => a.type)
check('первым — потолок', types[0] === 'Task не выше 5: раскрыта не каждая часть вопроса', types)
check('вторым — мало слов', types[1] === 'Мало слов: 210 из 250', types)
check('дальше критерии от слабого, у Task (потолок) своего «→» нет', same(types.slice(2), ['Lexis 5 → 6', 'Cohesion 6 → 7', 'Grammar 6 → 7']), types)
check('у совета — место в тексте', same(r11.advice.at(-1).examples, [{ was: 'If child starts', fix: 'If a child starts' }]), r11.advice.at(-1))
const r12 = W.scoreIelts('task2', marks4(9, 9, 9, 9), [], facts())
check('у ступени 9 советов «→» нет', r12.advice.length === 0, r12.advice)

// 7. CEFR
check('B1, B1, A2, B2 → B1', W.cefrOverall(['B1', 'B1', 'A2', 'B2']) === 'B1', W.cefrOverall(['B1', 'B1', 'A2', 'B2']))
check('A2, C1, C1, C1 → C1 (одна слабая не обрушивает)', W.cefrOverall(['A2', 'C1', 'C1', 'C1']) === 'C1')
check('A1, A2, A2, B1 → A2', W.cefrOverall(['A1', 'A2', 'A2', 'B1']) === 'A2')
check('«B1+» → B1, «уровень b2» → B2, мусор → null', W.cefrLevel('B1+') === 'B1' && W.cefrLevel('уровень b2') === 'B2' && W.cefrLevel('x') === null)
const cm = (level, need) => ({ level, next: need ? { need, was: '', fix: '' } : null })
const c1 = W.scoreCefr({ task: cm('B1', 'т'), range: cm('A2', 'с'), accuracy: cm('B1', 'т'), coherence: cm('B2', 'св') }, facts({ words: 70 }), 80)
check('CEFR: уровень B1, советы — мало слов, потом Словарь A2 → B1', c1.level === 'B1' && c1.advice[0].type === 'Мало слов: 70 из 80' && c1.advice[1].type === 'Словарь A2 → B1', c1)
const c2 = W.scoreCefr({ task: cm('B2'), range: cm('B2'), accuracy: cm('B2'), coherence: cm('B2') }, facts({ words: 15 }))
check('CEFR ≤ 20 слов → A1', c2.level === 'A1', c2.level)

// 8. разбор ответа модели
const essay = 'Nowadays many parents discuss about the best age. If child starts early, he learn faster.\n\nIn my opinion, early learning is useful.'
const raw = JSON.stringify({
  band: 8,
  errors: [
    { was: 'discuss about', fix: 'discuss', type: 'grammar', why: 'Без предлога' },
    { was: 'If child starts', fix: 'If a child starts', type: 'article', why: 'Артикль' },
    { was: 'he learn', fix: 'he learns', type: 'grammar', why: 'Согласование' },
  ],
  criteria: {
    task: { band: 5, fits: 'позиция есть', next: { need: 'Раскрой обе точки зрения', was: '', fix: '' } },
    coherence: { band: 6, fits: '…', next: { need: 'Связки', was: '', fix: '' } },
    lexis: { band: 6, fits: '…', next: null },
    grammar: { band: 6, fits: '…', next: { need: 'Артикли', was: 'If child starts', fix: 'If a child starts' } },
  },
  limits: [],
  focus: [{ type: 'Артикли', why: 'мешает', examples: [{ was: 'If child starts', fix: 'If a child starts' }] }],
  strengths: ['Есть позиция'],
})
const g1 = G.parseIelts(raw, essay, 'task2')
check('«band: 8» модели не используется: итог по критериям 5/6/6/6 → 5,5', g1.band === 5.5, g1.band)
check('фокус: сначала советы по баллу (мало слов, слабый Task), не больше трёх', g1.focus.length === 3 && g1.focus[0].type === 'Мало слов: 22 из 250' && g1.focus[1].type === 'Task 5 → 6', g1.focus.map((f) => f.type))
check('«Что подтянуть» учителю — тот же порядок строками, повторяющиеся ошибки — после', g1.improve[1] === 'Task 5 → 6 — Раскрой обе точки зрения' && g1.improve.at(-1) === 'Артикли — мешает', g1.improve)
let threw = ''
try {
  G.parseIelts(JSON.stringify({ criteria: { task: { band: 6 }, coherence: { band: 6 }, lexis: { band: 6 } } }), essay, 'task2')
} catch (e) {
  threw = e.message
}
check('нет критерия grammar — ошибка, а не 0', threw === 'AI вернул неполную оценку. Попробуй ещё раз.', threw)
const g2 = G.parseCefr(
  JSON.stringify({ level: 'C1', aspects: { task: { level: 'A2' }, range: { level: 'A2' }, accuracy: { level: 'A1' }, coherence: { level: 'B1' } } }),
  essay,
)
check('CEFR: «level: C1» модели не используется — A2', g2.level === 'A2', g2.level)

// 9. промпт
const task = (o) => ({ id: 't', teacher_id: '', created_at: '', prompt: 'Discuss both views.', level: 'B1', ...o })
const p1 = G.ieltsPrompt(task({ mode: 'ielts', settings: { ieltsTask: 'task2' } }), essay)
check('промпт IELTS: правило «всем признакам полностью»', p1.system.includes('ВСЕМ признакам которой работа соответствует ПОЛНОСТЬЮ'))
check('промпт Task 2: шкала Task Response и коды своего вида', p1.system.includes('TASK RESPONSE') && p1.system.includes('incomplete, tangential, off_topic, simple_only') && !p1.system.includes('no_overview,'))
check('промпт: факты о длине — слов 22, минимум 250', p1.system.includes('слов 22, минимум 250'), p1.system.match(/слов \d+, минимум \d+/)?.[0])
const p2 = G.ieltsPrompt(task({ mode: 'ielts', settings: { ieltsTask: 'gt1' } }), essay)
check('промпт письма GT: шкала Task Achievement, bullet_missing', p2.system.includes('TASK ACHIEVEMENT') && p2.system.includes('bullet_missing'))
const es = G.cefrPrompt(task({ mode: 'regular', lang: 'es' }), 'Mi familia no es muy grande.', 'es')
const en = G.cefrPrompt(task({ mode: 'regular', lang: 'en' }), 'My family is small.', 'en')
check('CEFR-промпт ES — с правилом испанского Испании, EN — без', es.system.includes('вариант ИСПАНИИ') && !en.system.includes('вариант ИСПАНИИ'))
// лимит инструкции на сервере: шкала длинная, иначе разбор письма получил бы отказ 400
const { readFileSync } = await import('node:fs')
const cap = Number(readFileSync(new URL('../api/gemini.ts', import.meta.url), 'utf8').match(/const MAX_SYSTEM_CHARS = ([\d_]+)/)?.[1].replace(/_/g, ''))
const longest = Math.max(
  ...['task2', 'academic1', 'gt1'].map((k) => G.ieltsPrompt(task({ mode: 'ielts', settings: { ieltsTask: k } }), essay).system.length),
  G.cefrPrompt(task({ mode: 'regular', settings: { targetWords: Array(12).fill('word'), targetGrammar: ['Past Simple', 'Present Perfect'] } }), essay, 'es').system.length,
)
check(`промпты письма помещаются в лимит сервера с запасом 2000 (${longest} из ${cap})`, cap > 0 && longest + 2000 <= cap, { longest, cap })

console.log(`\n${pass}/${pass + fail}`)
if (fail) process.exit(1)
