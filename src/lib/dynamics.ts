// ============================================================================
// «Динамика за месяц» диагностической карты: сравнение последних 30 дней с
// предыдущими 30 по СУЩЕСТВУЮЩИМ данным (никаких новых таблиц):
//   активные дни  — activity_log.day;
//   средний балл  — попытки работ по submitted_at (текущая + attempts[]);
//   новые ошибки  — grammar_mistakes.created_at (важно: верный ответ удаляет
//                   ошибку, поэтому это «нерешённые новые ошибки» — честная
//                   метрика того, что осталось висеть);
//   слов добавлено — cards.created_at;
//   выучено недавно — слова со статусом «изучено», чей последний повтор попал
//                   в окно (момент, когда FSRS отправил слово в длинный
//                   интервал ≈ момент «выучено»).
// Чистый модуль без клиента БД — гоняется мини-тестом scripts/test-dynamics.mjs.
// ============================================================================

export interface MetricDelta {
  /** Значение за последние 30 дней (null — данных не было вовсе). */
  now: number | null
  /** Значение за предыдущие 30 дней. */
  prev: number | null
}

export interface MonthDynamics {
  activeDays: MetricDelta
  avgScore: MetricDelta
  newMistakes: MetricDelta
  wordsAdded: MetricDelta
  /** Слов стало «выучено» за последние 30 дней (без сравнения — история
   *  статусов не хранится, честнее счётчик, чем выдуманная стрелка). */
  learnedRecently: number
}

export interface DynamicsInput {
  /** Дни с активностью, YYYY-MM-DD (за ~60 дней). */
  activityDays: string[]
  /** Сданные попытки работ: когда и с каким финальным процентом. */
  scoreSamples: { at: string; percent: number }[]
  /** created_at ошибок грамматики (ISO). */
  mistakeDates: string[]
  /** created_at карточек колоды (ISO). */
  cardCreatedDates: string[]
  /** last_review выученных слов (ISO). */
  learnedLastReviews: (string | null)[]
  /** «Сегодня» — для детерминированных тестов. */
  today?: Date
}

const DAY = 86_400_000

/** В какое окно попадает дата: 0 — последние 30 дней, 1 — предыдущие 30. */
function windowOf(iso: string, today: Date): 0 | 1 | null {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const age = today.getTime() - t
  if (age < 0) return 0 // «из будущего» (часовые пояса) — считаем текущим
  if (age < 30 * DAY) return 0
  if (age < 60 * DAY) return 1
  return null
}

function countBy(dates: string[], today: Date): MetricDelta {
  let now = 0
  let prev = 0
  for (const d of dates) {
    const w = windowOf(d, today)
    if (w === 0) now++
    else if (w === 1) prev++
  }
  return { now, prev }
}

export function computeDynamics(input: DynamicsInput): MonthDynamics {
  const today = input.today ?? new Date()

  // дни активности: набор уникальных дней в каждом окне
  const nowDays = new Set<string>()
  const prevDays = new Set<string>()
  for (const day of input.activityDays) {
    // day — YYYY-MM-DD в местном времени; полночь того дня
    const w = windowOf(day + 'T00:00:00', today)
    if (w === 0) nowDays.add(day)
    else if (w === 1) prevDays.add(day)
  }

  // средний процент по попыткам окна; null — попыток в окне не было
  const nowScores: number[] = []
  const prevScores: number[] = []
  for (const s of input.scoreSamples) {
    const w = windowOf(s.at, today)
    if (w === 0) nowScores.push(s.percent)
    else if (w === 1) prevScores.push(s.percent)
  }
  const avg = (xs: number[]) =>
    xs.length === 0 ? null : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

  const learnedRecently = input.learnedLastReviews.filter(
    (d) => d !== null && windowOf(d, today) === 0,
  ).length

  return {
    activeDays: { now: nowDays.size, prev: prevDays.size },
    avgScore: { now: avg(nowScores), prev: avg(prevScores) },
    newMistakes: countBy(input.mistakeDates, today),
    wordsAdded: countBy(input.cardCreatedDates, today),
    learnedRecently,
  }
}
