/**
 * Каталог видов упражнений материала (src/lib/exerciseFormats.ts, Ф2.25-2,
 * макет d16): по нему учитель выбирает упражнения на шаге «План», по нему же
 * промпт просит ровно выбранное, итог считает «4 вида · 11 заданий · до 15
 * баллов», а сверка говорит, чего AI не доделал.
 *
 * Держит:
 *   1. каталог: 9 видов в трёх группах, у каждого — пределы (пары 3–8, задания 1–10);
 *   2. план к виду каталога: старые планы (kind/type) узнаются, количество —
 *      в пределах, повтор вида и неизвестный вид — прочь, видов не больше 8,
 *      «каверзные» — только у True / False;
 *   3. итог: пары — одно задание и балл за пару (кадр d16-1: 11 заданий, 15 баллов);
 *   4. новый вид: пар — по числу целевых слов, в пределах 3–8;
 *   5. сверка с планом: меньше упражнений или пар — названо, сколько из скольких;
 *   6. вид готового упражнения и названия (True / False у A2);
 *   7. подписи строк плана и итог — как в кадрах d16-1, d16-3, d16-4.
 * ⚠️ Ожидания — литералами, а не из тех же функций.
 *
 * Запуск: node scripts/test-exercise-formats.mjs
 */
import { FORMATS, GROUPS, MAX_ROWS, OWN_TEXT_ROWS, formatOf, formatTitle, formatById, newRow, normalizeRows, planShortfall, planTotals, rowNote, shortLabel, totalsText } from '../src/lib/exerciseFormats.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 1. каталог
check('девять видов', FORMATS.length === 9, String(FORMATS.length))
check('три группы: По тексту, Словарь, Грамматика', eq(GROUPS.map((g) => g.label), ['По тексту', 'Словарь', 'Грамматика']))
check('по группам 2 · 4 · 3', eq(GROUPS.map((g) => FORMATS.filter((f) => f.group === g.id).length), [2, 4, 3]))
check('пары — 3–8, остальное — 1–10', FORMATS.every((f) => (f.type === 'match' ? f.min === 3 && f.max === 8 : f.min === 1 && f.max === 10)))
check('видов в плане — не больше 8', MAX_ROWS === 8)

// 2. план к виду каталога
const legacy = [
  { kind: 'comprehension', type: 'mcq', count: 3, note: 'вопросы' },
  { kind: 'grammar', type: 'fill', count: 4, note: 'Past Simple' },
  { kind: 'grammar', type: 'order', count: 2, note: '' },
  { kind: 'vocab', type: 'mcq', count: 2, note: '' },
]
check('старый план узнаётся', eq(normalizeRows(legacy).map((r) => r.format), ['mcq', 'fill_form', 'order', 'word_by_definition']))
check('пометка остаётся', normalizeRows(legacy)[1]?.note === 'Past Simple')
check('количество — в пределах: 25 → 10, 0 → 1', eq(normalizeRows([{ format: 'mcq', count: 25 }, { format: 'order', count: 0 }]).map((r) => r.count), [10, 1]))
check('пары — в пределах: 12 → 8, 1 → 3', eq(normalizeRows([{ format: 'match_translation', count: 12 }, { format: 'match_definition', count: 1 }]).map((r) => r.count), [8, 3]))
check('повтор вида сливается в первую строку', eq(normalizeRows([{ format: 'mcq', count: 3 }, { format: 'mcq', count: 5 }]).map((r) => r.count), [3]))
check('неизвестный вид — прочь', normalizeRows([{ format: 'essay', kind: 'comprehension', type: 'open', count: 2 }]).length === 0)
const nine = FORMATS.map((f) => ({ format: f.id, count: f.def }))
check('видов — не больше 8', normalizeRows(nine).length === 8)
check('kind и type — из каталога', eq(normalizeRows([{ format: 'tfng', kind: 'vocab', type: 'fill', count: 3 }])[0], { format: 'tfng', kind: 'comprehension', type: 'mcq', count: 3, note: '' }))
check('«каверзные» — у True / False', normalizeRows([{ format: 'tfng', count: 3, tricky: true }])[0]?.tricky === true)
check('«каверзные» у другого вида не держатся', normalizeRows([{ format: 'mcq', count: 3, tricky: true }])[0]?.tricky === undefined)
check('модель прислала вид в type — узнаётся', normalizeRows([{ kind: 'vocab', type: 'match_definition', count: 5 }])[0]?.format === 'match_definition')

// 3. итог (кадр d16-1)
const d16 = [
  { format: 'mcq', count: 3 },
  { format: 'tfng', count: 3, tricky: true },
  { format: 'match_translation', count: 5 },
  { format: 'fill_form', count: 4 },
]
check('4 вида · 11 заданий · до 15 баллов', eq(planTotals(d16), { kinds: 4, tasks: 11, points: 15 }), JSON.stringify(planTotals(d16)))

// 4. новый вид
check('пары — по числу целевых слов (5 → 5)', newRow('match_translation', 5).count === 5)
check('пары — не меньше 3 (2 слова → 3)', newRow('match_translation', 2).count === 3)
check('пары — не больше 8 (12 слов → 8)', newRow('match_definition', 12).count === 8)
check('остальное — как в каталоге (Вставь форму — 4)', newRow('fill_form').count === 4)
check('новая строка — с kind и type', eq(newRow('form'), { format: 'form', kind: 'grammar', type: 'mcq', count: 3, note: '' }))

// 5. сверка с планом
const made = [
  { kind: 'comprehension', type: 'mcq', prompt: 'Q', options: ['a', 'b', 'c', 'd'], answer: 0 },
  { kind: 'comprehension', type: 'mcq', prompt: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 1 },
  { kind: 'comprehension', type: 'mcq', prompt: 'Q3', options: ['a', 'b', 'c', 'd'], answer: 1 },
  { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'S', options: ['True', 'False'], answer: 1 },
  { kind: 'vocab', type: 'match', format: 'translation', prompt: 'P', pairs: [1, 2, 3, 4].map((i) => ({ left: `w${i}`, right: `п${i}` })) },
  ...[1, 2, 3, 4].map((i) => ({ kind: 'grammar', type: 'fill', prompt: `s${i} ___`, answer: 'x' })),
]
check(
  'не доделано: True / False 1 из 3, пары 4 из 5',
  eq(planShortfall(d16, made, 'A2'), [
    { label: 'True / False', want: 3, got: 1, unit: 'утв.' },
    { label: 'Соедини слово и перевод', want: 5, got: 4, unit: 'пар' },
  ]),
  JSON.stringify(planShortfall(d16, made, 'A2')),
)
check('всё по плану — пусто', planShortfall([{ format: 'mcq', count: 3 }], made).length === 0)

// 6. вид готового упражнения и названия
check('виды готовых упражнений', eq(made.slice(2, 6).map(formatOf), ['mcq', 'tfng', 'match_translation', 'fill_form']))
check('«Выбери правильную форму» и «Слово по объяснению»', formatOf({ kind: 'grammar', type: 'mcq', format: 'form' }) === 'form' && formatOf({ kind: 'vocab', type: 'mcq' }) === 'word_by_definition')
check('у A2 — «True / False», у B1 — с «Not given»', formatTitle(formatById('tfng'), 'A2') === 'True / False' && formatTitle(formatById('tfng'), 'B1') === 'True / False / Not given')
check('короткое название пар — «Соедини пары»', shortLabel(made[4]) === 'Соедини пары')

// 7. подписи строк и итог (кадры d16)
const words = ['delay', 'luggage', 'boarding pass', 'gate', 'miss a flight']
const plan = { level: 'A2', words, grammar: 'Past Simple', grammarAsked: true }
check('пары: слова из текста (d16-1)', rowNote({ format: 'match_translation', count: 5 }, plan) === 'слова из текста: delay, luggage, boarding pass, gate, miss a flight')
check('пары больше слов: «5 целевых слов + 1 из текста» (d16-4)', rowNote({ format: 'match_translation', count: 6 }, plan) === '5 целевых слов + 1 из текста')
check('пары меньше слов — первые по счёту', rowNote({ format: 'match_definition', count: 3 }, plan) === 'слова из текста: delay, luggage, boarding pass')
check('грамматика из заявки (d16-1)', rowNote({ format: 'fill_form', count: 4 }, plan) === 'Past Simple — из заявки, есть в тексте')
check('грамматика от AI', rowNote({ format: 'order', count: 2 }, { ...plan, grammarAsked: false }) === 'Past Simple — есть в тексте')
check('без грамматики — что делает ученик', rowNote({ format: 'form', count: 3 }, { ...plan, grammar: '' }) === 'из 3–4 форм')
check('True / False у A2 — без «Not given»', rowNote({ format: 'tfng', count: 3 }, plan) === 'для A2 — без «Not given»')
check('True / False у B1 — утверждение', rowNote({ format: 'tfng', count: 3 }, { ...plan, level: 'B1' }) === 'утверждение о тексте')
check('вопросы — что делает ученик', rowNote({ format: 'mcq', count: 3 }, plan) === 'вопрос по смыслу, 4 варианта')
const own = { level: 'A2', words: [], grammar: '', grammarAsked: false, own: true }
check('«Мой текст» без слов: «AI выберет 5 слов из текста» (d16-3)', rowNote({ format: 'match_translation', count: 5 }, own) === 'AI выберет 5 слов из текста')
check('«Мой текст» со словами — из заявки', rowNote({ format: 'match_translation', count: 3 }, { ...own, words: ['delay', 'gate'] }) === 'слова из заявки: delay, gate + 1 из текста')
check('«Мой текст» с грамматикой — из заявки', rowNote({ format: 'fill_form', count: 4 }, { ...own, grammar: 'Past Simple', grammarAsked: true }) === 'Past Simple — из заявки')
check('итог d16-1: 4 вида · 11 заданий · до 15 баллов', eq(totalsText(d16), { kinds: '4 вида', tasks: '11 заданий', points: 'до 15 баллов' }), JSON.stringify(totalsText(d16)))
check('итог: 1 вид · 1 задание · до 1 балла', eq(totalsText([{ format: 'order', count: 1 }]), { kinds: '1 вид', tasks: '1 задание', points: 'до 1 балла' }))
check(
  '«Мой текст» по умолчанию — как d16-3 без правок',
  eq(OWN_TEXT_ROWS.map((r) => [r.format, r.count]), [['mcq', 3], ['tfng', 3], ['match_translation', 5], ['fill_form', 4]]) && OWN_TEXT_ROWS[1].tricky === true,
)

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
