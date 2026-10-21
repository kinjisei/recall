/**
 * Подписи письменного задания у учителя (src/features/teacher/writing/
 * writingFacts.ts, макет d9-1, PLAN.md Ф2.17-4в-3).
 *
 * Держит:
 *   1. строка вида: IELTS — тип и band «6.0», а не «6»; эссе — язык и уровень;
 *   2. ярлык подробностей: тип и жанр (эссе, письмо, описание графика);
 *   3. плитки: IELTS — балл, объём и время по типу; эссе — уровень, объём
 *      (без минимума — «любой»), язык;
 *   4. сводка выдач без нулей, никому — «не назначено».
 *
 * ⚠️ Ожидания — литералами, а не из тех же функций.
 *
 * Запуск: node scripts/test-writing-facts.mjs
 */
import { bandText, ieltsHint, kindChip, kindLine, tally, tallyLine, taskFacts } from '../src/features/teacher/writing/writingFacts.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const t2 = { mode: 'ielts', lang: 'en', level: 'B2', settings: { ieltsTask: 'task2', targetBand: 6.5 } }
const gt = { mode: 'ielts', lang: 'en', level: 'B2', settings: { ieltsTask: 'gt1', targetBand: 6 } }
const ac = { mode: 'ielts', lang: 'en', level: 'B2', settings: { ieltsTask: 'academic1', targetBand: '7.0' } }
const es = { mode: 'regular', lang: 'es', level: 'A2', settings: { minWords: 80 } }
const en = { mode: 'regular', lang: 'en', level: 'B1', settings: null }

// 1. строка вида
check('IELTS Task 2', kindLine(t2) === 'IELTS · Task 2 · band 6.5', kindLine(t2))
check('band 6 → «6.0»', kindLine(gt) === 'IELTS · GT Task 1 · band 6.0', kindLine(gt))
check('band строкой из старых заданий', kindLine(ac) === 'IELTS · Academic Task 1 · band 7.0', kindLine(ac))
check('эссе — язык и уровень', kindLine(es) === 'Эссе · ES · A2', kindLine(es))
check('без балла — без «band»', kindLine({ ...t2, settings: { ieltsTask: 'task2' } }) === 'IELTS · Task 2')
check('пустой балл — пусто', bandText('') === '' && bandText(null) === '' && bandText('abc') === '')

// 2. ярлык
check('ярлык Task 2 — эссе', kindChip(t2) === 'IELTS · Task 2 · эссе', kindChip(t2))
check('ярлык GT — письмо', kindChip(gt) === 'IELTS · GT Task 1 · письмо')
check('ярлык Academic — описание графика', kindChip(ac) === 'IELTS · Academic Task 1 · описание графика')
check('ярлык эссе', kindChip(en) === 'Эссе · английский · B1', kindChip(en))
check('подпись типа в «Новом письме»', ieltsHint('task2') === 'эссе · от 250 слов · 40 минут' && ieltsHint('gt1') === 'письмо · от 150 слов · 20 минут')

// 3. плитки
check('плитки Task 2', eq(taskFacts(t2), [{ label: 'Целевой балл', value: '6.5' }, { label: 'Объём', value: 'от 250 слов' }, { label: 'Время', value: '40 минут' }]), JSON.stringify(taskFacts(t2)))
check('плитки Academic — 150 слов, 20 минут', taskFacts(ac)[1].value === 'от 150 слов' && taskFacts(ac)[2].value === '20 минут')
check('плитки эссе', eq(taskFacts(es), [{ label: 'Уровень', value: 'A2' }, { label: 'Объём', value: 'от 80 слов' }, { label: 'Язык', value: 'испанский' }]), JSON.stringify(taskFacts(es)))
check('эссе без минимума — «любой»', taskFacts(en)[1].value === 'любой')

// 4. сводка
const list = [{ status: 'submitted' }, { status: 'reviewed' }, { status: 'assigned' }]
check('1 сдано · 1 проверено · 1 назначено', tallyLine(tally(list)) === '1 сдано · 1 проверено · 1 назначено', tallyLine(tally(list)))
check('без нулей', tallyLine(tally([{ status: 'reviewed' }, { status: 'reviewed' }])) === '2 проверено')
check('никому — «не назначено»', tallyLine(tally([])) === 'не назначено')

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
