/**
 * Шаги мастера материала (src/features/teacher/materials/wizard.ts,
 * PLAN.md Ф2.11): «назад» не выбрасывает то, что уже составил AI.
 *
 * Держит:
 *   1. заявка → план → текст: «назад» к плану — текст впереди тот же; ещё
 *      «назад» — к форме, впереди план; «вперёд» дважды — тот же текст;
 *   2. пересоставили план — готовый текст впереди остаётся, а «назад» из
 *      него ведёт к НОВОМУ плану (он тоже стоил генерации);
 *   3. новый текст из плана и новый план из формы — новая ветка: прежнее
 *      впереди убирается;
 *   4. «Мой текст»: заявка → упражнения, «назад» — к форме, упражнения впереди;
 *   5. черновик прежнего вида (один шаг, до Ф2.11) восстанавливается с шагами
 *      позади; мусор — «мастер не начат».
 *
 * ⚠️ Ожидания — литералами (тексты 'C1', 'P2'…), а не из тех же функций.
 *
 * Запуск: node scripts/test-material-wizard.mjs
 */
import {
  START,
  advance,
  ahead,
  back,
  current,
  forward,
  fromDraft,
  replace,
} from '../src/features/teacher/materials/wizard.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const req = { lang: 'en', level: 'A2', topic: 'Горы', format: 'рассказ', lengthRange: '100-250', vocabulary: '', grammar: '', studentId: null }
const plan = (id) => ({ comments: id, vocabulary: [], grammar_focus: '', exercise_plan: [] })
const content = (id) => ({ title: id, body: `текст ${id}`, exercises: [] })
const where = (f) => {
  const s = current(f)
  return s.name === 'plan' ? `plan:${s.plan.comments}` : s.name === 'preview' ? `preview:${s.content.title}` : 'form'
}

// 1. туда и обратно без потерь
const planned = advance(START, { name: 'plan', req, plan: plan('P1') })
const written = advance(planned, { name: 'preview', req, plan: plan('P1'), content: content('C1') })
check('заявка → план → текст', where(written) === 'preview:C1', where(written))
const b1 = back(written)
check('«назад» из текста — к плану', where(b1) === 'plan:P1', where(b1))
check('…а текст впереди тот же', ahead(b1)?.content?.title === 'C1')
const b2 = back(b1)
check('ещё «назад» — к форме', where(b2) === 'form', where(b2))
check('…впереди план', ahead(b2)?.name === 'plan' && ahead(b2)?.plan.comments === 'P1')
check('«вперёд» дважды — тот же текст', where(forward(forward(b2))) === 'preview:C1')
check('«назад» с формы — остаётся форма', where(back(b2)) === 'form' && ahead(back(b2))?.name === 'plan')
check('«вперёд» с последнего шага — остаётся', where(forward(written)) === 'preview:C1')

// 2. пересоставили план — текст впереди жив, новый план не теряется
const replanned = replace(b1, { name: 'plan', req, plan: plan('P2') })
check('пересоставили план — на экране новый', where(replanned) === 'plan:P2')
check('…готовый текст впереди остался', ahead(replanned)?.content?.title === 'C1')
const toText = forward(replanned)
check('…к нему — со своим планом (сохранится согласованная пара)', current(toText).plan?.comments === 'P1' && where(toText) === 'preview:C1')
check('…«назад» из текста — к новому плану P2', where(back(toText)) === 'plan:P2')
const regen = replace(written, { ...current(written), content: content('C1b') })
check('перегенерировали текст — тот же шаг', where(regen) === 'preview:C1b' && regen.steps.length === 3)

// 3. новый результат дальше — новая ветка
const rewritten = advance(b1, { name: 'preview', req, plan: plan('P1'), content: content('C2') })
check('новый текст из плана заменяет прежний', where(rewritten) === 'preview:C2' && rewritten.steps.length === 3)
const replannedFromForm = advance(b2, { name: 'plan', req, plan: plan('P3') })
check('новый план из формы убирает прежние план и текст', where(replannedFromForm) === 'plan:P3' && !ahead(replannedFromForm))

// 4. «Мой текст»
const own = advance(START, { name: 'preview', req, plan: plan('—'), content: content('O1'), own: true })
check('«Мой текст»: «назад» — к форме', where(back(own)) === 'form')
check('…упражнения впереди', ahead(back(own))?.content?.title === 'O1')

// 5. черновик
check('черновик нового вида — как был', where(fromDraft(JSON.parse(JSON.stringify(b1)))) === 'plan:P1')
const legacyPlan = fromDraft({ name: 'plan', req, plan: plan('L1') })
check('прежний черновик «план» — на плане, позади форма', where(legacyPlan) === 'plan:L1' && where(back(legacyPlan)) === 'form')
const legacyText = fromDraft({ name: 'preview', req, plan: plan('L2'), content: content('LC') })
check('прежний «текст» — позади его план', where(legacyText) === 'preview:LC' && where(back(legacyText)) === 'plan:L2')
const legacyOwn = fromDraft({ name: 'preview', req, plan: plan('—'), content: content('LO'), own: true })
check('прежний «Мой текст» — позади форма', where(back(legacyOwn)) === 'form')
check('прежний «форма» — форма', where(fromDraft({ name: 'form' })) === 'form')
check('пусто и мусор — мастер не начат', [null, undefined, 'x', 7, {}, { name: 'list' }, { steps: [{ name: 'zzz' }], at: 0 }].every((v) => fromDraft(v) === null))
check('указатель за краем — на последнем шаге', where(fromDraft({ ...written, at: 9 })) === 'preview:C1')

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
