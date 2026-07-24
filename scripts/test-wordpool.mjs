/**
 * Тест подбора слов для раунда (lib/wordPool pickWords).
 * Жалоба владельца: «в практике почти во всех упражнениях они повторяются».
 * Причина была в том, что раунд набирался из колоды целиком, а паки
 * подмешивались, только если в колоде меньше 24 слов.
 * Запуск: node scripts/test-wordpool.mjs (Node 22+, стрип типов).
 */
import { pickRound } from '../src/lib/pickRound.ts'

// историю показов держим сами — в приложении её подставляет lib/wordPool
let recent = new Set()
const remember = (round) => {
  for (const i of round) recent.add(i.term.toLowerCase())
}
const reset = () => {
  recent = new Set()
}

/** Тот же вызов, что делает wordPool.pickWords (плюс запись истории). */
const pickWords = (pool, n) => {
  const r = pickRound(pool.items.slice(0, pool.fromDeck), pool.items.slice(pool.fromDeck), n, recent)
  remember(r)
  return r
}

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const mkDeck = (n) =>
  Array.from({ length: n }, (_, i) => ({
    term: `deck${i}`,
    translation: `перевод${i}`,
    card: { id: `c${i}` },
    state: null,
  }))
const mkPacks = (n) =>
  Array.from({ length: n }, (_, i) => ({ term: `pack${i}`, translation: `слово${i}`, level: 'B1' }))

const isDeck = (i) => i.term.startsWith('deck')

// --- большая колода: паки обязаны участвовать ---
reset()
const pool = { lang: 'en', items: [...mkDeck(60), ...mkPacks(60)], fromDeck: 60 }
const round = pickWords(pool, 10)
const deckN = round.filter(isDeck).length
check('раунд набран полностью', round.length === 10, `${round.length} слов`)
check(
  'при большой колоде паки всё равно подмешиваются',
  deckN < 10 && deckN > 0,
  `своих ${deckN}, из паков ${10 - deckN}`,
)
check('доля своих слов преобладает (~60%)', deckN >= 5 && deckN <= 7, `своих ${deckN}`)

// --- два раунда подряд не повторяются ---
reset()
const p2 = { lang: 'en', items: [...mkDeck(60), ...mkPacks(60)], fromDeck: 60 }
const r1 = pickWords(p2, 10)
const r2 = pickWords(p2, 10)
const overlap = r2.filter((i) => r1.some((j) => j.term === i.term)).length
check('соседние раунды не пересекаются', overlap === 0, `совпадений ${overlap}`)

// --- нет паков (например, словарь не загрузился) ---
reset()
const p3 = { lang: 'en', items: mkDeck(30), fromDeck: 30 }
const r3 = pickWords(p3, 10)
check('без паков раунд берётся целиком из колоды', r3.length === 10 && r3.every(isDeck))

// --- маленькая колода: раунд всё равно набирается ---
reset()
const p4 = { lang: 'en', items: [...mkDeck(3), ...mkPacks(40)], fromDeck: 3 }
const r4 = pickWords(p4, 10)
check(
  'маленькая колода: раунд полный, свои слова вошли',
  r4.length === 10 && r4.filter(isDeck).length === 3,
  `своих ${r4.filter(isDeck).length}`,
)

// --- пул меньше раунда: не зацикливаемся и не дублируем ---
reset()
const p5 = { lang: 'en', items: [...mkDeck(2), ...mkPacks(3)], fromDeck: 2 }
const r5 = pickWords(p5, 10)
const uniq = new Set(r5.map((i) => i.term)).size
check('крошечный пул: без дублей внутри раунда', uniq === r5.length, `${r5.length} слов, уникальных ${uniq}`)

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} проверок прошло`)
process.exit(failed ? 1 : 0)
