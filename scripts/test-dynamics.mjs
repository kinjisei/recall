/**
 * Мини-тест «Динамики за месяц» (src/lib/dynamics.ts): окна «последние 30 дней»
 * vs «предыдущие 30», средние проценты, границы окон.
 * Запуск: node scripts/test-dynamics.mjs (Node 22+, стрип типов).
 */
import { computeDynamics } from '../src/lib/dynamics.ts'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const today = new Date('2026-07-23T12:00:00')
const daysAgo = (n) => new Date(today.getTime() - n * 86_400_000).toISOString()
const dayStr = (n) => daysAgo(n).slice(0, 10)

const d = computeDynamics({
  today,
  // 3 активных дня в текущем окне, 5 — в прошлом, 1 — за пределами 60 дней
  activityDays: [dayStr(1), dayStr(5), dayStr(10), dayStr(35), dayStr(40), dayStr(45), dayStr(50), dayStr(55), dayStr(70)],
  // текущее окно: 80 и 90 (среднее 85); прошлое: 60 (среднее 60)
  scoreSamples: [
    { at: daysAgo(2), percent: 80 },
    { at: daysAgo(20), percent: 90 },
    { at: daysAgo(40), percent: 60 },
    { at: daysAgo(65), percent: 10 }, // вне окон — игнор
  ],
  // ошибки: 2 новых, 3 старых
  mistakeDates: [daysAgo(3), daysAgo(15), daysAgo(31), daysAgo(45), daysAgo(59)],
  // слова: 4 добавлено сейчас, 1 — в прошлом окне
  cardCreatedDates: [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(29), daysAgo(33)],
  // выучено недавно: 2 из 3 (одно выучено давно, null игнорируется)
  learnedLastReviews: [daysAgo(4), daysAgo(25), daysAgo(50), null],
})

check('активные дни: 3 vs 5', d.activeDays.now === 3 && d.activeDays.prev === 5,
  JSON.stringify(d.activeDays))
check('средний балл: 85 vs 60', d.avgScore.now === 85 && d.avgScore.prev === 60,
  JSON.stringify(d.avgScore))
check('новые ошибки: 2 vs 3', d.newMistakes.now === 2 && d.newMistakes.prev === 3)
check('слов добавлено: 4 vs 1', d.wordsAdded.now === 4 && d.wordsAdded.prev === 1)
check('выучено недавно: 2', d.learnedRecently === 2, `=${d.learnedRecently}`)

// пусто → нули и null у среднего
const empty = computeDynamics({
  today, activityDays: [], scoreSamples: [], mistakeDates: [],
  cardCreatedDates: [], learnedLastReviews: [],
})
check('пустые данные: балл null, счётчики 0',
  empty.avgScore.now === null && empty.avgScore.prev === null &&
  empty.activeDays.now === 0 && empty.wordsAdded.prev === 0)

// граница ровно 30 дней назад → прошлое окно; 29.9 — текущее
const edge = computeDynamics({
  today, activityDays: [], mistakeDates: [], cardCreatedDates: [], learnedLastReviews: [],
  scoreSamples: [
    { at: daysAgo(30), percent: 40 },
    { at: daysAgo(29.9), percent: 100 },
  ],
})
check('граница окна 30 дней', edge.avgScore.now === 100 && edge.avgScore.prev === 40,
  JSON.stringify(edge.avgScore))

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
