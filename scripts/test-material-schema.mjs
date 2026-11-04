/**
 * Чистый тест: схема ответа модели у материала = то, что разбирает код
 * (PLAN.md Ф2.20-3, src/domains/materials/schema.ts). План, текст с
 * упражнениями, «Мой текст» и замена шлют схему, как письмо; разошлись схема
 * и разбор — модель послушно построит ответ, который приложение выбросит.
 *
 * Держит:
 *   1. в схемах только слова, которые Google принимает (лишнее — 400, а 400
 *      обрывает цепочку моделей), все поля обязательны, тип — одна строка
 *      (без null), схема не больше SCHEMA_MAX — сервер передаёт её модели
 *      как есть (больше — молча режим JSON без схемы);
 *   2. ответ по схеме проходит разбор: каждый вид упражнения — фильтр
 *      приложения и вид тот же; план — readPlan и проверку сервера
 *      (isPlanShaped); текст — readContent; «Мой текст» — readOwnText;
 *      замена — readSwap и проверку сервера (isExerciseShaped);
 *   3. ответ без обязательного поля краснеет: схема его не пускает, а без
 *      поля, нужного разбору, разбор отказывает (схема обязана требовать
 *      всё, что требует разбор);
 *   4. каждый ответ подходит ровно одному виду схемы (иначе anyOf пустит
 *      упражнение «не того вида»); у A1–A2 «Not given» схема не пускает —
 *      и разбор выбросил бы;
 *   5. пределы схемы — пределы разбора и сервера: на пределе проходит, за
 *      ним сервер или фильтр отказывает;
 *   6. поля схемы — те же, что в образце ответа в промпте (`exerciseSpec`,
 *      план, текст, «Мой текст», замена);
 *   7. вызовы материала (и замер замены `check-ai-swap`) шлют схему,
 *      сервер кладёт её в responseJsonSchema.
 * Без сети, базы и ключей. Запуск: node scripts/test-material-schema.mjs
 */
// клиентский код (промпты, каталог) — импорты без расширения: загрузчик проверок AI их понимает
import './ai-quality/loader.mjs'
import { readFileSync } from 'node:fs'

const S = await import('../src/domains/materials/schema.ts')
const { readContent, readOwnText, readPlan, MIN_EXERCISES } = await import('../src/domains/materials/read.ts')
const { readSwap } = await import('../src/domains/materials/swap.ts')
const { FORMATS, MAX_ROWS, formatOf } = await import('../src/lib/exerciseFormats.ts')
const { MATCH_PAIRS, MATCH_EXTRA_MAX } = await import('../src/lib/materialExercises.ts')
const P = await import('../src/lib/materialPrompts.ts')
const { isPlanShaped } = await import('../api/_planShape.ts')
const { isExerciseShaped } = await import('../api/_exerciseShape.ts')
const { SCHEMA_MAX, jsonMode } = await import('../api/_jsonMode.ts')
const { geminiBody } = await import('../api/_geminiBody.ts')

let pass = 0
let fail = 0
const check = (name, ok, got) => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || got === undefined ? '' : ` — ${typeof got === 'string' ? got : JSON.stringify(got)}`}`)
}
const ROOT = new URL('../', import.meta.url)
const src = (p) => readFileSync(new URL(p, ROOT), 'utf8')

// ---------------------------------------------------------------------------
// Строгая сверка значения со схемой: так строит ответ модель — только поля
// схемы, обязательные все. Ошибки — список строк (пусто — подходит).
// ---------------------------------------------------------------------------
function validate(schema, v, path = '$') {
  if (schema.anyOf) {
    const fits = schema.anyOf.filter((s) => validate(s, v, path).length === 0)
    return fits.length ? [] : [`${path}: не подходит ни одному варианту anyOf`]
  }
  const errs = []
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${path}: ${JSON.stringify(v)} не из ${JSON.stringify(schema.enum)}`)
  switch (schema.type) {
    case 'string':
      if (typeof v !== 'string') errs.push(`${path}: не строка`)
      break
    case 'boolean':
      if (typeof v !== 'boolean') errs.push(`${path}: не да/нет`)
      break
    case 'integer':
      if (!Number.isInteger(v)) errs.push(`${path}: не целое`)
      else {
        if (schema.minimum !== undefined && v < schema.minimum) errs.push(`${path}: меньше ${schema.minimum}`)
        if (schema.maximum !== undefined && v > schema.maximum) errs.push(`${path}: больше ${schema.maximum}`)
      }
      break
    case 'array':
      if (!Array.isArray(v)) {
        errs.push(`${path}: не список`)
        break
      }
      if (schema.minItems !== undefined && v.length < schema.minItems) errs.push(`${path}: меньше ${schema.minItems}`)
      if (schema.maxItems !== undefined && v.length > schema.maxItems) errs.push(`${path}: больше ${schema.maxItems}`)
      v.forEach((x, i) => errs.push(...validate(schema.items, x, `${path}[${i}]`)))
      break
    case 'object': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) {
        errs.push(`${path}: не объект`)
        break
      }
      for (const k of schema.required ?? []) if (!(k in v)) errs.push(`${path}.${k}: нет обязательного поля`)
      for (const k of Object.keys(v)) {
        if (!(k in schema.properties)) errs.push(`${path}.${k}: поля нет в схеме`)
        else errs.push(...validate(schema.properties[k], v[k], `${path}.${k}`))
      }
      break
    }
    default:
      errs.push(`${path}: неизвестный тип ${schema.type}`)
  }
  return errs
}
const fits = (schema, v) => validate(schema, v).length === 0

// сверка умеет краснеть: лишнее поле, нет поля, не тот тип, не тот вариант
{
  const o = { type: 'object', properties: { a: { type: 'string' }, n: { type: 'integer', minimum: 0, maximum: 3 } }, required: ['a', 'n'] }
  const bad = [{ a: 'x' }, { a: 'x', n: 1, z: 1 }, { a: 1, n: 1 }, { a: 'x', n: 4 }, { a: 'x', n: 1.5 }]
  check('сверка со схемой: годное проходит, лишнее поле / нет поля / не тот тип / за пределом — нет', fits(o, { a: 'x', n: 3 }) && bad.every((b) => !fits(o, b)))
  const any = { anyOf: [{ type: 'string', enum: ['a'] }, { type: 'integer', minimum: 0, maximum: 1 }] }
  check('сверка со схемой: anyOf — подходит хоть одному', fits(any, 'a') && fits(any, 1) && !fits(any, 'b') && !fits(any, 2))
}

// ---------------------------------------------------------------------------
// 1. Форма самих схем
// ---------------------------------------------------------------------------
/** Слова JSON Schema, которые Google принимает в responseJsonSchema и которые нам нужны. */
const ALLOWED = new Set(['type', 'properties', 'required', 'items', 'enum', 'minimum', 'maximum', 'minItems', 'maxItems', 'anyOf'])
const TYPES = new Set(['string', 'integer', 'boolean', 'array', 'object'])

function shapeProblems(schema, path = '$') {
  const out = []
  for (const k of Object.keys(schema)) if (!ALLOWED.has(k)) out.push(`${path}: слово «${k}»`)
  if (schema.anyOf) {
    if (Object.keys(schema).length !== 1) out.push(`${path}: у anyOf соседи`)
    schema.anyOf.forEach((s, i) => out.push(...shapeProblems(s, `${path}|${i}`)))
    return out
  }
  if (!TYPES.has(schema.type)) out.push(`${path}: тип ${JSON.stringify(schema.type)}`)
  if (schema.enum && (!schema.enum.length || !schema.enum.every((e) => typeof e === 'string'))) out.push(`${path}: enum`)
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties ?? {})
    if (!keys.length) out.push(`${path}: объект без полей`)
    if (JSON.stringify([...(schema.required ?? [])].sort()) !== JSON.stringify([...keys].sort())) out.push(`${path}: обязательны не все поля`)
    for (const k of keys) out.push(...shapeProblems(schema.properties[k], `${path}.${k}`))
  }
  if (schema.type === 'array') {
    if (!schema.items) out.push(`${path}: список без items`)
    else out.push(...shapeProblems(schema.items, `${path}[]`))
    if (schema.minItems !== undefined && schema.maxItems !== undefined && schema.minItems > schema.maxItems) out.push(`${path}: minItems > maxItems`)
  }
  return out
}

const ALL_ROWS = FORMATS.map((f) => ({ format: f.id, kind: f.kind, type: f.type, count: f.def, note: '' }))
const SOME_ROWS = ALL_ROWS.filter((r) => ['mcq', 'tfng', 'match_translation', 'fill_form'].includes(r.format))
const schemas = [['план', S.planSchema()]]
for (const lang of ['en', 'es'])
  for (const level of ['A2', 'B1', 'C1']) {
    schemas.push([`текст ${lang} ${level}, все виды`, S.contentSchema(lang, level, ALL_ROWS)])
    schemas.push([`текст ${lang} ${level}, 4 вида`, S.contentSchema(lang, level, SOME_ROWS)])
    schemas.push([`«Мой текст» ${lang} ${level} без выбора`, S.ownTextSchema(lang, level)])
    schemas.push([`«Мой текст» ${lang} ${level}, 4 вида`, S.ownTextSchema(lang, level, SOME_ROWS)])
    for (const f of FORMATS) schemas.push([`замена ${f.id} ${lang} ${level}`, S.swapSchema(lang, level, f.id)])
  }
const shapeBad = schemas.flatMap(([name, s]) => shapeProblems(s).map((p) => `${name}: ${p}`))
check(`схемы (${schemas.length}): только принятые слова, все поля обязательны, без null`, shapeBad.length === 0, shapeBad.slice(0, 5).join(' | '))
const biggest = schemas.reduce((m, [name, s]) => (JSON.stringify(s).length > m.size ? { name, size: JSON.stringify(s).length } : m), { size: 0 })
check(`самая большая схема (${biggest.name}, ${biggest.size} зн.) не больше ${SCHEMA_MAX} — сервер передаёт её как есть`, schemas.every(([, s]) => jsonMode(s) === s), biggest)
const body = (s) => JSON.parse(geminiBody('gemini-3.6-flash', 'sys', [{ role: 'user', parts: [{ text: 'hi' }] }], 'max', jsonMode(s))).generationConfig
check('схема материала доходит до модели как responseJsonSchema', JSON.stringify(body(S.contentSchema('en', 'B1', ALL_ROWS)).responseJsonSchema) === JSON.stringify(S.contentSchema('en', 'B1', ALL_ROWS)))
check('виды в плане — ровно каталог', JSON.stringify(S.planSchema().properties.exercise_plan.items.properties.format.enum) === JSON.stringify(FORMATS.map((f) => f.id)))
check('текст по плану из 4 видов — только эти 4 вида', S.contentSchema('en', 'B1', SOME_ROWS).properties.exercises.items.anyOf?.length === 4)
check('«Мой текст» без выбора — все виды каталога', S.ownTextSchema('en', 'B1').properties.exercises.items.anyOf?.length === FORMATS.length)
check(`упражнений — не меньше ${MIN_EXERCISES}, как в разборе; у замены — ровно одно`, S.contentSchema('en', 'B1', SOME_ROWS).properties.exercises.minItems === MIN_EXERCISES && S.ownTextSchema('en', 'B1').properties.exercises.minItems === MIN_EXERCISES && S.swapSchema('en', 'B1', 'mcq').properties.exercises.minItems === 1 && S.swapSchema('en', 'B1', 'mcq').properties.exercises.maxItems === 1)

// ---------------------------------------------------------------------------
// Ответы «как от модели»: текст и по одному упражнению каждого вида
// ---------------------------------------------------------------------------
const BODY =
  'Last summer Anna missed her flight to Rome. She was late because the train stopped for an hour. ' +
  'At the airport she bought a new ticket and waited at the gate. The delay was long, but she read a book and felt calm. ' +
  'In the evening she finally arrived in Rome and took a taxi to the hotel.'
const EX = {
  mcq: { kind: 'comprehension', type: 'mcq', prompt: 'Why was Anna late?', options: ['The train stopped', 'She overslept', 'The taxi was late', 'She lost her ticket'], answer: 0 },
  tfng: {
    kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Anna took a bus to the hotel.', options: ['True', 'False', 'Not given'], answer: 1,
    quote: 'In the evening she finally arrived in Rome and took a taxi to the hotel.', mark: 'took a taxi', why: 'Она поехала на такси, а не на автобусе.',
  },
  form: { kind: 'grammar', type: 'mcq', format: 'form', prompt: 'At the airport she ___ a new ticket.', options: ['buy', 'bought', 'buys'], answer: 1 },
  fill_form: { kind: 'grammar', type: 'fill', prompt: 'She ___ at the gate.', answer: 'waited', hint: 'прошедшее время от wait' },
  order: { kind: 'grammar', type: 'order', prompt: 'Она прочитала книгу.', words: ['a', 'she', 'book', 'read'], answer: ['she', 'read', 'a', 'book'] },
  match_translation: {
    kind: 'vocab', type: 'match', format: 'translation', prompt: 'Соедини слово и перевод',
    pairs: [{ left: 'flight', right: 'рейс' }, { left: 'delay', right: 'задержка' }, { left: 'gate', right: 'выход на посадку' }], extra: ['багаж'],
  },
  match_definition: {
    kind: 'vocab', type: 'match', format: 'definition', prompt: 'Соедини слово и объяснение',
    pairs: [{ left: 'ticket', right: 'a paper that lets you travel' }, { left: 'calm', right: 'not worried or angry' }, { left: 'hotel', right: 'a place where you pay to sleep' }],
    extra: ['a person who flies a plane'],
  },
  fill_word: { kind: 'vocab', type: 'fill', prompt: 'She waited at the ___.', answer: 'gate' },
  word_by_definition: { kind: 'vocab', type: 'mcq', prompt: 'When something happens later than planned.', options: ['delay', 'gate', 'ticket', 'taxi'], answer: 0 },
}
const IDS = FORMATS.map((f) => f.id)
check('образец ответа есть у каждого вида каталога', IDS.every((id) => EX[id]) && Object.keys(EX).length === IDS.length)
const ctx = { lang: 'en', level: 'B1' }
const without = (o, k) => Object.fromEntries(Object.entries(o).filter(([x]) => x !== k))
const swapOf = (ex, format, level = 'B1', lang = 'en') => readSwap(JSON.stringify({ exercises: [ex] }), { body: BODY, lang, level, format, others: [] })

// ---------------------------------------------------------------------------
// 2, 4, 5. Упражнения: по схеме — проходит разбор; ровно один вид
// ---------------------------------------------------------------------------
for (const id of IDS) {
  const ex = EX[id]
  const own = S.exerciseSchema(id, 'en', 'B1')
  check(`${id}: ответ подходит схеме своего вида`, fits(own, ex), validate(own, ex))
  const others = IDS.filter((o) => o !== id && fits(S.exerciseSchema(o, 'en', 'B1'), ex))
  check(`${id}: и не подходит схеме другого вида`, others.length === 0, others.join(', '))
  const raw = JSON.stringify({ exercises: [ex] })
  check(`${id}: замена по схеме — подходит swapSchema`, fits(S.swapSchema('en', 'B1', id), JSON.parse(raw)), validate(S.swapSchema('en', 'B1', id), JSON.parse(raw)))
  check(`${id}: замена по схеме — сервер пускает (isExerciseShaped)`, isExerciseShaped(raw, id))
  const r = swapOf(ex, id)
  check(`${id}: замена по схеме — readSwap берёт, вид тот же`, r.ok && formatOf(r.exercise) === id, r)
}

{
  const all = { title: 'A Long Day', body: BODY, exercises: IDS.map((id) => EX[id]) }
  check('текст по схеме (все виды) — подходит схеме', fits(S.contentSchema('en', 'B1', ALL_ROWS), all), validate(S.contentSchema('en', 'B1', ALL_ROWS), all))
  let got
  try {
    got = readContent(JSON.stringify(all), ctx)
  } catch (e) {
    got = e.message
  }
  check('текст по схеме — readContent берёт все упражнения, виды те же', got?.exercises?.length === IDS.length && got.exercises.every((e, i) => formatOf(e) === IDS[i]) && got.title === all.title && got.body === BODY, got)
  const some = { title: 'A Long Day', body: BODY, exercises: [EX.mcq, EX.tfng, EX.match_translation, EX.fill_form] }
  check('текст по плану из 4 видов — подходит; упражнение не из плана — нет', fits(S.contentSchema('en', 'B1', SOME_ROWS), some) && !fits(S.contentSchema('en', 'B1', SOME_ROWS), { ...some, exercises: [...some.exercises, EX.order] }))
  const own = { title: 'A Long Day', exercises: [EX.mcq, EX.tfng, EX.order, EX.fill_word] }
  check('«Мой текст» по схеме — подходит схеме', fits(S.ownTextSchema('en', 'B1'), own), validate(S.ownTextSchema('en', 'B1'), own))
  try {
    got = readOwnText(JSON.stringify(own), { ...ctx, body: BODY })
  } catch (e) {
    got = e.message
  }
  check('«Мой текст» по схеме — readOwnText берёт все упражнения', got?.exercises?.length === 4 && got.title === 'A Long Day', got)
  try {
    got = readContent('```json\n' + JSON.stringify(all) + '\n```', ctx)
  } catch (e) {
    got = e.message
  }
  check('без схемы (Gemma, Groq): обёртка вокруг JSON — разбор всё равно берёт', got?.exercises?.length === IDS.length, got)
}

// «True / False» у A1–A2 — две кнопки на языке текста
{
  const es = { ...EX.tfng, prompt: 'Anna tomó un autobús.', options: ['Verdadero', 'Falso'], answer: 1 }
  const esBody = 'Anna llegó a Roma por la noche y tomó un taxi al hotel.'
  check('ES A2: «Verdadero / Falso» подходит схеме, readSwap берёт', fits(S.exerciseSchema('tfng', 'es', 'A2'), es) && readSwap(JSON.stringify({ exercises: [es] }), { body: esBody, lang: 'es', level: 'A2', format: 'tfng', others: [] }).ok)
  const ng = { ...EX.tfng, answer: 2 }
  const a2 = swapOf(ng, 'tfng', 'A2')
  check('A2: «Not given» схема не пускает — и разбор выбросил бы', !fits(S.exerciseSchema('tfng', 'en', 'A2'), ng) && !a2.ok, a2)
  check('B1: «Not given» схема пускает — и разбор берёт', fits(S.exerciseSchema('tfng', 'en', 'B1'), ng) && swapOf({ ...ng, quote: '', mark: '' }, 'tfng').ok)
  check('кнопки — на языке текста: английские у испанского схема не пускает', !fits(S.exerciseSchema('tfng', 'es', 'B1'), EX.tfng))
}

// пределы схемы — пределы разбора и сервера
{
  const opts = (n) => Array.from({ length: n }, (_, i) => `option ${i + 1}`)
  const mcq = (n) => ({ ...EX.mcq, options: opts(n), answer: n - 1 })
  check(`выбор: ${S.OPTIONS_MAX} вариантов — схема, сервер и разбор берут`, fits(S.exerciseSchema('mcq', 'en', 'B1'), mcq(S.OPTIONS_MAX)) && isExerciseShaped(JSON.stringify({ exercises: [mcq(S.OPTIONS_MAX)] }), 'mcq') && swapOf(mcq(S.OPTIONS_MAX), 'mcq').ok)
  check(`выбор: ${S.OPTIONS_MAX + 1} — схема не пускает, сервер тоже`, !fits(S.exerciseSchema('mcq', 'en', 'B1'), mcq(S.OPTIONS_MAX + 1)) && !isExerciseShaped(JSON.stringify({ exercises: [mcq(S.OPTIONS_MAX + 1)] }), 'mcq'))
  check('выбор: один вариант — схема не пускает, разбор тоже', !fits(S.exerciseSchema('mcq', 'en', 'B1'), mcq(1)) && !swapOf(mcq(1), 'mcq').ok)
  const formN = (n) => ({ ...EX.form, options: ['buy', 'bought', 'buys', 'buying', 'to buy'].slice(0, n), answer: 1 })
  check('«Выбери форму»: 3–4 формы — схема и разбор, 2 и 5 — ни то ни другое', [3, 4].every((n) => fits(S.exerciseSchema('form', 'en', 'B1'), formN(n)) && swapOf(formN(n), 'form').ok) && [2, 5].every((n) => !fits(S.exerciseSchema('form', 'en', 'B1'), formN(n)) && !swapOf(formN(n), 'form').ok))
  const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`)
  const order = (n) => ({ ...EX.order, words: words(n), answer: words(n) })
  check(`«Собери»: ${S.ORDER_WORDS_MAX} слов — схема и сервер берут, ${S.ORDER_WORDS_MAX + 1} — ни то ни другое`, fits(S.exerciseSchema('order', 'en', 'B1'), order(S.ORDER_WORDS_MAX)) && isExerciseShaped(JSON.stringify({ exercises: [order(S.ORDER_WORDS_MAX)] }), 'order') && !fits(S.exerciseSchema('order', 'en', 'B1'), order(S.ORDER_WORDS_MAX + 1)) && !isExerciseShaped(JSON.stringify({ exercises: [order(S.ORDER_WORDS_MAX + 1)] }), 'order'))
  check('«Собери»: 2 слова — схема не пускает, разбор тоже', !fits(S.exerciseSchema('order', 'en', 'B1'), order(2)) && !swapOf(order(2), 'order').ok)
  const LEFT = ['flight', 'delay', 'gate', 'ticket', 'taxi', 'hotel', 'book', 'train', 'airport']
  const RIGHT = ['рейс', 'задержка', 'выход', 'билет', 'такси', 'гостиница', 'книга', 'поезд', 'аэропорт']
  const match = (n, extra = 1) => ({ ...EX.match_translation, pairs: LEFT.slice(0, n).map((left, i) => ({ left, right: RIGHT[i] })), extra: ['багаж', 'море', 'лес'].slice(0, extra) })
  check(`пары: ${MATCH_PAIRS.min} и ${MATCH_PAIRS.max} — схема, сервер и разбор берут`, [MATCH_PAIRS.min, MATCH_PAIRS.max].every((n) => fits(S.exerciseSchema('match_translation', 'en', 'B1'), match(n)) && isExerciseShaped(JSON.stringify({ exercises: [match(n)] }), 'match_translation') && swapOf(match(n), 'match_translation').ok))
  check(`пары: ${MATCH_PAIRS.min - 1} и ${MATCH_PAIRS.max + 1} — схема не пускает, разбор тоже`, [MATCH_PAIRS.min - 1, MATCH_PAIRS.max + 1].every((n) => !fits(S.exerciseSchema('match_translation', 'en', 'B1'), match(n)) && !swapOf(match(n), 'match_translation').ok))
  check(`лишних справа: ${MATCH_EXTRA_MAX} — берут все, ${MATCH_EXTRA_MAX + 1} — ни схема, ни разбор`, fits(S.exerciseSchema('match_translation', 'en', 'B1'), match(4, MATCH_EXTRA_MAX)) && swapOf(match(4, MATCH_EXTRA_MAX), 'match_translation').ok && !fits(S.exerciseSchema('match_translation', 'en', 'B1'), match(4, MATCH_EXTRA_MAX + 1)) && !swapOf(match(4, MATCH_EXTRA_MAX + 1), 'match_translation').ok)
}

// ---------------------------------------------------------------------------
// 3. Без обязательного поля — краснеет
// ---------------------------------------------------------------------------
/** Поля, без которых разбор не возьмёт упражнение (validExercises / normalizeExercises). */
const NEEDED = {
  mcq: ['type', 'prompt', 'options', 'answer'],
  fill: ['type', 'prompt', 'answer'],
  order: ['type', 'prompt', 'words', 'answer'],
  match: ['type', 'format', 'prompt', 'pairs'],
}
for (const id of IDS) {
  const ex = EX[id]
  const schema = S.exerciseSchema(id, 'en', 'B1')
  const loose = schema.required.filter((k) => fits(schema, without(ex, k)))
  check(`${id}: без любого обязательного поля (${schema.required.join(', ')}) — схема не пускает`, loose.length === 0, loose.join(', '))
  const needed = NEEDED[ex.type]
  const notRequired = needed.filter((k) => !schema.required.includes(k))
  check(`${id}: всё, без чего разбор отказывает (${needed.join(', ')}), схема требует`, notRequired.length === 0, notRequired.join(', '))
  const kept = needed.filter((k) => swapOf(without(ex, k), id).ok)
  check(`${id}: без такого поля разбор отказывает`, kept.length === 0, kept.join(', '))
}

{
  const all = { title: 'A Long Day', body: BODY, exercises: [EX.mcq, EX.fill_form, EX.match_translation] }
  const schema = S.contentSchema('en', 'B1', ALL_ROWS)
  for (const k of ['title', 'body', 'exercises']) {
    let threw = false
    try {
      readContent(JSON.stringify(without(all, k)), ctx)
    } catch {
      threw = true
    }
    check(`текст без «${k}»: схема не пускает, readContent отказывает`, !fits(schema, without(all, k)) && threw)
  }
  const two = { ...all, exercises: all.exercises.slice(0, MIN_EXERCISES - 1) }
  let threw = false
  try {
    readContent(JSON.stringify(two), ctx)
  } catch {
    threw = true
  }
  check(`текст с ${MIN_EXERCISES - 1} упражнениями: схема не пускает, readContent отказывает`, !fits(schema, two) && threw)
  const own = { title: 'A Long Day', exercises: all.exercises }
  threw = false
  try {
    readOwnText(JSON.stringify(without(own, 'exercises')), { ...ctx, body: BODY })
  } catch {
    threw = true
  }
  check('«Мой текст» без «exercises»: схема не пускает, readOwnText отказывает', !fits(S.ownTextSchema('en', 'B1'), without(own, 'exercises')) && threw)
  check('«Мой текст» без заголовка: схема не пускает (разбор подставит первую строку)', !fits(S.ownTextSchema('en', 'B1'), without(own, 'title')) && readOwnText(JSON.stringify(without(own, 'title')), { ...ctx, body: BODY }).title === '')
  check('замена без «exercises»: схема не пускает, readSwap отказывает', !fits(S.swapSchema('en', 'B1', 'mcq'), {}) && !readSwap('{}', { body: BODY, lang: 'en', level: 'B1', format: 'mcq', others: [] }).ok)
  check('замена двумя упражнениями: схема не пускает, сервер и readSwap тоже', !fits(S.swapSchema('en', 'B1', 'mcq'), { exercises: [EX.mcq, EX.mcq] }) && !isExerciseShaped(JSON.stringify({ exercises: [EX.mcq, EX.mcq] }), 'mcq') && !readSwap(JSON.stringify({ exercises: [EX.mcq, EX.mcq] }), { body: BODY, lang: 'en', level: 'B1', format: 'mcq', others: [] }).ok)
}

// ---------------------------------------------------------------------------
// План: по схеме — readPlan и сервер; без поля — краснеет; пределы
// ---------------------------------------------------------------------------
{
  const plan = {
    comments: 'Слова подходят уровню B1. Добавил gate.',
    vocabulary: ['flight', 'delay', 'gate'],
    grammar_focus: 'Past Simple',
    exercise_plan: [
      { format: 'mcq', count: 3, note: 'смысл текста', tricky: false },
      { format: 'tfng', count: 3, note: '', tricky: true },
      { format: 'match_translation', count: 5, note: 'целевые слова', tricky: false },
    ],
  }
  const schema = S.planSchema()
  check('план по схеме — подходит схеме', fits(schema, plan), validate(schema, plan))
  check('план по схеме — сервер пускает (isPlanShaped: и бесплатный повтор, и право на повторы)', isPlanShaped(JSON.stringify(plan)))
  const got = readPlan(JSON.stringify(plan))
  check('план по схеме — readPlan берёт: виды, число, «каверзные», тема', got.exercise_plan.map((r) => `${r.format}:${r.count}${r.tricky ? '!' : ''}`).join() === 'mcq:3,tfng:3!,match_translation:5' && got.grammar_focus === 'Past Simple' && got.vocabulary.length === 3, got)
  check('темы нет: по схеме — пустая строка, без схемы — null; readPlan отдаёт null', readPlan(JSON.stringify({ ...plan, grammar_focus: '' })).grammar_focus === null && readPlan(JSON.stringify({ ...plan, grammar_focus: null })).grammar_focus === null && fits(schema, { ...plan, grammar_focus: '' }) && !fits(schema, { ...plan, grammar_focus: null }))
  const loose = schema.required.filter((k) => fits(schema, without(plan, k)))
  check(`план без любого поля (${schema.required.join(', ')}) — схема не пускает`, loose.length === 0, loose.join(', '))
  const rowSchema = schema.properties.exercise_plan.items
  const rowLoose = rowSchema.required.filter((k) => fits(schema, { ...plan, exercise_plan: [without(plan.exercise_plan[0], k)] }))
  check(`строка плана без любого поля (${rowSchema.required.join(', ')}) — схема не пускает`, rowLoose.length === 0, rowLoose.join(', '))
  for (const k of ['exercise_plan', 'vocabulary']) {
    let threw = false
    try {
      readPlan(JSON.stringify(without(plan, k)))
    } catch {
      threw = true
    }
    check(`план без «${k}»: схема не пускает, readPlan отказывает`, !fits(schema, without(plan, k)) && threw)
  }
  check('пустой план: схема не пускает, сервер тоже', !fits(schema, { ...plan, exercise_plan: [] }) && !isPlanShaped(JSON.stringify({ ...plan, exercise_plan: [] })))
  check('вид не из каталога: схема не пускает', !fits(schema, { ...plan, exercise_plan: [{ ...plan.exercise_plan[0], format: 'essay' }] }))
  const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`)
  const rows = FORMATS.slice(0, MAX_ROWS).map((f) => ({ format: f.id, count: f.max, note: '', tricky: false }))
  const big = { ...plan, vocabulary: words(S.PLAN_WORDS_MAX), exercise_plan: rows }
  check(`план на пределе (${S.PLAN_WORDS_MAX} слов, ${MAX_ROWS} видов по максимуму) — схема, сервер и readPlan берут всё`, fits(schema, big) && isPlanShaped(JSON.stringify(big)) && readPlan(JSON.stringify(big)).exercise_plan.length === MAX_ROWS)
  check(`${S.PLAN_WORDS_MAX + 1} слов — схема не пускает, сервер тоже`, !fits(schema, { ...plan, vocabulary: words(S.PLAN_WORDS_MAX + 1) }) && !isPlanShaped(JSON.stringify({ ...plan, vocabulary: words(S.PLAN_WORDS_MAX + 1) })))
  check(`${MAX_ROWS + 1} видов — схема не пускает (разбор оставил бы ${MAX_ROWS})`, !fits(schema, { ...plan, exercise_plan: [...rows, { ...rows[0], format: FORMATS[MAX_ROWS].id }] }))
}

// ---------------------------------------------------------------------------
// 6. Поля схемы = поля образца ответа в промпте
// ---------------------------------------------------------------------------
{
  const keys = (o) => Object.keys(o).sort().join()
  for (const [lang, level] of [['en', 'B1'], ['es', 'A2']]) {
    const shapes = P.exerciseSpec(lang, level).shapes.map((l) => JSON.parse(l.trim().replace(/,$/, '')))
    const ids = shapes.map((s) => formatOf(s))
    check(`промпт ${lang} ${level}: образец ответа на каждый вид, по одному`, ids.length === IDS.length && new Set(ids).size === IDS.length, ids)
    const off = shapes.filter((s) => keys(s) !== keys(S.exerciseSchema(formatOf(s), lang, level).properties)).map((s) => `${formatOf(s)}: промпт ${keys(s)} ≠ схема ${keys(S.exerciseSchema(formatOf(s), lang, level).properties)}`)
    check(`промпт ${lang} ${level}: поля образца каждого вида = поля схемы`, off.length === 0, off.join(' | '))
  }
  const req = { lang: 'en', level: 'B1', topic: 'travel', format: 'рассказ', lengthRange: '150-200', vocabulary: '', grammar: '' }
  const plan = S.planSchema()
  const mentions = (text, schema) => Object.keys(schema.properties).filter((k) => !text.includes(`"${k}"`))
  const planMiss = [...mentions(P.planSystem(req), plan), ...mentions(P.planSystem(req), plan.properties.exercise_plan.items)]
  check('промпт плана называет все поля схемы', planMiss.length === 0, planMiss.join(', '))
  const rows = SOME_ROWS
  check('промпт текста называет поля схемы (title, body, exercises)', mentions(P.contentSystem(req, { exercise_plan: rows, vocabulary: [], grammar_focus: null }), S.contentSchema('en', 'B1', rows)).length === 0)
  check('промпт «Моего текста» называет поля схемы (title, exercises)', mentions(P.ownTextSystem('en', 'B1', '3-4'), S.ownTextSchema('en', 'B1')).length === 0)
  check('промпт замены называет поле схемы (exercises)', mentions(P.swapPrompt('en', 'B1', rows[0], { body: BODY, words: [], grammar: '', replacing: null, others: [] }).system, S.swapSchema('en', 'B1', 'mcq')).length === 0)
  check('промпт плана: темы нет — пустая строка, а не null (null схема не держит)', /"grammar_focus": "[^"]*пустая строка/.test(P.planSystem(req)) && !/"grammar_focus":[^\n]*\| null/.test(P.planSystem(req)))
}

// ---------------------------------------------------------------------------
// 7. Вызовы материала шлют схему
// ---------------------------------------------------------------------------
{
  const lib = src('src/lib/materials.ts')
  check('план шлёт planSchema()', /json: planSchema\(\)/.test(lib))
  check('текст шлёт contentSchema по строкам плана', /json: contentSchema\(req\.lang, req\.level, rows\)/.test(lib))
  check('«Мой текст» шлёт ownTextSchema по выбранным видам', /json: ownTextSchema\(lang, level, opts\?\.rows\)/.test(lib))
  check('замена шлёт swapSchema своего вида', /json: swapSchema\(input\.lang, input\.level, input\.format\)/.test(src('src/domains/materials/api.ts')))
  check('замер замены (check-ai-swap) шлёт ту же схему, что кнопка', /swapSchema\(c\.lang, c\.level, c\.format\)\)/.test(src('scripts/check-ai-swap.mjs')))
  check('разбор — общий с тестом (readPlan, readContent, readOwnText)', ['readPlan(raw)', 'readContent(raw,', 'readOwnText(raw,'].every((s) => lib.includes(s)))
}

console.log(`\n${pass}/${pass + fail}`)
if (fail) process.exit(1)
