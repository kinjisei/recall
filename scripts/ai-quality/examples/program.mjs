/**
 * Примеры для check-ai-program (PLAN.md Ф2.20): программа обучения по
 * неделям `generateStudyPlan` — уровень, цель учителя, диагностика ученика
 * (students.mjs). Критерии — criteria.md (Пр*, Д*, О*). Один запрос на пример.
 *
 * `expect.early` — номера уроков слабых тем: хотя бы один должен стоять в
 * первых двух неделях (Пр3). `expect.levels` — допустимые уровни уроков
 * (Пр4; ниже — только слабые темы из `early`).
 */

export const PROGRAM = [
  {
    id: 'en-a2-travel',
    title: 'EN A2 · 4 недели · поездка через месяц · путает Past Simple',
    req: {
      lang: 'en',
      level: 'A2',
      weeks: 4,
      goal: 'Через месяц поездка в Турцию: хочет объясняться в отеле, ресторане, аэропорту',
    },
    student: 'en_a2_past',
    expect: { early: [14, 2], levels: ['A2', 'B1'] },
    judge: 'Пр5: диалоги «отель / ресторан / аэропорт», слова для поездки. Пр6: note — как и сколько, а не «учить лексику».',
  },
  {
    id: 'en-b1-ielts',
    title: 'EN B1 · 8 недель · IELTS Academic 6.0 · слабая лексика',
    req: {
      lang: 'en',
      level: 'B1',
      weeks: 8,
      goal: 'IELTS Academic на 6.0 через два месяца',
    },
    student: 'en_b1_ielts',
    expect: { early: [2, 28, 31], levels: ['B1', 'B2'] },
    judge:
      'Пр5: эссе Task 2 и описание графика Task 1, чтение академических текстов — в пунктах custom/reading. ' +
      'summary не обещает балл. Лексика — слабая категория (9/16) — усилена.',
  },
  {
    id: 'en-a1-empty',
    title: 'EN A1 · 2 недели · новый ученик · диагностики нет, цели нет',
    req: { lang: 'en', level: 'A1', weeks: 2, goal: '' },
    student: 'en_new_empty',
    expect: { levels: ['A1', 'A2'] },
    judge: 'Д6 — главное: ни «слабых мест», ни «ученик путает…» — данных нет. Старт с основ (to be, Present Simple).',
  },
  {
    id: 'es-a1-spain',
    title: 'ES A1 · 4 недели · переезд в Испанию · путает ser и estar',
    req: {
      lang: 'es',
      level: 'A1',
      weeks: 4,
      goal: 'Переезд в Испанию через полгода, нужен бытовой испанский: магазин, врач, аренда жилья',
    },
    student: 'es_a1_new',
    expect: { early: [1, 2], levels: ['A1', 'A2'] },
    judge: 'О4: испанский Испании (piso, móvil, vosotros). Пр5: магазин, врач, аренда — в пунктах. Номера — испанского каталога.',
  },
  {
    id: 'es-b1-dele',
    title: 'ES B1 · 6 недель · DELE B1 · indefinido/imperfecto',
    req: {
      lang: 'es',
      level: 'B1',
      weeks: 6,
      goal: 'Сдаёт DELE B1 через полтора месяца',
    },
    student: 'es_b1_imperf',
    expect: { early: [28, 21], levels: ['A2', 'B1', 'B2'] },
    judge: 'Пр5: части DELE (письмо, устная часть, чтение, аудирование) видны в пунктах. A2-уроки — только как слабые темы.',
  },
  {
    id: 'en-c1-business',
    title: 'EN C1 · 3 недели · деловая переписка и переговоры',
    req: {
      lang: 'en',
      level: 'C1',
      weeks: 3,
      goal: 'Деловая переписка и переговоры с иностранными партнёрами',
    },
    student: 'en_c1_business',
    expect: { early: [41, 53], levels: ['B2', 'C1'] },
    judge: 'Пр4: ни одного урока A1–A2. Пр5: письма партнёрам, переговоры — custom/dialog.',
  },
]
