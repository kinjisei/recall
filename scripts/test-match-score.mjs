/**
 * Счёт работы в баллах на клиенте (Ф2.25-1, журнал п.76 (8)): «Соедини пары»
 * — балл за каждую верную пару, остальные упражнения — 1.
 *
 * Случаи — общие с сервером (`_match-cases.mjs`): та же таблица гоняется через
 * `submit_material` тестовой базы в `check-material-match.mjs`. Здесь —
 * `workScore` (src/lib/assignmentScore.ts) и сверка выбора `normalizeChoice`
 * против SQL `norm_answer`. Плюс отметки учителя у пар и счёт по вердиктам.
 *
 * Краснеет, если пары считать целиком (одним баллом), если сверка пары
 * снимет знак с «й» (SQL его оставляет), если итог считать числом упражнений.
 *
 * Запуск: node scripts/test-match-score.mjs
 */
import { aiVerdict, exercisePoints, verdictPoints, workScore } from '../src/lib/assignmentScore.ts'
import { matchVerdicts, normalizeChoice } from '../src/lib/text.ts'
import { MATCH_CASES } from './_match-cases.mjs'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

// ── общие случаи с сервером ────────────────────────────────────────────────
for (const c of MATCH_CASES) {
  const s = workScore(c.exercises, c.answers)
  check(c.name, s.got === c.expect.got && s.of === c.expect.of, `получилось ${s.got} из ${s.of}`)
}

// ── сверка выбора = SQL norm_answer ────────────────────────────────────────
// norm_answer: trim (только пробелы) → translate знаков из своего списка →
// lower → схлопнуть пробелы. Строже печатного normalizeAnswer.
check('регистр и пробелы', normalizeChoice('  Выход  на ПОСАДКУ ') === 'выход на посадку')
check('знак над латиницей снят (é → e, ñ → n)', normalizeChoice('Café Niño') === 'cafe nino')
check('«й» и «ё» остаются', normalizeChoice('Посадочный ёж') === 'посадочный ёж')
check('апостроф остаётся: It’s ≠ Its', normalizeChoice("It's") !== normalizeChoice('Its'))
check('финальная точка остаётся (это выбор, а не набор)', normalizeChoice('Yes.') !== normalizeChoice('Yes'))

// ── пары по одной ──────────────────────────────────────────────────────────
const ex = MATCH_CASES[0].exercises[0]
check('баллов за пары — по числу пар', exercisePoints(ex) === 4)
check('за выбор ответа — 1', exercisePoints(MATCH_CASES[7].exercises[0]) === 1)
check(
  'отметка у каждой пары',
  JSON.stringify(matchVerdicts(ex, ['опоздать на рейс', 'выход на посадку', 'посадочный талон', 'багаж'])) === '[false,true,true,true]',
)
check('лишний вариант справа — неверная пара', matchVerdicts(ex, ['опоздать на рейс'])[0] === false)

// ── вердикты учителя (d18): отметка у пары ─────────────────────────────────
check('учитель засчитал пару вручную — 4 из 4', verdictPoints(ex, { index: 0, ok: false, comment: '', pairs: [true, true, true, true] }) === 4)
check('отметки у пар без общей — по парам', verdictPoints(ex, { index: 0, ok: true, comment: '', pairs: [false, true, true, true] }) === 3)
check('старый вердикт без пар — всё или ничего', verdictPoints(ex, { index: 0, ok: true, comment: '' }) === 4)
const whole = MATCH_CASES[7]
const reviewed = workScore(whole.exercises, whole.answers, [
  { index: 1, ok: true, comment: 'засчитано учителем' },
  { index: 3, ok: false, comment: '', pairs: [true, true, true, true] },
])
check('по вердиктам: где их нет — авто по ответу', reviewed.got === 8 && reviewed.of === 9, `получилось ${reviewed.got} из ${reviewed.of}`)

// ── AI-разбор поверх авто-проверки (Ф2.25-1б) ──────────────────────────────
const wrongDelay = MATCH_CASES[0].answers[0] // delay → «опоздать на рейс», остальные верны
check('AI молчит — у пар отметки авто-проверки', JSON.stringify(aiVerdict(ex, wrongDelay, 0, undefined).pairs) === '[false,true,true,true]')
check('AI засчитал пару — она засчитана', JSON.stringify(aiVerdict(ex, wrongDelay, 0, { ok: true, pairs: [true, true, true, true] }).pairs) === '[true,true,true,true]')
check('AI не снимает верную пару', JSON.stringify(aiVerdict(ex, wrongDelay, 0, { ok: false, pairs: [false, false, false, false] }).pairs) === '[false,true,true,true]')
check('у пар комментарий AI не берётся', aiVerdict(ex, wrongDelay, 0, { ok: false, comment: 'текст', pairs: [] }).comment === '')
const mcq = MATCH_CASES[7].exercises[0]
check('у выбора — вердикт и комментарий AI', JSON.stringify(aiVerdict(mcq, { index: 0, given: 'x', auto_ok: false }, 0, { ok: true, comment: 'синоним' })) === '{"index":0,"ok":true,"comment":"синоним"}')

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
