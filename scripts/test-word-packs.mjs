/**
 * Сборка паков: склейка одноимённых тем и разбиение на порции (splitTopicWords / preparePacks
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
  preparePacks,
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
  const out = preparePacks({ topics, wordsByTopic })

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

// ---- одна тема, описанная дважды -------------------------------------------
{
  // Ровно случай испанских «Природы · A2» (14 слов + 26) и «Описания людей · B1»
  // (12 + 30, причём sociable и callado есть в обоих файлах).
  const topics = [
    { id: 63, name: 'Природа', level: 'A2', icon: 'palette' },
    { id: 1041, name: 'Природа', level: 'A2', icon: 'menu_book' },
    { id: 1070, name: 'Природа', level: 'B2', icon: 'menu_book' },
  ]
  const wordsByTopic = new Map([
    [63, [{ front: 'la montaña', back: 'гора' }, { front: 'el valle', back: 'долина' }]],
    [1041, [{ front: 'la Montaña ', back: 'гора' }, { front: 'selva', back: 'джунгли' }]],
    [1070, [{ front: 'corteza', back: 'кора' }]],
  ])
  const out = preparePacks({ topics, wordsByTopic })

  const a2 = out.topics.filter((t) => t.level === 'A2')
  check('одноимённые темы одного уровня склеились в один пак', a2.length === 1, `паков: ${a2.length}`)
  check('разные уровни НЕ склеиваются', out.topics.filter((t) => t.name === 'Природа').length === 2)

  const words = out.wordsByTopic.get(a2[0].id).map((w) => w.front)
  check('слова обоих описаний на месте', words.includes('el valle') && words.includes('selva'), words.join(', '))
  check('повтор снят с точностью до регистра и пробелов', words.length === 3, words.join(', '))
  check('порядок: сперва первое описание, потом второе', words[0] === 'la montaña' && words[2] === 'selva',
    words.join(', '))
  check('склеенный пак сохранил id и иконку первого описания',
    a2[0].id === 63 && a2[0].icon === 'palette')

  // Слияние может перевалить за 30 — тогда работает обычное правило частей.
  const big = preparePacks({
    topics: [
      { id: 1, name: 'Еда', level: 'A1', icon: '·' },
      { id: 2, name: 'Еда', level: 'A1', icon: '·' },
    ],
    wordsByTopic: new Map([
      [1, topicOf(14, 'a')],
      [2, topicOf(26, 'b')],
    ]),
  })
  check('склейка 14 + 26 даёт 40 слов и две части по 20',
    big.topics.length === 2 &&
      big.topics[0].name === 'Еда · 1/2' &&
      big.wordsByTopic.get(big.topics[0].id).length === 20 &&
      big.wordsByTopic.get(big.topics[1].id).length === 20,
    big.topics.map((t) => `${t.name}:${big.wordsByTopic.get(t.id).length}`).join(', '))
}

// ---- пустая тема не ломает правило -----------------------------------------
{
  const out = preparePacks({
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

const packKeyOf = (t) => `${t.name.trim().toLowerCase()}|${t.level}`
const wordKeyOf = (w) => w.front.trim().toLowerCase()

/** Слова каждого пака (имя+уровень) в виде множества — исходные данные. */
function expectedPacks({ topics, wordsByTopic }) {
  const packs = new Map()
  const takenIds = new Map()
  for (const t of topics) {
    const key = packKeyOf(t)
    const ids = takenIds.get(key) ?? new Set()
    if (ids.has(t.id)) continue // одна тема описана дважды под одним id
    ids.add(t.id)
    takenIds.set(key, ids)
    const set = packs.get(key) ?? new Set()
    for (const w of wordsByTopic.get(t.id) ?? []) set.add(wordKeyOf(w))
    packs.set(key, set)
  }
  return packs
}

for (const lang of ['en', 'es']) {
  const L = lang.toUpperCase()
  const before = realPacks(lang)
  const after = preparePacks(before)
  const expected = expectedPacks(before)

  // Главная проверка: в каждом паке ровно те слова, что были в исходных данных.
  // Не «столько же слов», а «те же»: склейка одноимённых тем и снятие повторов
  // меняют счёт (в ES sociable и callado лежали в обоих описаниях «Описание
  // людей»), но потерять или подменить слово не имеют права.
  const actual = new Map()
  for (const t of after.topics) {
    const key = packKeyOf({ ...t, name: t.name.replace(/ · \d+\/\d+$/, '') })
    const set = actual.get(key) ?? new Set()
    for (const w of after.wordsByTopic.get(t.id) ?? []) set.add(wordKeyOf(w))
    actual.set(key, set)
  }
  let sameSets = true
  let diff = ''
  for (const [key, want] of expected) {
    const got = actual.get(key)
    if (!got) {
      sameSets = false
      diff = `пак пропал: ${key}`
      break
    }
    const missing = [...want].filter((w) => !got.has(w))
    const extra = [...got].filter((w) => !want.has(w))
    if (missing.length || extra.length) {
      sameSets = false
      diff = `${key}: нет ${missing.slice(0, 3).join(', ') || '—'}; лишние ${extra.slice(0, 3).join(', ') || '—'}`
      break
    }
  }
  check(`${L}: в каждом паке ровно те же слова, что в словаре`, sameSets, diff)
  check(`${L}: паков ровно столько, сколько тем в словаре`, actual.size === expected.size,
    `ожидали ${expected.size}, вышло ${actual.size}`)

  // Внутри пака слово встречается один раз: повтор дал бы ученику две
  // одинаковые карточки в колоде.
  //
  // ⚠️ Считаем по паку ЦЕЛИКОМ, а не по строке списка. Повторы «Описания людей»
  // (sociable, callado) расходятся по разным частям — проверка внутри одной
  // части их не видит и остаётся зелёной, даже если снятие повторов сломано.
  const packWords = new Map()
  for (const t of after.topics) {
    const key = packKeyOf({ ...t, name: t.name.replace(/ · \d+\/\d+$/, '') })
    const list = packWords.get(key) ?? []
    list.push(...(after.wordsByTopic.get(t.id) ?? []).map(wordKeyOf))
    packWords.set(key, list)
  }
  const dupPack = [...packWords].find(([, ws]) => new Set(ws).size !== ws.length)
  check(`${L}: внутри пака нет повторяющихся слов`, dupPack === undefined,
    dupPack ? `${dupPack[0]}: ${dupPack[1].filter((w, i) => dupPack[1].indexOf(w) !== i).slice(0, 3).join(', ')}` : '')

  const beforeIds = [...new Set(before.topics.map((t) => t.id))]
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

  // Двух одинаковых строк в списке быть не должно: человек выбирал бы между
  // ними наугад. Одинаковое имя на РАЗНЫХ уровнях — это разные паки, они лежат
  // под разными заголовками и не путаются.
  const rows = after.topics.map((t) => `${t.name}|${t.level}`)
  const twin = rows.find((r, i) => rows.indexOf(r) !== i)
  check(`${L}: в списке нет двух одинаковых паков`, twin === undefined, twin ?? '')

  const split = after.topics.filter((t) => / · \d+\/\d+$/.test(t.name)).length
  const words = after.topics.reduce((s, t) => s + (after.wordsByTopic.get(t.id)?.length ?? 0), 0)
  console.log(`  ${L}: тем ${beforeIds.length} → паков ${expected.size}, строк ${after.topics.length} (частей: ${split}), слов ${words}`)
}

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exit(fail === 0 ? 0 : 1)
