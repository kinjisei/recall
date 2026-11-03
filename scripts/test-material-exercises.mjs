/**
 * Юнит-проверка отбора упражнений материала (validExercises из src/lib/materials.ts).
 *
 * Зачем отдельным файлом. Это единственный фильтр между свободным ответом
 * модели и тем, что увидит ученик. Раньше он пропускал два типа из трёх —
 * «собери предложение» отбрасывалось молча, хотя движок и сервер его считают.
 * Теперь тип включён, и появилась новая опасность: если набор слов (words) не
 * совпадает с ответом (answer), упражнение НЕВОЗМОЖНО собрать — ученик
 * перебирает слова и не может дойти до верного ответа. Такое обязано
 * отсеиваться здесь, а не обнаруживаться учеником.
 *
 * Запуск: node scripts/test-material-exercises.mjs
 */
import { normalizeExercises, validExercises } from '../src/lib/materialExercises.ts'
import { blankDraft, buildExercise, editSpec, toDraft } from '../src/domains/materials/edit.ts'
import { checkEdit, exerciseProblems } from '../src/domains/materials/editCheck.ts'
import { irregularFromEnglish } from '../src/lib/wordForms.ts'
import { irregularGroups } from '../src/data/english/irregular.ts'
import {
  ATTEMPTS_BEFORE_ANSWER,
  mcqHint,
  mistakeHint,
  orderHint,
  shouldReveal,
} from '../src/lib/selfCorrect.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const mcq = { kind: 'comprehension', type: 'mcq', prompt: 'Where?', options: ['a', 'b'], answer: 1 }
const fill = { kind: 'grammar', type: 'fill', prompt: 'I ___ home', answer: 'go' }
const order = {
  kind: 'grammar',
  type: 'order',
  prompt: 'Я иду домой каждый день',
  words: ['home', 'I', 'day', 'go', 'every'],
  answer: ['I', 'go', 'home', 'every', 'day'],
}

const keep = (ex) => validExercises([ex]).length === 1

// ---- что должно проходить --------------------------------------------------
check('обычный выбор варианта проходит', keep(mcq))
check('вписывание проходит', keep(fill))
check('сборка предложения проходит', keep(order))
check(
  'порядок слов в банке не важен',
  keep({ ...order, words: ['every', 'day', 'home', 'go', 'I'] }),
)
check(
  'регистр и пробелы в банке не мешают',
  keep({ ...order, words: [' I ', 'GO', 'home', 'every', 'day'] }),
)

// ---- что должно отсеиваться ------------------------------------------------
check(
  'несобираемое: в банке лишнее слово',
  !keep({ ...order, words: [...order.words, 'quickly'] }),
)
check(
  'несобираемое: в банке не хватает слова',
  !keep({ ...order, words: ['I', 'go', 'home', 'every'] }),
)
check(
  'несобираемое: слово подменено',
  !keep({ ...order, words: ['I', 'go', 'house', 'every', 'day'] }),
)
check('пустой банк не проходит', !keep({ ...order, words: [], answer: [] }))
check(
  'слишком короткое предложение не проходит',
  !keep({ ...order, words: ['I', 'go'], answer: ['I', 'go'] }),
)
check('пустая строка среди слов не проходит', !keep({ ...order, words: ['I', 'go', '', 'every', 'day'], answer: ['I', 'go', '', 'every', 'day'] }))
check('без answer не проходит', !keep({ kind: 'grammar', type: 'order', prompt: 'x', words: ['a', 'b', 'c'] }))
check('неизвестный тип не проходит', !keep({ kind: 'grammar', type: 'essay', prompt: 'x' }))
check('мусор вместо упражнения не проходит', !keep(null))

// ---- «Соедини пары» и новые виды выбора (Ф2.25-1) ---------------------------
const match = {
  kind: 'vocab',
  type: 'match',
  format: 'translation',
  prompt: 'Соедини слово и перевод',
  pairs: [
    { left: 'delay', right: 'задержка' },
    { left: 'gate', right: 'выход на посадку' },
    { left: 'luggage', right: 'багаж' },
    { left: 'boarding pass', right: 'посадочный талон' },
  ],
  extra: ['опоздать на рейс'],
}
const pairsOf = (n) => Array.from({ length: n }, (_, i) => ({ left: `w${i}`, right: `п${i}` }))
check('пары проходят', keep(match))
check('пары с объяснением проходят', keep({ ...match, format: 'definition', extra: undefined }))
check('3 пары — нижний край', keep({ ...match, pairs: pairsOf(3), extra: [] }))
check('8 пар — верхний край', keep({ ...match, pairs: pairsOf(8), extra: [] }))
check('2 пары не проходят', !keep({ ...match, pairs: pairsOf(2), extra: [] }))
check('9 пар не проходят', !keep({ ...match, pairs: pairsOf(9), extra: [] }))
check('пустая половина пары не проходит', !keep({ ...match, pairs: [...match.pairs.slice(0, 3), { left: 'gate', right: '  ' }] }))
check('одно слово дважды слева не проходит', !keep({ ...match, pairs: [...match.pairs.slice(0, 3), { left: 'Delay', right: 'опоздание' }] }))
check('перевод дважды справа не проходит', !keep({ ...match, pairs: [...match.pairs.slice(0, 3), { left: 'wait', right: 'Задержка' }] }))
check('лишний вариант совпадает с парой — не проходит (два верных)', !keep({ ...match, extra: ['багаж'] }))
check('три лишних — не проходит', !keep({ ...match, extra: ['a', 'b', 'c'] }))
check('неизвестный вид пар не проходит', !keep({ ...match, format: 'picture' }))
const tf = { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana came late.', options: ['True', 'False'], answer: 1 }
check('«True / False» проходит', keep(tf))
check('«True / False / Not given» проходит', keep({ ...tf, options: ['True', 'False', 'Not given'], answer: 2 }))
check('«True / False» с четырьмя кнопками не проходит', !keep({ ...tf, options: ['True', 'False', 'Not given', 'Maybe'] }))
const form = { kind: 'grammar', type: 'mcq', format: 'form', prompt: 'She ___ late.', options: ['came', 'come', 'comes'], answer: 0 }
check('«Выбери форму» из 3 проходит', keep(form))
check('«Выбери форму» из 2 не проходит', !keep({ ...form, options: ['came', 'come'] }))
check('два одинаковых варианта не проходят (сервер сверяет текст)', !keep({ ...mcq, options: ['at seven', 'At seven '] }))
check('пустой вариант не проходит', !keep({ ...mcq, options: ['a', ''] }))

// ---- приведение ответа AI к нашему виду (Ф2.25-1б) --------------------------
const BODY = 'Dana came to the airport early, but her flight had a delay. She missed her flight and took a taxi home. Her luggage was lost.'
const ctxA2 = { body: BODY, lang: 'en', level: 'A2', irregular: irregularFromEnglish(irregularGroups) }
const ctxB1 = { ...ctxA2, level: 'B1' }
const one = (e, ctx) => normalizeExercises([e], ctx)[0]
const tfAi = { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana came late.', options: ['Верно', 'Неверно'], answer: 1 }
check('«True / False» — кнопки на языке текста: True / False', JSON.stringify(one(tfAi, ctxA2)?.options) === '["True","False"]' && one(tfAi, ctxA2)?.answer === 1)
check('ответ — по подписи, а не по месту: [False, True] и answer 1 → True', one({ ...tfAi, options: ['False', 'True'], answer: 1 }, ctxA2)?.answer === 0)
check('A2: «Not given» среди кнопок убран', one({ ...tfAi, options: ['True', 'False', 'Not given'] }, ctxA2)?.options.length === 2)
check('A2: ответ «Not given» — упражнение выброшено', normalizeExercises([{ ...tfAi, options: ['True', 'False', 'Not given'], answer: 2 }], ctxA2).length === 0)
check('B1: три кнопки', JSON.stringify(one(tfAi, ctxB1)?.options) === '["True","False","Not given"]')
check('испанский: Verdadero / Falso / No se dice', JSON.stringify(one(tfAi, { ...ctxB1, lang: 'es' })?.options) === '["Verdadero","Falso","No se dice"]')
check('непонятная подпись — выброшено', normalizeExercises([{ ...tfAi, options: ['Maybe', 'Perhaps'], answer: 0 }], ctxA2).length === 0)
const pairsAi = {
  ...match,
  pairs: [
    { left: 'delay', right: 'задержка' },
    { left: 'miss a flight', right: 'опоздать на рейс' },
    { left: 'take', right: 'взять' },
    { left: 'luggage', right: 'багаж' },
    { left: 'passport', right: 'паспорт' },
  ],
  extra: ['вокзал'],
}
check('пары: слово не из текста убрано, формы засчитаны (missed her flight, took)', JSON.stringify(one(pairsAi, ctxA2)?.pairs.map((p) => p.left)) === '["delay","miss a flight","take","luggage"]')
check('«перевод» не по-русски — выброшено', normalizeExercises([{ ...pairsAi, pairs: pairsAi.pairs.map((p) => ({ ...p, right: 'delay in English' })) }], ctxA2).length === 0)
check('«объяснение» по-русски — выброшено', normalizeExercises([{ ...pairsAi, format: 'definition' }], ctxA2).length === 0)
check('«слово по объяснению» — слово не из текста выброшено', normalizeExercises([{ kind: 'vocab', type: 'mcq', prompt: 'a document for travel', options: ['passport', 'delay', 'taxi', 'luggage'], answer: 0 }], ctxA2).length === 0)
check('«слово по объяснению» — слово из текста остаётся', normalizeExercises([{ kind: 'vocab', type: 'mcq', prompt: 'bags for a trip', options: ['luggage', 'delay', 'taxi', 'home'], answer: 0 }], ctxA2).length === 1)
check('выбор и грамматика не трогаются', normalizeExercises([mcq, fill, order], ctxA2).length === 3)

// ---- смесь: битые уходят, целые остаются ------------------------------------
const mixed = validExercises([mcq, { ...order, words: ['broken'] }, fill, order])
check('из смеси остаются только целые', mixed.length === 3, `осталось ${mixed.length}`)

// ---- правка руками (Ф2.25-3, макет d17): причина — у поля -----------------
// Форма правки проходит тот же фильтр, что ответ AI. Главное свойство: нет
// причин по полям ⇒ фильтр пропускает упражнение без изменений. Иначе
// учитель нажмёт «Готово», а упражнение молча потеряет пару или не
// сохранится с непонятной ошибкой.
console.log('')
console.log('— правка руками —')
// одинаковые по смыслу объекты — с любым порядком ключей
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v)
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b))
const ALL = {
  mcq: { kind: 'comprehension', type: 'mcq', prompt: 'Why was Dana late?', options: ['Her flight had a delay.', 'She took a taxi.', 'She lost her luggage.', 'She came early.'], answer: 0 },
  tfng: { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana came late.', options: ['True', 'False'], answer: 1, quote: 'Dana came to the airport early', mark: 'early', why: 'В тексте — early' },
  word_by_definition: { kind: 'vocab', type: 'mcq', prompt: 'the bags you take on a trip', options: ['luggage', 'delay', 'taxi', 'home'], answer: 0 },
  form: { kind: 'grammar', type: 'mcq', format: 'form', prompt: 'She ___ a taxi home.', options: ['took', 'take', 'taken'], answer: 0 },
  fill_form: { kind: 'grammar', type: 'fill', prompt: 'Dana ___ (come) to the airport early.', answer: 'came', hint: 'Past Simple от come' },
  fill_word: { kind: 'vocab', type: 'fill', prompt: 'Her ___ was lost.', answer: 'luggage' },
  order: { kind: 'grammar', type: 'order', prompt: 'Дана опоздала на рейс.', words: ['flight', 'her', 'missed', 'Dana'], answer: ['Dana', 'missed', 'her', 'flight'] },
  match_translation: { ...pairsAi, pairs: pairsAi.pairs.slice(0, 4) },
  match_definition: {
    kind: 'vocab',
    type: 'match',
    format: 'definition',
    prompt: 'Соедини слово и объяснение',
    pairs: [
      { left: 'delay', right: 'when something is late' },
      { left: 'luggage', right: 'bags for a trip' },
      { left: 'taxi', right: 'a car you pay to ride in' },
    ],
    extra: ['a ticket for a plane'],
  },
}
const ctxEdit = ctxA2
const edit = (ex, patch, ctx = ctxEdit) => checkEdit({ ...toDraft(ex), ...patch }, ctx, ex)
const why = (ex, patch, ctx = ctxEdit) => exerciseProblems({ ...toDraft(ex), ...patch }, ctx)
for (const [id, ex] of Object.entries(ALL)) {
  check(`${id}: исходное упражнение проходит фильтр`, keep(ex) && same(one(ex, ctxEdit), ex))
  const r = edit(ex, {})
  check(`${id}: «Изменить» → «Готово» без правок — то же упражнение`, r.ok && same(r.exercise, ex), r.ok ? '' : JSON.stringify(r.problems))
  check(`${id}: вид формы — тот же`, toDraft(ex).format === id)
}
// d17-1: верный вариант не отмечен
check('выбор без верного — «Отметь верный вариант» у ответа', why(ALL.mcq, { answer: null }).answer === 'Отметь верный вариант')
check('пустой вопрос — у вопроса', why(ALL.mcq, { prompt: '  ' }).prompt === 'Впиши вопрос')
check('пустой вариант — у вариантов', /Заполни все варианты/.test(why(ALL.mcq, { options: ['a', '', 'c', 'd'] }).options ?? ''))
check('один вариант — «хотя бы 2»', why(ALL.mcq, { options: ['a'], answer: 0 }).options === 'Нужно хотя бы 2 варианта')
check('повтор варианта (регистр, пробелы) — у вариантов', /повторяется/.test(why(ALL.mcq, { options: ['She came early.', 'she came early. ', 'x', 'y'] }).options ?? ''))
check('правка вопроса сохраняется, перенос строки — пробел', edit(ALL.mcq, { prompt: 'What happened\nto Dana?' }).exercise?.prompt === 'What happened to Dana?')
check('убрать вариант до двух — можно', edit(ALL.mcq, { options: ['Her flight had a delay.', 'She came early.'], answer: 0 }).ok)
check('«Выбери форму» из двух — «Нужно 3–4 формы»', why(ALL.form, { options: ['took', 'take'] }).options === 'Нужно 3–4 формы')
check('«Выбери форму» из пяти — «Нужно 3–4 формы»', why(ALL.form, { options: ['took', 'take', 'taken', 'takes', 'taking'] }).options === 'Нужно 3–4 формы')
check('выбор ответа из пяти (старый вопрос AI) — сохраняется как есть', edit({ ...ALL.mcq, options: [...ALL.mcq.options, 'She was ill.'] }, {}).ok)
check('«Выбери форму» без ___ — у предложения', why(ALL.form, { prompt: 'She took a taxi home.' }).prompt === 'Отметь пропуск: ___')
check('«Выбери форму» без верной — «Отметь верную форму»', why(ALL.form, { answer: null }).answer === 'Отметь верную форму')
check('«Слово по объяснению»: слова нет в тексте — у слов', /«passport» нет в тексте/.test(why(ALL.word_by_definition, { options: ['passport', 'delay', 'taxi', 'home'] }).options ?? ''))
check('«Слово по объяснению»: само слово в объяснении — у объяснения', /само слово/.test(why(ALL.word_by_definition, { prompt: 'luggage is the bags you take' }).prompt ?? ''))
check('True / False: без ответа — «Отметь ответ»', why(ALL.tfng, { answer: null }).answer === 'Отметь ответ')
check('True / False A2: «Not given» (третья кнопка) — «Отметь ответ»', why(ALL.tfng, { answer: 2 }).answer === 'Отметь ответ')
check('True / False A2: кнопки True / False', JSON.stringify(edit(ALL.tfng, { answer: 0 }).exercise?.options) === '["True","False"]')
check('True / False B1: три кнопки', edit(ALL.tfng, { answer: 0 }, ctxB1).exercise?.options.length === 3)
check('True / False: «почему» правится, строка текста остаётся', (() => { const r = edit(ALL.tfng, { answer: 0, note: 'Нет, рано' }); return r.ok && r.exercise.why === 'Нет, рано' && r.exercise.quote === ALL.tfng.quote })())
check('True / False B1: «Not given» — без строки текста', (() => { const r = edit({ ...ALL.tfng, options: ['True', 'False', 'Not given'] }, { answer: 2 }, ctxB1); return r.ok && r.exercise.quote === undefined && r.exercise.mark === undefined })())
check('испанский: кнопки Verdadero / Falso', JSON.stringify(buildExercise({ ...toDraft(ALL.tfng), answer: 0 }, { lang: 'es', level: 'A2' }).options) === '["Verdadero","Falso"]')
check('«Вставь»: пустой ответ — у ответа', why(ALL.fill_form, { text: ' / ' }).text === 'Впиши ответ')
check('«Вставь»: без ___ — у предложения', why(ALL.fill_form, { prompt: 'Dana came early.' }).prompt === 'Отметь пропуск: ___')
check('«Вставь»: варианты через «/» — можно', edit(ALL.fill_form, { text: 'came / arrived' }).ok)
check('«Вставь»: подсказку можно стереть', (() => { const r = edit(ALL.fill_form, { note: '' }); return r.ok && !('hint' in r.exercise) })())
check('«Вставь слово»: слова нет в тексте — у ответа', /«passport» нет в тексте/.test(why(ALL.fill_word, { text: 'passport' }).text ?? ''))
check('«Вставь слово»: форма из текста засчитана (took ⇒ take)', edit(ALL.fill_word, { prompt: 'She ___ a taxi.', text: 'take' }).ok)
check('«Собери»: два слова — «хотя бы 3»', why(ALL.order, { text: 'Dana missed' }).text === 'Нужно хотя бы 3 слова')
check('«Собери»: новое предложение — банк из тех же слов', (() => { const r = edit(ALL.order, { text: 'Her luggage was lost' }); return r.ok && keep(r.exercise) && r.exercise.words.length === 4 })())
check('«Собери»: то же предложение — банк прежний', same(edit(ALL.order, {}).exercise?.words, ALL.order.words))
const P = ALL.match_translation.pairs
check('пары: пустая — «Пустую пару не сохранить»', /Пустую пару не сохранить/.test(why(ALL.match_translation, { pairs: [...P, { left: 'taxi', right: '' }] }).pairs ?? ''))
check('пары: две — «от 3 до 8»', why(ALL.match_translation, { pairs: P.slice(0, 2) }).pairs === 'Нужно от 3 до 8 пар')
check('пары: слово дважды', /«Delay» повторяется/.test(why(ALL.match_translation, { pairs: [...P, { left: 'Delay', right: 'опоздание' }] }).pairs ?? ''))
check('пары: перевод дважды', /повторяется/.test(why(ALL.match_translation, { pairs: [...P, { left: 'taxi', right: 'Багаж' }] }).pairs ?? ''))
check('пары: слова нет в тексте («ticket»)', /«ticket» нет в тексте/.test(why(ALL.match_translation, { pairs: [...P, { left: 'ticket', right: 'билет' }] }).pairs ?? ''))
check('пары: слово в форме из текста — можно (came ⇒ come)', edit(ALL.match_translation, { pairs: [P[0], P[1], P[3], { left: 'come', right: 'приходить' }] }).ok)
check('пары: перевод не по-русски', /по-русски/.test(why(ALL.match_translation, { pairs: [...P.slice(0, 3), { left: 'luggage', right: 'bags' }] }).pairs ?? ''))
check('пары: объяснение по-русски', /на английском/.test(why(ALL.match_definition, { pairs: [...ALL.match_definition.pairs.slice(0, 2), { left: 'taxi', right: 'машина' }] }).pairs ?? ''))
check('пары: лишний совпал с парой — у лишнего', /уже есть в парах/.test(why(ALL.match_translation, { extra: ['багаж'] }).extra ?? ''))
check('пары: лишний не по-русски — у лишнего', /по-русски/.test(why(ALL.match_translation, { extra: ['station'] }).extra ?? ''))
check('пары: лишний можно стереть', (() => { const r = edit(ALL.match_translation, { extra: [''] }); return r.ok && !('extra' in r.exercise) })())
check('пары: подпись упражнения — прежняя', edit(ALL.match_translation, {}).exercise?.prompt === ALL.match_translation.prompt)
// d17-3б: пустая форма после «Напишу сам»
const empty = blankDraft('form')
check('«Напишу сам» «Выбери форму»: три пустые формы', empty.options.length === 3 && empty.options.every((o) => o === ''))
check('пустая форма не сохраняется: причины у предложения и форм', (() => { const r = checkEdit(empty, ctxEdit); return !r.ok && !!r.problems.prompt && !!r.problems.options })())
check('пустые пары — три пустые', blankDraft('match_definition').pairs.length === 3)
check('новое упражнение из формы — подпись вида у пар', (() => { const r = checkEdit({ ...blankDraft('match_translation'), pairs: P.slice(0, 3) }, ctxEdit); return r.ok && r.exercise.prompt === 'Соедини слово и перевод' })())
check('подписи формы: «Формы · 3–4, кружок — верная» и пример на языке текста', editSpec('form', ctxA2).options.label === 'Формы · 3–4, кружок — верная' && /Dana ___ to Istanbul/.test(editSpec('form', ctxA2).prompt.placeholder))
check('подписи формы: у объяснений на испанском — «на испанском»', /на испанском/.test(editSpec('match_definition', { lang: 'es', level: 'B1' }).pairs.label))

// Свойство: тысячи правок по одной и по две — нет причин ⇒ фильтр AI
// пропускает упражнение без изменений (сбой — «проверка чего-то не знает»).
const MUT = [
  (d) => ({ ...d, prompt: '' }),
  (d) => ({ ...d, prompt: 'Dana took a taxi.' }),
  (d) => ({ ...d, prompt: 'Dana ___ a taxi.' }),
  (d) => ({ ...d, prompt: 'luggage bags' }),
  (d) => ({ ...d, answer: null }),
  (d) => ({ ...d, answer: 0 }),
  (d) => ({ ...d, answer: 1 }),
  (d) => ({ ...d, answer: 2 }),
  (d) => ({ ...d, answer: 5 }),
  (d) => ({ ...d, options: d.options.slice(1) }),
  (d) => ({ ...d, options: d.options.slice(0, -1) }),
  (d) => ({ ...d, options: [...d.options, 'taxi'] }),
  (d) => ({ ...d, options: [...d.options, d.options[0] ?? 'x'] }),
  (d) => ({ ...d, options: d.options.map((o, i) => (i === 0 ? '' : o)) }),
  (d) => ({ ...d, options: d.options.map((o, i) => (i === 0 ? 'passport' : o)) }),
  (d) => ({ ...d, options: ['delay', 'home', 'taxi', 'early', 'lost'] }),
  (d) => ({ ...d, text: '' }),
  (d) => ({ ...d, text: 'passport' }),
  (d) => ({ ...d, text: 'took a taxi' }),
  (d) => ({ ...d, text: 'came / went' }),
  (d) => ({ ...d, text: 'missed' }),
  (d) => ({ ...d, note: '' }),
  (d) => ({ ...d, pairs: d.pairs.slice(1) }),
  (d) => ({ ...d, pairs: [...d.pairs, { left: 'taxi', right: 'такси' }] }),
  (d) => ({ ...d, pairs: [...d.pairs, { left: 'home', right: 'a place you live' }] }),
  (d) => ({ ...d, pairs: [...d.pairs, { left: 'passport', right: 'паспорт' }] }),
  (d) => ({ ...d, pairs: [...d.pairs, { ...(d.pairs[0] ?? { left: 'a', right: 'b' }) }] }),
  (d) => ({ ...d, pairs: d.pairs.map((p, i) => (i === 0 ? { ...p, right: '' } : p)) }),
  (d) => ({ ...d, pairs: d.pairs.map((p, i) => (i === 0 ? { ...p, right: 'delay' } : p)) }),
  (d) => ({ ...d, pairs: d.pairs.map((p, i) => (i === 0 ? { ...p, right: 'опоздание' } : p)) }),
  (d) => ({ ...d, pairs: Array.from({ length: 9 }, (_, i) => d.pairs[i % Math.max(1, d.pairs.length)] ?? { left: 'x', right: 'y' }) }),
  (d) => ({ ...d, extra: [] }),
  (d) => ({ ...d, extra: [d.pairs[1]?.right ?? 'x'] }),
  (d) => ({ ...d, extra: ['вокзал', 'поезд', 'самолёт'] }),
  (d) => ({ ...d, extra: ['station'] }),
]
let tried = 0
let passed = 0
const leaks = []
for (const ctx of [ctxA2, ctxB1]) {
  for (const ex of Object.values(ALL)) {
    const base = toDraft(ex)
    const drafts = [base]
    for (const a of MUT) {
      drafts.push(a(base))
      for (const b of MUT) drafts.push(b(a(base)))
    }
    for (const d of drafts) {
      tried++
      if (Object.keys(exerciseProblems(d, ctx)).length) continue
      passed++
      const built = buildExercise(d, ctx, ex)
      const kept = validExercises(normalizeExercises([built], ctx))
      if (kept.length !== 1 || !same(kept[0], built)) leaks.push(`${d.format}: ${JSON.stringify(d).slice(0, 160)}`)
    }
  }
}
check(`нет причин ⇒ фильтр пропускает без изменений (${tried} правок, без причин — ${passed})`, leaks.length === 0 && passed > 100, leaks.slice(0, 3).join(' | '))

// ---------------------------------------------------------------------------
// САМОКОРРЕКЦИЯ: подсказка говорит ГДЕ ошибка и НЕ выдаёт ответ.
//
// ⚠️ Главное здесь — не форма подсказки, а то, чего в ней НЕТ. Подсказка, из
// которой ответ восстанавливается, — это тот же готовый ответ, только с лишним
// нажатием, и весь смысл (найти ошибку самому) пропадает.
// ---------------------------------------------------------------------------
console.log('')
console.log('— самокоррекция: подсказка не выдаёт ответ —')

const tries = [
  ['went', 'goed'],
  ['have been', 'have was'],
  ['I go to school every day', 'I goes to school every day'],
  ['a book', 'the book'],
  ['beautiful', 'butiful'],
]
let leak = ''
for (const [answer, given] of tries) {
  const h = mistakeHint(given, answer)
  if (h.toLowerCase().includes(answer.toLowerCase())) leak = `«${h}» содержит ответ «${answer}»`
  for (const w of answer.split(' ')) {
    if (w.length > 3 && h.toLowerCase().includes(w.toLowerCase())) {
      leak = `«${h}» содержит слово ответа «${w}»`
    }
  }
}
check('подсказка не содержит ни ответа, ни его слов', leak === '', leak)
check('подсказка непустая и по-русски', tries.every(([a, g]) => /[а-яё]/i.test(mistakeHint(g, a))))
check(
  'подсказка называет место ошибки в предложении',
  /Первые 1 слово верно/.test(mistakeHint('I goes to school every day', 'I go to school every day')),
  mistakeHint('I goes to school every day', 'I go to school every day'),
)
check(
  'разное число слов — говорим сколько нужно, а не какие',
  mistakeHint('I go', 'I go to school') === 'Слов должно быть 4, у тебя 2.',
  mistakeHint('I go', 'I go to school'),
)
check(
  'одно слово: считаем совпавшие буквы',
  /Первые \d+ буквы верны/.test(mistakeHint('goed', 'going')),
  mistakeHint('goed', 'going'),
)
check('пустой ответ — отдельная подсказка', /Пустой ответ/.test(mistakeHint('', 'went')))

check(
  'порядок: сколько слов уже на месте',
  orderHint(['I', 'every', 'day', 'go'], ['I', 'go', 'every', 'day']) ===
    'Первые 1 слово на месте — дальше нет.',
  orderHint(['I', 'every', 'day', 'go'], ['I', 'go', 'every', 'day']),
)
check(
  'порядок: не хватает слов — говорим сколько',
  orderHint(['I', 'go'], ['I', 'go', 'every', 'day']) === 'Слов должно быть 4, у тебя 2.',
)
check('выбор: подсказка называет только число вариантов', mcqHint(3) === 'Не то. Осталось вариантов: 3.')

check('ответ показываем со второй попытки', ATTEMPTS_BEFORE_ANSWER === 2)
check('первая ошибка ответ НЕ показывает', !shouldReveal(1, false))
check('вторая — показывает', shouldReveal(2, false))
check('и по явной просьбе — сразу', shouldReveal(1, true))

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
