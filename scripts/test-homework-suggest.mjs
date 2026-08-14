/**
 * Правила подбора домашки (src/lib/homeworkRules.ts).
 *
 * Зачем отдельным тестом. Подбор — это единственное место, где приложение
 * само решает, СКОЛЬКО задать ученику. Ошибка здесь не видна на экране: набор
 * из 60 новых слов на неделю выглядит ровно так же, как набор из 32, и заметит
 * её только ученик, который через две недели бросит. Поэтому числа правил
 * проверяются прямо, а не через интерфейс.
 *
 * ⚠️ Тест обязан КРАСНЕТЬ, если снять ограничение. Проверено руками на каждом
 * из трёх: убрать потолок новых слов, убрать окно покрытия при выборе текста,
 * убрать сведе́ние словарных пунктов к одному — падает соответствующий блок.
 *
 * Запуск: node scripts/test-homework-suggest.mjs
 */
import {
  COVERAGE_WINDOW,
  MAX_ITEMS,
  NEW_WORDS_PER_DAY_MAX,
  NEW_WORDS_PER_SESSION,
  PICK_SIZE,
  REVIEW_PER_SESSION,
  applyRules,
  balanceOf,
  buildBaseline,
  countableItems,
  coverage,
  isBalanced,
  missingSides,
  newWordsBudget,
  pickText,
  reviewTarget,
  sessionsFor,
  tokenize,
  wordForms,
} from '../src/lib/homeworkRules.ts'
import { plural } from '../src/lib/text.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// ---------------------------------------------------------------------------
// 1. Объём: новых слов не больше 8-10 в день
// ---------------------------------------------------------------------------
console.log('\n— объём нового материала —')

check('неделя = 4 коротких захода', sessionsFor(7) === 4, `${sessionsFor(7)}`)
check('две недели = 8 заходов', sessionsFor(14) === 8, `${sessionsFor(14)}`)
check('срок в один день — всё равно хотя бы один заход', sessionsFor(1) === 1)
check('нулевой и отрицательный срок не ломают счёт', sessionsFor(0) === 1 && sessionsFor(-5) === 1)

// Главная проверка правила. Снимите Math.min в newWordsBudget — она покраснеет.
let capOk = true
let worst = ''
for (let d = 1; d <= 60; d++) {
  const budget = newWordsBudget(d)
  if (budget > d * NEW_WORDS_PER_DAY_MAX) {
    capOk = false
    worst = `${d} дн. → ${budget} слов, потолок ${d * NEW_WORDS_PER_DAY_MAX}`
    break
  }
}
check(`потолок ${NEW_WORDS_PER_DAY_MAX} новых слов в день держится на любом сроке`, capOk, worst)

check(
  'на неделю — 32 новых слова (8 за заход × 4 захода)',
  newWordsBudget(7) === NEW_WORDS_PER_SESSION * 4,
  `${newWordsBudget(7)}`,
)
check(
  'короткий срок режет объём, а не растягивает его',
  newWordsBudget(2) < newWordsBudget(7),
  `${newWordsBudget(2)} < ${newWordsBudget(7)}`,
)

console.log('\n— объём повторения —')
check(
  'просрочка в 500 карточек не превращается в невыполнимое задание',
  reviewTarget(500, 7) === 4 * REVIEW_PER_SESSION,
  `${reviewTarget(500, 7)}`,
)
check('мало просроченных — берём сколько есть', reviewTarget(12, 7) === 12)
check('просроченных нет — повторять нечего', reviewTarget(0, 7) === 0)

// ---------------------------------------------------------------------------
// 2. Покрытие текста
// ---------------------------------------------------------------------------
console.log('\n— покрытие текста —')

const known = new Set(['the', 'cat', 'sit', 'on', 'a', 'mat', 'and', 'sleep'])
const c1 = coverage('The cat sits on a mat', known)
check('покрытие считается по всем словам текста', c1.total === 6, `${c1.total}`)
check('знакомое слово в другой форме засчитано (sits → sit)', c1.pct === 1, `${c1.pct}`)

const c2 = coverage('The cat sits on a purple mat', known)
check(
  'незнакомое слово снижает покрытие ровно на свою долю',
  Math.abs(c2.pct - 6 / 7) < 1e-9,
  `${(c2.pct * 100).toFixed(1)}%`,
)
check('незнакомые слова названы поимённо', c2.samples.includes('purple'), c2.samples.join(','))
check('пустой текст — не деление на ноль', coverage('', known).pct === 0)

// Цифры словами не считаются намеренно: «5» и «2026» — не лексика, и в
// знаменатель покрытия им не место.
check('токенизация не считает цифры и знаки словами', tokenize('Cat, 5 dogs!').length === 2)
check('формы слова включают само слово', wordForms('cats').includes('cats'))
check('множественное число сводится к единственному', wordForms('cats').includes('cat'))
check('-ies → -y', wordForms('stories').includes('story'))

// Ключевая проверка: выбирается текст ИЗ ОКНА, а не самый лёгкий.
// Уберите учёт inWindow в pickText — покраснеет.
console.log('\n— выбор текста —')
// ⚠️ Слова тестовых текстов — ТОЛЬКО из букв. Первая версия звала их «w0…w99»,
// а токенизатор цифры отбрасывает: все сто слов схлопывались в одно «w», и
// покрытие всех текстов выходило нулевым. Проверка при этом честно краснела —
// но выглядела как ошибка выбора текста, хотя ломались тестовые данные.
const letters = 'abcdefghijklmnopqrstuvwxyz'
const wordAt = (i) => letters[Math.floor(i / 26) % 26] + letters[i % 26]
const vocab = new Set(Array.from({ length: 100 }, (_, i) => wordAt(i)))
/** Текст из total слов, где unknownCount штук — незнакомые. */
const mk = (id, level, unknownCount, total = 100) => ({
  id,
  title: id,
  level,
  body: [
    ...Array.from({ length: total - unknownCount }, (_, i) => wordAt(i % 100)),
    ...Array.from({ length: unknownCount }, (_, i) => 'zzq' + letters[i % 26]),
  ].join(' '),
})

const easy = mk('всё знакомо', 'A2', 0) // 100% — нового не даёт
const good = mk('в окне', 'A2', 3) // 97% — попадает в 95-98%
const hard = mk('трудный', 'A2', 40) // 60% — расшифровка, а не чтение
const pickedA = pickText([easy, good, hard], vocab, 'B1')
check('берём текст из окна 95-98%, а не самый лёгкий', pickedA?.id === 'в окне', pickedA?.id)
check('и отмечаем, что он в окне', pickedA?.inWindow === true)
check(
  'окно объявлено именно как 95-98%',
  COVERAGE_WINDOW.min === 0.95 && COVERAGE_WINDOW.max === 0.98,
)

const pickedB = pickText([easy, hard], vocab, 'B1')
check(
  'в окно не попал никто — берём ближайший, но честно помечаем',
  pickedB?.id === 'всё знакомо' && pickedB?.inWindow === false,
  pickedB?.id,
)

const tooHigh = mk('C1-текст', 'C1', 3)
const ownLevel = mk('A2-текст', 'A2', 20)
const pickedC = pickText([tooHigh, ownLevel], vocab, 'A2')
check(
  'текст выше уровня ученика не берём, даже если покрытие у него лучше',
  pickedC?.id === 'A2-текст',
  pickedC?.id,
)
check(
  'но если своих текстов нет — лучше трудный, чем пустой пункт',
  pickText([tooHigh], vocab, 'A2')?.id === 'C1-текст',
)
check('текстов нет вовсе — null, а не выдумка', pickText([], vocab, 'A2') === null)

// ---------------------------------------------------------------------------
// 3. Баланс и состав набора
// ---------------------------------------------------------------------------
console.log('\n— состав набора —')

const facts = {
  lang: 'en',
  level: 'B1',
  days: 7,
  dueCards: 12,
  totalCards: 80,
  struggling: ['whisper', 'harvest'],
  weakTopics: ['Past Simple'],
  text: { id: 't', title: 'The market', level: 'A2', coverage: coverage('w1 w2', vocab), inWindow: false },
  activeDays14: 5,
  goal: 'exam',
}

const base = buildBaseline(facts)
check('в наборе есть все три стороны: повторение, чтение, продуктивное', isBalanced(base), missingSides(base).join(','))
check('ровно один словарный пункт', base.filter((i) => i.kind === 'words').length === 1)
check(
  `ровно ${PICK_SIZE} пункта на выбор`,
  base.filter((i) => i.pickGroup != null).length === PICK_SIZE,
)
check('группа выбора считается за один пункт', countableItems(base) === base.length - 1)
check('у каждого пункта есть основание', base.every((i) => i.why && i.why.length > 10))
check(
  'объём слов = повторение + новые, ни словом больше',
  base.find((i) => i.kind === 'words').target === reviewTarget(12, 7) + newWordsBudget(7),
)
check(
  'буксующие слова названы в основании',
  base.some((i) => i.why.includes('whisper')),
)
check(
  'слабая тема грамматики попала в квест',
  base.some((i) => i.title.includes('Past Simple')),
)
check(
  'подобранный текст назван в пункте чтения',
  base.some((i) => i.kind === 'text' && i.title.includes('The market')),
)

// ---------------------------------------------------------------------------
// 4. applyRules чинит любой набор — в том числе присланный моделью
// ---------------------------------------------------------------------------
console.log('\n— правила применяются к чужому набору —')

const greedy = [
  { kind: 'words', title: 'Выучить 300 слов', target: 300, why: '' },
  { kind: 'words', title: 'И ещё 200 слов', target: 200, why: '' },
]
const fixed = applyRules(greedy, facts)
check(
  'завышенный объём слов прижат к бюджету правил',
  fixed.find((i) => i.kind === 'words').target === reviewTarget(12, 7) + newWordsBudget(7),
  `${fixed.find((i) => i.kind === 'words').target}`,
)
check('второй словарный пункт убран', fixed.filter((i) => i.kind === 'words').length === 1)
check('перекос выправлен: чтение и продуктивное добавлены', isBalanced(fixed), missingSides(fixed).join(','))

const onlyReading = applyRules([{ kind: 'text', title: 'Читать', target: 1, why: '' }], facts)
check('набор из одного чтения дополнен повторением и письмом', isBalanced(onlyReading))

const lonely = applyRules(
  [
    { kind: 'words', title: 'Слова', target: 10, why: '' },
    { kind: 'text', title: 'Текст', target: 1, why: '' },
    { kind: 'writing', title: 'Письмо', target: 1, why: '', pickGroup: 7 },
  ],
  facts,
)
check(
  'группа «на выбор» из одного пункта распущена — выбор из одного не выбор',
  lonely.every((i) => i.pickGroup == null),
)

const huge = applyRules(
  Array.from({ length: 12 }, (_, i) => ({ kind: 'free', title: `Дело ${i}`, target: 1, why: '' })),
  facts,
)
check(`набор обрезан до ${MAX_ITEMS} пунктов`, huge.length === MAX_ITEMS, `${huge.length}`)
check('при обрезке баланс сохранён, а не срезан первым', isBalanced(huge), missingSides(huge).join(','))

const empty = applyRules([{ kind: 'free', title: '   ', target: 1, why: '' }], facts)
check('пункт без заголовка выброшен', empty.every((i) => i.title.trim().length > 0))

// ---------------------------------------------------------------------------
// 5. Числительные. «32 новых слов» выглядит почти правильно — и потому живёт
//    в интерфейсе годами. Проверяем на числах, где формы расходятся.
// ---------------------------------------------------------------------------
console.log('\n— числительные —')

// Само правило — на числах, где все три формы расходятся. Форму «одно слово»
// проверяем здесь, а не через набор: правила НИКОГДА не дают одно новое слово
// (минимум — восемь за заход), и ждать её от заголовка бессмысленно.
const w = (n) => plural(n, 'новое слово', 'новых слова', 'новых слов')
check('1 → новое слово', w(1) === 'новое слово')
check('2 → новых слова', w(2) === 'новых слова')
check('5 → новых слов', w(5) === 'новых слов')
check('11 → новых слов (а не «новое»)', w(11) === 'новых слов')
check('21 → новое слово', w(21) === 'новое слово')
check('112 → новых слов (сотни не сбивают)', w(112) === 'новых слов')

const titleFor = (due) =>
  buildBaseline({ ...facts, dueCards: 0, days: due }).find((i) => i.kind === 'words').title
check('32 → «новых слова», а не «новых слов»', /32 новых слова$/.test(titleFor(7)), titleFor(7))
check('40 → «новых слов»', /40 новых слов$/.test(titleFor(9)), titleFor(9))

const whyFor = (dueCards) =>
  buildBaseline({ ...facts, dueCards }).find((i) => i.kind === 'words').why
check('1 карточка ЖДЁТ, а не ждут', whyFor(1).startsWith('1 карточка ждёт'), whyFor(1).slice(0, 24))
check('12 карточек ждут', whyFor(12).startsWith('12 карточек ждут'), whyFor(12).slice(0, 24))
check('2 карточки ждут', whyFor(2).startsWith('2 карточки ждут'), whyFor(2).slice(0, 24))

const b = balanceOf(base)
check(
  'счётчик сторон складывается в число пунктов',
  b.receptive + b.productive + b.review + b.other === base.length,
)

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
