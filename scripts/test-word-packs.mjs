/**
 * Разбиение больших паков на порции (splitTopicWords / splitLargePacks
 * из src/lib/wordPacks.ts).
 *
 * Зачем отдельным файлом. Пак должен помещаться в неделю между уроками, а
 * «База уровня» — это 38 тем ровно по 100 слов, испанская «Базовая лексика A1»
 * — 462. Правило режет их при загрузке, файлы словаря остаются нетронутыми
 * (9512 слов, испанские сверяемы с исходным приложением). Значит цена ошибки
 * здесь — потерянные или задвоенные слова у ВСЕХ учеников сразу, причём молча:
 * на экране пак выглядит нормально в любом случае.
 *
 * Поэтому проверяем не только арифметику частей, но и то, что множество слов
 * после разбиения совпадает с исходным — на выдуманных темах и на настоящих
 * словарях обоих языков.
 *
 * Запуск: node scripts/test-word-packs.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  PACK_MIN_PART,
  PACK_PART_SIZE,
  PACK_SPLIT_OVER,
  splitLargePacks,
  splitTopicWords,
} from '../src/lib/wordPacks.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

/** Тема из n слов: слова различимы, чтобы ловить потерю и перестановку. */
const topicOf = (n, prefix = 'w') =>
  Array.from({ length: n }, (_, i) => ({ front: `${prefix}${i + 1}`, back: `перевод ${i + 1}` }))

const sizes = (parts) => parts.map((p) => p.length)

// ---- размеры частей --------------------------------------------------------
check('константы правила', PACK_PART_SIZE === 20 && PACK_SPLIT_OVER === 30 && PACK_MIN_PART === 8,
  `${PACK_PART_SIZE}/${PACK_SPLIT_OVER}/${PACK_MIN_PART}`)

{
  const p = splitTopicWords(topicOf(100))
  check('тема 100 → 5 частей по 20', p.length === 5 && p.every((x) => x.length === 20), sizes(p).join('+'))
}
{
  const p = splitTopicWords(topicOf(30))
  check('тема 30 не режется', p.length === 1 && p[0].length === 30, sizes(p).join('+'))
}
{
  const p = splitTopicWords(topicOf(25))
  check('тема 25 не режется', p.length === 1 && p[0].length === 25, sizes(p).join('+'))
}
{
  // Хвост 11 ≥ 8 — остаётся отдельной частью.
  const p = splitTopicWords(topicOf(31))
  check('тема 31 → 20 + 11', sizes(p).join('+') === '20+11', sizes(p).join('+'))
}
{
  // Хвост 7 < 8 — приклеивается к предыдущей части.
  const p = splitTopicWords(topicOf(47))
  check('тема 47 → 20 + 27 (хвост приклеен)', sizes(p).join('+') === '20+27', sizes(p).join('+'))
}
{
  const p = splitTopicWords(topicOf(462))
  const last = p[p.length - 1].length
  check('тема 462 → части по 20, хвост не огрызок', p.length === 23 && last === 22, `частей ${p.length}, хвост ${last}`)
}
{
  // Граница ровно на 31: 30 не трогаем, 31 уже режем.
  check('граница правила проходит между 30 и 31',
    splitTopicWords(topicOf(30)).length === 1 && splitTopicWords(topicOf(31)).length === 2)
}
{
  // Каждая часть не длиннее 20 + 7 (склеенный хвост) и не короче 8.
  let sizeOk = true
  let bad = ''
  for (let n = 31; n <= 200; n++) {
    for (const part of splitTopicWords(topicOf(n))) {
      if (part.length < PACK_MIN_PART || part.length > PACK_PART_SIZE + PACK_MIN_PART - 1) {
        sizeOk = false
        bad = `n=${n}: часть ${part.length}`
      }
    }
  }
  check('на всех размерах 31…200 нет ни огрызков, ни переростков', sizeOk, bad)
}

// ---- ни одно слово не потеряно и не задвоено -------------------------------
{
  let lossless = true
  let order = true
  let bad = ''
  for (let n = 1; n <= 300; n++) {
    const words = topicOf(n)
    const parts = splitTopicWords(words)
    const flat = parts.flat()
    if (flat.length !== n) {
      lossless = false
      bad = `n=${n}: слов ${flat.length}`
      break
    }
    if (new Set(flat.map((w) => w.front)).size !== n) {
      lossless = false
      bad = `n=${n}: есть повторы`
      break
    }
    if (flat.some((w, i) => w.front !== words[i].front)) {
      order = false
      bad = `n=${n}: порядок сбит`
      break
    }
  }
  check('на размерах 1…300 сумма частей равна исходной, без повторов', lossless, bad)
  check('порядок слов исходный — склейка частей даёт исходный список', order, bad)
}

// ---- темы целиком: имена, id, уровень --------------------------------------
{
  const topics = [
    { id: 3, name: 'База A2', level: 'A2', icon: '⭐' },
    { id: 7, name: 'Еда', level: 'A1', icon: '🍎' },
  ]
  const wordsByTopic = new Map([
    [3, topicOf(100, 'base')],
    [7, topicOf(12, 'food')],
  ])
  const out = splitLargePacks({ topics, wordsByTopic })

  check('маленькая тема осталась одной', out.topics.filter((t) => t.name.startsWith('Еда')).length === 1)
  check('маленькая тема сохранила имя без номера', out.topics.some((t) => t.name === 'Еда'))

  const parts = out.topics.filter((t) => t.name.startsWith('База A2'))
  check('большая тема развернулась в 5 частей', parts.length === 5, `частей: ${parts.length}`)
  check('название части — «имя · 2/5»', parts[1].name === 'База A2 · 2/5', parts[1].name)
  check('нумерация начинается с 1', parts[0].name === 'База A2 · 1/5', parts[0].name)
  check('уровень унаследован', parts.every((t) => t.level === 'A2'))
  check('иконка унаследована', parts.every((t) => t.icon === '⭐'))
  check('первая часть сохранила исходный id', parts[0].id === 3, String(parts[0].id))

  const ids = out.topics.map((t) => t.id)
  check('id всех тем уникальны', new Set(ids).size === ids.length)
  check('части не заняли id существующей темы', !parts.slice(1).some((t) => t.id === 7))

  const words = out.topics.flatMap((t) => out.wordsByTopic.get(t.id) ?? [])
  check('после разворота слов ровно столько же', words.length === 112, String(words.length))
  check('первая часть — начало исходного списка (частотный порядок)',
    out.wordsByTopic.get(3)[0].front === 'base1' && out.wordsByTopic.get(3)[19].front === 'base20')
  check('вторая часть продолжает с 21-го слова',
    out.wordsByTopic.get(parts[1].id)[0].front === 'base21')

  // Порядок тем в списке: части стоят на месте исходной темы, а не в конце.
  check('части стоят на месте исходной темы', out.topics[0].name === 'База A2 · 1/5' && out.topics[5].name === 'Еда')
}

// ---- пустая тема не ломает правило -----------------------------------------
{
  const out = splitLargePacks({
    topics: [{ id: 1, name: 'Пустая', level: 'A1', icon: '·' }],
    wordsByTopic: new Map(),
  })
  check('тема без слов не разворачивается и не падает',
    out.topics.length === 1 && (out.wordsByTopic.get(1) ?? []).length === 0)
}

// ---- настоящие словари: ни одно слово не потеряно --------------------------
function realPacks(lang) {
  const dir = join(ROOT, 'src/data', lang === 'en' ? 'english' : 'spanish', 'words')
  const topics = []
  const map = new Map()
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    for (const t of data.topics ?? []) topics.push(t)
    for (const w of data.words ?? []) {
      const arr = map.get(w.topic_id) ?? []
      arr.push({ front: lang === 'en' ? w.english : w.spanish, back: w.russian })
      map.set(w.topic_id, arr)
    }
  }
  return { topics, wordsByTopic: map }
}

for (const lang of ['en', 'es']) {
  const before = realPacks(lang)
  // Считаем по УНИКАЛЬНЫМ id: в испанском каталоге «Фразы из диалогов» описаны
  // в двух файлах одной и той же темой, и суммирование по строкам списка
  // насчитало бы их слова дважды.
  const beforeIds = [...new Set(before.topics.map((t) => t.id))]
  const beforeCount = beforeIds.reduce((s, id) => s + (before.wordsByTopic.get(id)?.length ?? 0), 0)
  const after = splitLargePacks(before)
  const afterCount = after.topics.reduce((s, t) => s + (after.wordsByTopic.get(t.id)?.length ?? 0), 0)
  check(`${lang.toUpperCase()}: слов после разбиения столько же`, beforeCount === afterCount,
    `было ${beforeCount}, стало ${afterCount}`)

  const ids = after.topics.map((t) => t.id)
  check(`${lang.toUpperCase()}: id частей ни с чем не столкнулись`, new Set(ids).size === ids.length,
    `тем ${ids.length}, уникальных ${new Set(ids).size}`)

  const tooBig = after.topics.filter((t) => (after.wordsByTopic.get(t.id)?.length ?? 0) > PACK_SPLIT_OVER)
  check(`${lang.toUpperCase()}: не осталось пака больше 30 слов`, tooBig.length === 0,
    tooBig.length ? `${tooBig[0].name}: ${after.wordsByTopic.get(tooBig[0].id).length}` : '')

  const orphans = after.topics.filter((t) => {
    const n = after.wordsByTopic.get(t.id)?.length ?? 0
    return n > 0 && n < PACK_MIN_PART && / · \d+\/\d+$/.test(t.name)
  })
  check(`${lang.toUpperCase()}: нет частей-огрызков`, orphans.length === 0,
    orphans.length ? `${orphans[0].name}: ${after.wordsByTopic.get(orphans[0].id).length}` : '')

  // Одинаковые названия у РАЗНЫХ тем в словарях есть и без нас («Идиомы: Деньги»
  // в EN, «Абстрактные понятия» в ES). Правило не обязано их чинить — но и
  // плодить новые столкновения не должно: каждое совпадение имён после
  // разбиения обязано объясняться совпадением в исходных данных.
  const base = (n) => n.replace(/ · \d+\/\d+$/, '')
  const dupBefore = new Set(
    beforeIds
      .map((id) => before.topics.find((t) => t.id === id).name)
      .filter((n, _i, all) => all.filter((x) => x === n).length > 1),
  )
  const afterNames = after.topics.map((t) => t.name)
  const newDup = afterNames.filter(
    (n, i) => afterNames.indexOf(n) !== i && !dupBefore.has(base(n)),
  )
  check(`${lang.toUpperCase()}: разбиение не создало новых одинаковых названий`,
    newDup.length === 0, newDup[0] ?? '')
  if (dupBefore.size > 0) {
    console.log(`  ${lang.toUpperCase()}: одинаковые имена были и до разбиения — ${[...dupBefore].join(', ')}`)
  }

  const split = after.topics.filter((t) => / · \d+\/\d+$/.test(t.name)).length
  console.log(`  ${lang.toUpperCase()}: тем было ${beforeIds.length}, стало ${after.topics.length} (частей: ${split})`)
}

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exit(fail === 0 ? 0 : 1)
