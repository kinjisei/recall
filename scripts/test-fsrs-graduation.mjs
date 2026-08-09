/**
 * Симуляция: за сколько дней слово доходит до статуса «изучено» и что с ним
 * делает ошибка в мини-игре. Считает НАСТОЯЩИМ движком ts-fsrs с теми же
 * параметрами, что в lib/fsrs.ts.
 *
 * «Изучено» (lib/wordChecks.ts statusOf): state === 'review' и интервал ≥ 21 дня.
 * Запуск: node scripts/test-fsrs-graduation.mjs
 */
import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs'

// enable_fuzz как в проде выключаем: он рандомизирует интервалы и мешает читать
const scheduler = fsrs(generatorParameters({ enable_fuzz: false }))

const DAY = 86400000
const stateName = (s) =>
  s === State.New ? 'new' : s === State.Learning ? 'learning' : s === State.Review ? 'review' : 'relearning'

/** Интервал в днях так же, как его считает statusOf. */
const intervalDays = (card) =>
  Math.max(0, Math.round((card.due.getTime() - (card.last_review?.getTime() ?? Date.now())) / DAY))

const isLearned = (card) => stateName(card.state) === 'review' && intervalDays(card) >= 21

/**
 * Прогон по дням. Раз в день пользователь заходит и повторяет ВСЕ карточки,
 * что уже подошли (due <= сейчас) — как в реальном «Повторении».
 * gameMistakeEvery: раз в сколько дней слово попадается в игре и на нём
 * ошибаются (0 — ошибок нет).
 */
function simulate({ days = 60, gameMistakeEvery = 0, mistakeGrade = Rating.Again, label }) {
  let card = createEmptyCard(new Date(Date.UTC(2026, 0, 1, 9, 0)))
  let learnedOn = null
  let reviews = 0
  let mistakes = 0

  for (let d = 0; d < days; d++) {
    // утреннее занятие: повторяем, пока карточка подошла (учитываем шаги обучения)
    let now = new Date(Date.UTC(2026, 0, 1 + d, 9, 0))
    let guard = 0
    while (card.due <= now && guard++ < 10) {
      card = scheduler.next(card, now, Rating.Good).card
      reviews++
      // внутри одного занятия шаг «через 10 минут» проходится тут же
      now = new Date(now.getTime() + 11 * 60000)
    }

    // вечером — мини-игра, слово попалось и на нём ошиблись
    if (gameMistakeEvery && d > 0 && d % gameMistakeEvery === 0) {
      const evening = new Date(Date.UTC(2026, 0, 1 + d, 20, 0))
      card = scheduler.next(card, evening, mistakeGrade).card
      mistakes++
    }

    if (!learnedOn && isLearned(card)) learnedOn = d
  }

  console.log(
    `${label}\n  итог: ${stateName(card.state)}, интервал ${intervalDays(card)} дн., ` +
      `повторов ${reviews}, ошибок в играх ${mistakes}\n  «изучено» на день: ` +
      (learnedOn === null ? 'НЕ ДОСТИГНУТО за ' + days + ' дней' : learnedOn),
  )
  return { learnedOn, card }
}

console.log('=== Сколько живёт слово при разных сценариях (60 дней) ===\n')

simulate({ label: '1. Идеально: каждый день повторяю, в играх не ошибаюсь' })
console.log()
simulate({ gameMistakeEvery: 7, label: '2. Ошибка в игре раз в неделю' })
console.log()
simulate({ gameMistakeEvery: 3, label: '3. Ошибка в игре раз в 3 дня' })
console.log()
simulate({ gameMistakeEvery: 1, label: '4. Ошибка в игре КАЖДЫЙ день (слово всё время в играх)' })

console.log('\n=== То же самое, но ошибка в игре = «сложно» вместо «не знаю» ===\n')
simulate({ gameMistakeEvery: 7, mistakeGrade: Rating.Hard, label: '5. «Сложно», ошибка раз в неделю' })
console.log()
simulate({ gameMistakeEvery: 3, mistakeGrade: Rating.Hard, label: '6. «Сложно», ошибка раз в 3 дня' })
console.log()
simulate({ gameMistakeEvery: 1, mistakeGrade: Rating.Hard, label: '7. «Сложно», ошибка каждый день' })

// --- НОВОЕ ПРАВИЛО целиком: «сложно», но 3 промаха за неделю → «не знаю» ---
console.log('\n=== Правило, которое внедрено (эскалация после 3 промахов за 7 дней) ===\n')
function simulateRule({ days = 60, gameMistakeEvery, label }) {
  let card = createEmptyCard(new Date(Date.UTC(2026, 0, 1, 9, 0)))
  let learnedOn = null
  let misses = []
  let hard = 0
  let again = 0

  for (let d = 0; d < days; d++) {
    let now = new Date(Date.UTC(2026, 0, 1 + d, 9, 0))
    let guard = 0
    while (card.due <= now && guard++ < 10) {
      card = scheduler.next(card, now, Rating.Good).card
      misses = [] // вспомнил на повторении — счётчик промахов обнуляется
      now = new Date(now.getTime() + 11 * 60000)
    }
    if (gameMistakeEvery && d > 0 && d % gameMistakeEvery === 0) {
      const evening = Date.UTC(2026, 0, 1 + d, 20, 0)
      misses = misses.filter((t) => evening - t < 7 * DAY)
      misses.push(evening)
      const serious = misses.length >= 3
      if (serious) again++
      else hard++
      card = scheduler.next(card, new Date(evening), serious ? Rating.Again : Rating.Hard).card
    }
    if (!learnedOn && isLearned(card)) learnedOn = d
  }
  console.log(
    `${label}\n  итог: ${stateName(card.state)}, интервал ${intervalDays(card)} дн. ` +
      `(«сложно» ${hard}, «не знаю» ${again})\n  «изучено» на день: ` +
      (learnedOn === null ? 'НЕ ДОСТИГНУТО' : learnedOn),
  )
}
simulateRule({ gameMistakeEvery: 7, label: '8. Промах раз в неделю (случайность)' })
console.log()
simulateRule({ gameMistakeEvery: 1, label: '9. Промах каждый день (слово реально не знаю)' })

// --- отдельно: что делает ОДНА ошибка со зрелым словом ---
console.log('\n=== Цена одной ошибки в игре для зрелого слова ===')
let c = createEmptyCard(new Date(Date.UTC(2026, 0, 1, 9, 0)))
for (let d = 0; d < 40; d++) {
  let now = new Date(Date.UTC(2026, 0, 1 + d, 9, 0))
  let guard = 0
  while (c.due <= now && guard++ < 10) {
    c = scheduler.next(c, now, Rating.Good).card
    now = new Date(now.getTime() + 11 * 60000)
  }
}
const before = intervalDays(c)
const beforeState = stateName(c.state)
c = scheduler.next(c, new Date(Date.UTC(2026, 1, 10, 20, 0)), Rating.Again).card
console.log(
  `  было: ${beforeState}, интервал ${before} дн.\n` +
    `  стало после одной ошибки: ${stateName(c.state)}, интервал ${intervalDays(c)} дн., lapses ${c.lapses}`,
)

// ---------------------------------------------------------------------------
// ПРОВЕРКИ. До 09.08 этот файл был чистой демонстрацией: печатал числа и всегда
// возвращал успех. В наборе автопроверок такое хуже отсутствия — вечно зелёная
// строка создаёт ощущение, что ядро повторений под присмотром, хотя его никто
// не сторожит. Утверждения ниже сторожат ровно то, на чём стоит продукт:
// слово доходит до «изучено» за разумный срок, а ошибка возвращает его в работу.
// Они поймают смену параметров FSRS и обновление библиотеки.
// ---------------------------------------------------------------------------
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

console.log('\n=== Проверки ===')

// 1. Честное ежедневное повторение доводит слово до «изучено» за месяц-полтора.
let good = createEmptyCard(new Date(Date.UTC(2026, 0, 1, 9, 0)))
let learnedDay = null
for (let d = 0; d < 60 && learnedDay === null; d++) {
  let now = new Date(Date.UTC(2026, 0, 1 + d, 9, 0))
  let guard = 0
  while (good.due <= now && guard++ < 10) {
    good = scheduler.next(good, now, Rating.Good).card
    now = new Date(now.getTime() + 11 * 60000)
  }
  if (isLearned(good)) learnedDay = d
}
check(
  'слово доходит до «изучено» за 60 дней честных повторений',
  learnedDay !== null && learnedDay <= 60,
  learnedDay === null ? 'не дошло' : `на день ${learnedDay}`,
)

// 2. Одна ошибка по зрелому слову возвращает его в работу: состояние
//    relearning, срок обнуляется, счётчик срывов растёт. На этом стоит связь
//    «ошибся в игре → слово вернётся на повтор».
let mature = createEmptyCard(new Date(Date.UTC(2026, 0, 1, 9, 0)))
for (let d = 0; d < 40; d++) {
  let now = new Date(Date.UTC(2026, 0, 1 + d, 9, 0))
  let guard = 0
  while (mature.due <= now && guard++ < 10) {
    mature = scheduler.next(mature, now, Rating.Good).card
    now = new Date(now.getTime() + 11 * 60000)
  }
}
const lapsesBefore = mature.lapses
const after = scheduler.next(mature, new Date(Date.UTC(2026, 1, 10, 20, 0)), Rating.Again).card
check('ошибка переводит зрелое слово в relearning', stateName(after.state) === 'relearning', stateName(after.state))
check('ошибка обнуляет интервал', intervalDays(after) === 0, `${intervalDays(after)} дн.`)
check('ошибка увеличивает счётчик срывов', after.lapses === lapsesBefore + 1, `${lapsesBefore} → ${after.lapses}`)
check('после ошибки слово больше не «изучено»', !isLearned(after))

const okCount = results.filter(Boolean).length
console.log(`
Итог: ${okCount}/${results.length}`)
process.exitCode = okCount === results.length ? 0 : 1
