/**
 * Ученики для примеров с диагностикой (PLAN.md Ф2.20): то, что вернула бы
 * `getStudentDiagnostics` (lib/diagnostics.ts). Проверка подставляет их
 * вместо базы, а сводку для промпта строит настоящий `lib/diagnosticsBrief.ts`
 * — в AI уходит тот же текст, что у учителя.
 *
 * Номера тем — из каталогов приложения (src/data/<язык>/grammar.ts, нумерация
 * по уровню → порядку → названию): EN 2 «Артикли», 14 «Past Simple:
 * неправильные», 28 «Present Perfect или Past Simple?», 31 «Условные
 * (Zero и First)», 33 «Пассивный залог», 36 «Who, which, that», 41 «Past
 * Perfect», 53 «Had I known…»; ES 1 «SER», 2 «ESTAR», 21 «SER или ESTAR»,
 * 28 «Indefinido или Imperfecto». Каталог сменился — проверка скажет, что
 * номер ведёт не на ту тему.
 */

const kinds = (c, g, v) => ({
  comprehension: { ok: c[0], total: c[1] },
  grammar: { ok: g[0], total: g[1] },
  vocab: { ok: v[0], total: v[1] },
})

const words = (total, learning, struggling) => ({
  total,
  learning,
  learned: total - learning,
  struggling: struggling.map(([front, lapses]) => ({ front, lapses })),
})

/** Тема по номеру и названию: проверка сверит название с каталогом. */
const mistake = (lang, topicId, title, count) => ({ lang, topicId, title, count })

export const STUDENTS = {
  /** EN A2: путает неправильные глаголы, буксуют слова похода. */
  en_a2_past: {
    words: words(140, 60, [['bought', 5], ['through', 4], ['forest', 3], ['tired', 3]]),
    avgPercent: 64,
    kindTotals: kinds([14, 16], [9, 20], [12, 15]),
    mistakes: [mistake('en', 14, 'Past Simple: неправильные глаголы (went, saw)', 9), mistake('en', 2, 'Артикли a / an и the', 4)],
    activeDays14: 6,
  },

  /** Группа EN B1 из трёх: артикли у всех троих, PP/PS и слова — у двоих. */
  en_b1_group_1: {
    words: words(320, 90, [['although', 4], ['achieve', 3], ['environment', 3]]),
    avgPercent: 71,
    kindTotals: kinds([16, 18], [10, 18], [11, 14]),
    mistakes: [mistake('en', 28, 'Present Perfect или Past Simple?', 6), mistake('en', 2, 'Артикли a / an и the', 5)],
    activeDays14: 9,
  },
  en_b1_group_2: {
    words: words(280, 110, [['although', 3], ['reduce', 4]]),
    avgPercent: 66,
    kindTotals: kinds([12, 16], [8, 16], [9, 12]),
    mistakes: [
      mistake('en', 28, 'Present Perfect или Past Simple?', 4),
      mistake('en', 33, 'Пассивный залог: is made, was built', 3),
      mistake('en', 2, 'Артикли a / an и the', 2),
    ],
    activeDays14: 5,
  },
  en_b1_group_3: {
    words: words(350, 70, [['environment', 2], ['achieve', 5], ['deserve', 2]]),
    avgPercent: 75,
    kindTotals: kinds([15, 16], [11, 17], [10, 12]),
    mistakes: [mistake('en', 2, 'Артикли a / an и the', 7), mistake('en', 36, 'Who, which, that — который', 2)],
    activeDays14: 11,
  },

  /** EN B1 к IELTS: слабая лексика, PP/PS, условные, артикли. */
  en_b1_ielts: {
    words: words(410, 150, [['significant', 4], ['increase', 3], ['however', 3]]),
    avgPercent: 68,
    kindTotals: kinds([18, 20], [11, 20], [9, 16]),
    mistakes: [
      mistake('en', 2, 'Артикли a / an и the', 6),
      mistake('en', 28, 'Present Perfect или Past Simple?', 5),
      mistake('en', 31, 'Условные: If it rains… (Zero и First Conditional)', 3),
    ],
    activeDays14: 8,
  },

  /** EN C1, деловой английский. */
  en_c1_business: {
    words: words(900, 120, [['notwithstanding', 3], ['albeit', 2]]),
    avgPercent: 82,
    kindTotals: kinds([19, 20], [15, 19], [14, 16]),
    mistakes: [
      mistake('en', 41, 'Past Perfect: I had done — прошлое до прошлого', 3),
      mistake('en', 53, 'Had I known… — условные без if', 2),
    ],
    activeDays14: 10,
  },

  /** Новый ученик: данных нет совсем — AI не должен их выдумать. */
  en_new_empty: {
    words: words(0, 0, []),
    avgPercent: null,
    kindTotals: {},
    mistakes: [],
    activeDays14: 0,
  },

  /** ES A1, переезд: путает ser и estar. */
  es_a1_new: {
    words: words(35, 28, [['tengo', 3], ['la leche', 2]]),
    avgPercent: null,
    kindTotals: {},
    mistakes: [mistake('es', 1, 'Глагол SER (быть)', 3), mistake('es', 2, 'Глагол ESTAR (находиться)', 3)],
    activeDays14: 4,
  },

  /** ES B1: путает indefinido и imperfecto, ser и estar. */
  es_b1_imperf: {
    words: words(260, 80, [['solía', 4], ['mientras', 3], ['aunque', 3], ['sin embargo', 2]]),
    avgPercent: 69,
    kindTotals: kinds([13, 15], [7, 15], [10, 12]),
    mistakes: [
      mistake('es', 28, 'Indefinido или Imperfecto', 8),
      mistake('es', 21, 'SER или ESTAR — различия', 4),
    ],
    activeDays14: 7,
  },
}
