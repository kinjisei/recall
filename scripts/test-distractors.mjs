/**
 * Мини-тест умных обманок (lib/distractors) и анти-повтора (lib/recentWords):
 *  - обманки предпочитают ту же часть речи/тему/уровень и сравнимую длину;
 *  - правильный ответ не выделяется длиной;
 *  - два раунда подряд не пересекаются, пока пул позволяет.
 * Запуск: node scripts/test-distractors.mjs (Node 22+, стрип типов).
 */
import { pickDistractors, ruPos } from '../src/lib/distractors.ts'

// localStorage-заглушка для recentWords в node
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
const { recordShown, withoutRecent } = await import('../src/lib/recentWords.ts')

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// --- часть речи ---
check('ruPos: глагол', ruPos('шептать') === 'verb' && ruPos('учиться') === 'verb')
check('ruPos: прилагательное', ruPos('храбрый') === 'adj' && ruPos('синяя, голубая') === 'adj')
check('ruPos: наречие', ruPos('медленно') === 'adv')
check('ruPos: существительное', ruPos('урожай') === 'noun' && ruPos('босс') === 'noun')

// --- обманки: часть речи и длина ---
const pool = [
  { term: 'whisper', translation: 'шептать', level: 'B1', topic: 1 },
  { term: 'shout', translation: 'кричать', level: 'B1', topic: 1 },
  { term: 'mumble', translation: 'бормотать', level: 'B1', topic: 1 },
  { term: 'sing', translation: 'петь', level: 'B1', topic: 1 },
  { term: 'boss', translation: 'босс', level: 'B1', topic: 2 },
  { term: 'crocodile', translation: 'крокодил', level: 'A2', topic: 3 },
  { term: 'happiness', translation: 'счастье', level: 'B2', topic: 4 },
  { term: 'brave', translation: 'храбрый', level: 'B1', topic: 5 },
  { term: 'talk', translation: 'разговаривать', level: 'B1', topic: 1 },
]
const correct = pool[0] // whisper / шептать (глагол)
const opts = pickDistractors(correct, pool, 3, (i) => i.translation)
check('обманок ровно 3, без правильного', opts.length === 3 && !opts.includes('шептать'),
  opts.join(', '))
const verbs = opts.filter((o) => ruPos(o) === 'verb').length
check('большинство обманок — глаголы (как ответ)', verbs >= 2, `глаголов: ${verbs} [${opts.join(', ')}]`)
check('«крокодил» не попал в тройку', !opts.includes('крокодил'))

// длина: правильный не крайний с большим отрывом (проверяем много прогонов)
let extremes = 0
for (let i = 0; i < 50; i++) {
  const o = pickDistractors(correct, pool, 3, (x) => x.translation)
  const lens = o.map((s) => s.length)
  const r = 'шептать'.length
  if (r > Math.max(...lens) * 1.35 || r * 1.35 < Math.min(...lens)) extremes++
}
check('правильный ответ не выделяется длиной (50 прогонов)', extremes === 0, `выделился: ${extremes}`)

// --- анти-повтор ---
const bigPool = Array.from({ length: 30 }, (_, i) => ({ term: `word${i}` }))
const r1 = withoutRecent('en', bigPool, 10).slice(0, 10)
recordShown('en', r1.map((i) => i.term))
const r2 = withoutRecent('en', bigPool, 10).slice(0, 10)
const overlap = r2.filter((i) => r1.some((j) => j.term === i.term)).length
check('второй раунд не пересекается с первым', overlap === 0, `пересечений: ${overlap}`)

// маленький пул: история не должна оставить игру без слов
const tiny = Array.from({ length: 8 }, (_, i) => ({ term: `tiny${i}` }))
recordShown('en', tiny.map((i) => i.term))
check('маленький пул не пустеет из-за истории', withoutRecent('en', tiny, 10).length === 8)

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)
