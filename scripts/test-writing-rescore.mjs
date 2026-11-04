/**
 * Пересчёт балла письма на сохранённом прогоне (scripts/ai-quality/rescore.mjs,
 * PLAN.md Ф2.20-4): `check-ai-writing --rescore=<папка>` обязан давать при
 * текущих порогах тот же балл, что код приложения, а при вариантах порогов и
 * округления — тот, что дал бы код с этими порогами. Иначе калибровка по
 * пересчёту поменяет examiner.ts не туда.
 *
 * Прогон — выдуманный, той же формы, что answers.json (`fakeWritingRun` в
 * ai-quality/fake-answers.mjs): настоящих ответов и официальных работ в git нет.
 * ⚠️ Ожидания — литералами (посчитаны руками по шкале и examiner.ts), а не из
 * тех же функций.
 *
 * Запуск: node scripts/test-writing-rescore.mjs
 */
import './ai-quality/loader.mjs'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fakeWritingRun } from './ai-quality/fake-answers.mjs'

// код приложения на TS — динамически, после загрузчика (ai-quality/loader.mjs)
const R = await import('./ai-quality/rescore.mjs')
const { parseIelts, ieltsKind } = await import('../src/lib/writingGrade.ts')
const W = await import('../src/domains/writing/index.ts')

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const show = (x) => JSON.stringify(x)

const run = fakeWritingRun()
const exOf = (id) => run.input.find((e) => e.id === id)
const rawOf = (id) => run.results.find((r) => r.id === id).output.raw
const ielts = run.results.filter((x) => x.status === 'ok' && exOf(x.id)?.task.mode === 'ielts')
/**
 * Пороги и округление, при которых «записан» выдуманный прогон. Ожидания
 * ниже — при явных порогах, а не при тех, что сейчас в examiner.ts:
 * калибровка поменяет их там, а тест пересчёта краснеть не должен.
 */
const RUN_AT = { t7: 0.35, t8: 0.5, round: 'down' }
const score = (id, v) => R.rescoreSheet(exOf(id), rawOf(id), { ...RUN_AT, ...v })

// ── «сейчас» = код приложения: тот же балл, что настоящий parseIelts ────────
const C = R.CURRENT
check('«сейчас» — пороги examiner.ts', C.t7 === W.ERROR_FREE_FOR_7 && C.t8 === W.ERROR_FREE_FOR_8, show(C))
// у b, c, d среднее с .25 и .75 — сверка ниже ловит и чужое округление
for (const r of ielts) {
  const ex = exOf(r.id)
  const g = parseIelts(r.calls[0].text, ex.essay, ieltsKind(ex.task))
  const got = R.rescoreSheet(ex, r.output.raw, R.CURRENT)
  check(`${r.id}: «сейчас» = parseIelts (${g.band})`, got.band === g.band && eq(got.criteria, g.criteria), `${got.band} ${show(got.criteria)}`)
}

// ── при порогах прогона — балл прогона ──────────────────────────────────────
const RAN = { 'off-fake-a': 6.5, 'off-fake-b': 7, 'off-fake-c': 5, 'off-fake-d': 4.5, 'ielts-t2-55': 5.5 }
for (const [id, band] of Object.entries(RAN)) {
  const got = score(id, {})
  const ran = run.results.find((r) => r.id === id).output.grade.band
  check(`${id}: при 0,35 / 0,5, вниз — ${band}, как в прогоне`, got.band === band && ran === band, `пересчёт ${got.band}, прогон ${ran}`)
}

// ── пороги варианта ─────────────────────────────────────────────────────────
let s = score('off-fake-a', {})
check('a: доля — только грамматика (правка vocab не в счёт): 4 из 10', s.errorFree === 0.4 && s.sentences === 10, `${s.errorFree} из ${s.sentences}`)
check('a: при 0,35 — «большинство», Grammar 7', s.criteria.grammar === 7 && s.limits.includes('errors_majority'), show(s))
s = score('off-fake-a', { t7: 0.45 })
check('a: порог 7 = 0,45 — «часто», Grammar 6, итог 6', s.band === 6 && s.criteria.grammar === 6 && s.limits.includes('errors_frequent'), show(s))
s = score('off-fake-a', { t7: 0.4 })
check('a: порог 7 = 0,4 ровно — ещё не «часто» (меньше порога), итог 6,5', s.band === 6.5 && s.criteria.grammar === 7, show(s))
s = score('off-fake-a', { t7: 0.45, round: 'half' })
check('a: 0,45 и до половины — 6,25 → 6,5', s.band === 6.5, show(s))

s = score('off-fake-b', {})
check('b: 0,6 при пороге 8 = 0,5 — без потолка, 7/7/7/8 = 7,25 вниз → 7', s.band === 7 && s.criteria.grammar === 8 && s.limits.length === 0, show(s))
s = score('off-fake-b', { round: 'half' })
check('b: до половины — 7,5', s.band === 7.5, show(s))
s = score('off-fake-b', { t8: 0.6, round: 'half' })
check('b: порог 8 = 0,6 ровно — «большинство» (не больше порога), Grammar 7, итог 7', s.band === 7 && s.criteria.grammar === 7, show(s))
s = score('off-fake-b', { t8: 0.55, round: 'half' })
check('b: порог 8 = 0,55 — 0,6 выше, потолка нет, 7,5', s.band === 7.5 && s.criteria.grammar === 8, show(s))

s = score('off-fake-c', {})
check('c: потолок модели «incomplete» — Task 5, итог 5,25 вниз → 5', s.band === 5 && s.criteria.task === 5 && s.limits.includes('incomplete'), show(s))
s = score('off-fake-c', { round: 'half' })
check('c: до половины — 5,5', s.band === 5.5, show(s))

s = score('off-fake-d', {})
check('d: один абзац — потолок кода «no_paragraphs», Coherence 5, итог 4,5', s.band === 4.5 && s.criteria.coherence === 5 && s.limits.includes('no_paragraphs'), show(s))
s = score('off-fake-d', { round: 'half' })
check('d: до половины — 4,75 → 5', s.band === 5, show(s))

check('округление до половины: 5,25 → 5,5; 5,75 → 6; 5,5 → 5,5; 5 → 5', R.roundHalf(5.25) === 5.5 && R.roundHalf(5.75) === 6 && R.roundHalf(5.5) === 5.5 && R.roundHalf(5) === 5)

// ── варианты из флагов ──────────────────────────────────────────────────────
const brief = (vs) => vs.map((v) => `${v.name}:${v.t7}/${v.t8}/${v.round}`)
const now = `сейчас:${C.t7}/${C.t8}/${C.round}`
check('без флагов — один вариант «сейчас»', eq(brief(R.parseVariants(['--rescore=x'])), [now]))
const combos = brief(R.parseVariants(['--rescore=x', '--t7=0.41,0.47', '--t8=0.53', '--round=down,half']))
check(
  'сочетания флагов: 2 порога × 2 округления, первый — «сейчас»',
  eq(combos, [now, 'A:0.41/0.53/down', 'B:0.41/0.53/half', 'C:0.47/0.53/down', 'D:0.47/0.53/half']),
  show(combos),
)
const other = C.round === 'down' ? 'half' : 'down'
const dup = brief(R.parseVariants([`--t7=${C.t7}`, `--t8=${C.t8}`, `--round=${C.round},${other}`]))
check('вариант, равный текущему, не повторяется', eq(dup, [now, `A:${C.t7}/${C.t8}/${other}`]), show(dup))
check('не названный флаг — текущее значение', eq(brief(R.parseVariants(['--t7=0.11'])).at(-1), `A:0.11/${C.t8}/${C.round}`))
const throws = (argv) => {
  try {
    R.parseVariants(argv)
    return false
  } catch {
    return true
  }
}
check('порог 7 выше порога 8 — ошибка', throws(['--t7=0.6', '--t8=0.5']))
check('доля вне 0…1 и не число — ошибка', throws(['--t8=1.2']) && throws(['--t7=abc']) && throws(['--t7=']))
check('неизвестное округление — ошибка', throws(['--round=up']))
check('чужой флаг (--only, --limit) — ошибка, а не тихий пропуск', throws(['--only=off-x']) && throws(['--limit=5']))
check(
  'больше 12 вариантов — ошибка, 12 — можно',
  throws(['--t7=0.1,0.2,0.3', '--t8=0.6,0.7,0.8', '--round=down,half']) && !throws(['--t7=0.11,0.21,0.31', '--t8=0.61,0.71', '--round=down,half']),
)

// ── весь прогон: кто считается, кто нет, сдвиг и разброс ────────────────────
const vs = [{ name: 'прогон', ...RUN_AT }, { name: 'A', t7: 0.45, t8: 0.5, round: 'down' }, { name: 'B', t7: 0.35, t8: 0.5, round: 'half' }]
const rep = R.rescoreRun(fakeWritingRun(), vs)
check('официальные — a, b, c, d', eq(rep.official.map((x) => x.id), ['off-fake-a', 'off-fake-b', 'off-fake-c', 'off-fake-d']), show(rep.official.map((x) => x.id)))
check('наши IELTS — ielts-t2-55; обычное эссе и итоговая строка — мимо', eq(rep.ours.map((x) => x.id), ['ielts-t2-55']), show(rep.ours.map((x) => x.id)))
check('без ответа — названа с причиной', eq(rep.skipped, [{ id: 'off-fake-e', why: 'лимит 20 запросов' }]), show(rep.skipped))
check('балл по вариантам у d: 4,5 / 4,5 / 5', eq(rep.official[3].bands.map((b) => b.band), [4.5, 4.5, 5]), show(rep.official[3].bands.map((b) => b.band)))
const stat = (i) => {
  const x = rep.stats[i]
  return [x.bias.bias, x.bias.mae, x.bias.within, x.p6, x.p11, x.p6ours]
}
// прогон: +0,5 0 0 +0,5; A: 0 0 0 +0,5; B: +0,5 +0,5 +0,5 +1
check('при порогах прогона: сдвиг +0,25, разброс 0,25, П6 4 из 4, П11 ✓', eq(stat(0), [0.25, 0.25, 4, 4, true, 1]), show(stat(0)))
check('A (порог 7 = 0,45): сдвиг +0,125, разброс 0,125, П11 ✓', eq(stat(1), [0.125, 0.125, 4, 4, true, 1]), show(stat(1)))
check('B (до половины): сдвиг +0,625, П6 3 из 4, П11 ✗', eq(stat(2), [0.625, 0.625, 3, 3, false, 1]), show(stat(2)))

// лист до п.77 (ступени числами) — не пересчитывается, а называется
const old = fakeWritingRun()
old.results.find((r) => r.id === 'off-fake-a').output.raw = { band: 6, criteria: { task: 6, coherence: 6, lexis: 6, grammar: 6 } }
const oldRep = R.rescoreRun(old, [R.CURRENT])
check(
  'лист без шкалы (до п.77) — пропущен с причиной',
  oldRep.official.length === 3 && oldRep.skipped.some((x) => x.id === 'off-fake-a' && x.why.includes('до п.77')),
  show(oldRep.skipped),
)

// ── сам режим --rescore: без AI, базы и ключа ───────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'recall-rescore-'))
try {
  const dir = join(tmp, 'writing-fake')
  mkdirSync(dir)
  writeFileSync(join(dir, 'answers.json'), JSON.stringify(fakeWritingRun()))
  const script = fileURLToPath(new URL('./check-ai-writing.mjs', import.meta.url))
  const cli = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  const line = (out, start) => out.split('\n').find((l) => l.startsWith(start)) ?? ''
  // последний столбец — вариант 0,45 / 0,5 / вниз (или «сейчас», если это он и есть): от examiner.ts не зависит
  let r = cli(`--rescore=${dir}`, '--t7=0.45', '--t8=0.5', '--round=down')
  check('--rescore: выход 0', r.status === 0, `код ${r.status}: ${r.stderr}`)
  check('--rescore: строка работы a — экзаменатор 6, в прогоне 6,5, при 0,45 — 6 (0)', /^off-fake-a\s+6\s+6,5\s.*\s6 \(0\)$/.test(line(r.stdout, 'off-fake-a')), line(r.stdout, 'off-fake-a'))
  check('--rescore: у d без ошибок 3 из 10 (0,30)', line(r.stdout, 'off-fake-d').includes('3 из 10 (0,30)'), line(r.stdout, 'off-fake-d'))
  check('--rescore: сдвиг при 0,45 — +0,13', /\s\+0,13$/.test(line(r.stdout, 'сдвиг')), line(r.stdout, 'сдвиг'))
  check('--rescore: пропущенная работа названа', r.stdout.includes('не пересчитана: off-fake-e — лимит 20 запросов'))

  const changed = fakeWritingRun()
  changed.results.find((x) => x.id === 'off-fake-b').output.grade.band = 9 // такого балла код у b не даст ни при каких порогах
  writeFileSync(join(dir, 'answers.json'), JSON.stringify(changed))
  r = cli(`--rescore=${dir}`)
  check('--rescore: «сейчас» не совпал с прогоном — звёздочка и пояснение', line(r.stdout, 'off-fake-b').includes(' 9* ') && r.stdout.includes('код экзаменатора менялся после прогона'), r.stdout)

  r = cli(`--rescore=${join(tmp, 'нет-такой')}`)
  check('--rescore: нет папки — выход 1', r.status === 1 && r.stderr.includes('нет answers.json'), r.stderr)
  r = cli(`--rescore=${dir}`, '--t7=0.9', '--t8=0.5')
  check('--rescore: порог 7 выше 8 — выход 1', r.status === 1 && r.stderr.includes('выше порога 8'), r.stderr)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log(`\n${pass} ✓, ${fail} ✗`)
process.exit(fail ? 1 : 0)
