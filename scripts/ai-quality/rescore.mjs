/**
 * Пересчёт балла письма на сохранённых ответах (PLAN.md Ф2.20-4, журнал п.77):
 * `node scripts/check-ai-writing.mjs --rescore=<папка прогона> [--t7=…] [--t8=…] [--round=down,half]`.
 *
 * Итог IELTS считает наш код (`domains/writing/examiner.ts`), а факты о
 * работе даёт модель. Оба куска уже лежат в `answers.json` прогона: лист
 * экзаменатора (`results[].output.raw` — ступени, ограничивающие признаки,
 * правки) и текст работы (`input[].essay`). Поэтому варианты калибровки —
 * пороги доли предложений без ошибок и округление итога — сравниваются без
 * единого запроса к AI, без базы и ключа.
 *
 * Пересчёт зовёт НАСТОЯЩИЕ `parseIelts`, `textFacts` и `scoreIelts`. Своего
 * здесь два места:
 *   • в какую ступень по доле без ошибок попадает работа при пороге
 *     варианта — граница та же, что в `codeLimits` (меньше `t7` — «часто»,
 *     не больше `t8` — «большинство»); `scoreIelts` получает долю-
 *     представителя этой ступени при ТЕКУЩИХ порогах и сам ставит потолок;
 *   • округление итога: «вниз» (до половины балла, как `roundBand` сейчас) и
 *     «до ближайшей половины» (.25 → .5, .75 → целое вверх — как общий балл
 *     теста IELTS). Какое из них у приложения сейчас, пересчёт узнаёт по
 *     самому `roundBand`, а пороги берёт из examiner.ts — поменяли их там,
 *     «сейчас» поменялся и здесь.
 * Мерки — те же функции, что у живой проверки: П6 — `bandRow`, П11 — `biasRow`.
 *
 * ⚠️ Импортировать динамически и после `loader.mjs` (код приложения на TS).
 * Держит scripts/test-writing-rescore.mjs.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { CRITERIA, ERROR_FREE_FOR_7, ERROR_FREE_FOR_8, roundBand, scoreIelts, textFacts } from '../../src/domains/writing/index.ts'
import { ieltsKind, parseIelts } from '../../src/lib/writingGrade.ts'
import { bandRow } from './rules.mjs'
import { biasRow } from './rules-official.mjs'

export const ROUNDS = { down: 'вниз', half: 'до ближайшей половины' }
/** Итог из среднего четырёх критериев; .25 и .75 у «до ближайшей» — вверх (общий балл IELTS). */
const ROUND = {
  down: (avg) => Math.floor(avg * 2 + 1e-9) / 2,
  half: (avg) => Math.floor(avg * 2 + 0.5 + 1e-9) / 2,
}
export const roundHalf = ROUND.half

/** Какое округление у `roundBand` сейчас — по четырём средним, а не на слово. */
const CURRENT_ROUND = Object.keys(ROUND).find((k) => [5, 5.25, 5.5, 5.75].every((a) => ROUND[k](a) === roundBand(a)))
if (!CURRENT_ROUND) throw new Error('roundBand в examiner.ts округляет не вниз и не до ближайшей половины: дополни ROUND в rescore.mjs')
/** Как считает приложение сейчас: пороги и округление — из examiner.ts. */
export const CURRENT = Object.freeze({ name: 'сейчас', t7: ERROR_FREE_FOR_7, t8: ERROR_FREE_FOR_8, round: CURRENT_ROUND })
const FLAGS = ['--rescore=', '--t7=', '--t8=', '--round=']
/** Вариантов, кроме «сейчас»: больше — таблица шире экрана. */
export const MAX_VARIANTS = 12

/** Ступень по доле предложений без ошибок — граница как в `codeLimits` (examiner.ts). */
export function errorTier(errorFree, v) {
  return errorFree < v.t7 ? 'frequent' : errorFree <= v.t8 ? 'majority' : 'none'
}

/** Доля-представитель ступени при текущих порогах: по ней `scoreIelts` ставит потолок этой ступени. */
const AS_CURRENT = { frequent: 0, majority: ERROR_FREE_FOR_7, none: 1 }
for (const [tier, share] of Object.entries(AS_CURRENT)) {
  if (errorTier(share, CURRENT) !== tier) {
    throw new Error(`пересчёт не выражает пороги examiner.ts (${ERROR_FREE_FOR_7} / ${ERROR_FREE_FOR_8}): поправь AS_CURRENT в rescore.mjs`)
  }
}

/**
 * Варианты из флагов `--t7=0.3,0.4 --t8=0.5 --round=down,half` — все
 * сочетания (запятая разделяет варианты, дробь — с точкой); не названный флаг
 * берёт текущее значение. Первый — всегда «сейчас»; вариант, совпавший с ним,
 * не повторяется.
 */
export function parseVariants(argv) {
  const bad = argv.filter((a) => a.startsWith('--') && !FLAGS.some((f) => a.startsWith(f)))
  if (bad.length) throw new Error(`с --rescore лишние флаги: ${bad.join(' ')} (пересчёт AI не зовёт; есть ${FLAGS.join('… ')}…)`)
  const list = (name) => {
    const arg = argv.findLast((a) => a.startsWith(`--${name}=`))
    return arg === undefined ? null : arg.slice(name.length + 3).split(',').map((s) => s.trim())
  }
  const share = (name, fallback) =>
    (list(name) ?? [String(fallback)]).map((s) => {
      const n = Number(s)
      if (s === '' || !Number.isFinite(n) || n <= 0 || n >= 1) {
        throw new Error(`--${name}: «${s}» — нужна доля предложений без ошибок от 0 до 1 с точкой (0.35); запятая разделяет варианты`)
      }
      return n
    })
  const t7s = share('t7', CURRENT.t7)
  const t8s = share('t8', CURRENT.t8)
  const rounds = list('round') ?? [CURRENT.round]
  for (const r of rounds) if (!ROUNDS[r]) throw new Error(`--round: «${r}» — нужно down (вниз) или half (до ближайшей половины)`)

  const out = [CURRENT]
  const same = (a, b) => a.t7 === b.t7 && a.t8 === b.t8 && a.round === b.round
  for (const t7 of t7s) {
    for (const t8 of t8s) {
      if (t7 > t8) throw new Error(`порог 7 (${t7}) выше порога 8 (${t8}): ступень 7 требовала бы больше предложений без ошибок, чем 8`)
      for (const round of rounds) {
        const v = { t7, t8, round }
        if (!out.some((x) => same(x, v))) out.push({ name: String.fromCharCode(64 + out.length), ...v })
      }
    }
  }
  if (out.length - 1 > MAX_VARIANTS) throw new Error(`вариантов ${out.length - 1} — таблица не влезет; не больше ${MAX_VARIANTS} за раз`)
  return out
}

/**
 * Балл одной работы при варианте `v`. `ex` — пример из `input`, `raw` — лист
 * модели. Лист до п.77 (ступени числами, без шкалы) не пересчитывается.
 */
export function rescoreSheet(ex, raw, v) {
  const c = raw?.criteria
  if (!c || CRITERIA.some(({ key }) => typeof c[key] !== 'object' || c[key] === null)) {
    throw new Error('лист без ступеней шкалы по критериям (прогон до п.77?) — пересчитать нельзя')
  }
  const kind = ieltsKind(ex.task)
  // настоящий разбор: проверка полноты и правки с тем же видом, что у приложения
  const grade = parseIelts(JSON.stringify(raw), ex.essay, kind)
  const marks = Object.fromEntries(CRITERIA.map(({ key }) => [key, { band: c[key].band, next: null }]))
  const modelLimits = (Array.isArray(raw.limits) ? raw.limits : []).filter((x) => typeof x === 'string' && x)
  const facts = textFacts(ex.essay, grade.errors.filter((e) => e.type === 'grammar').map((e) => e.was))
  const share = facts.errorFree
  const r = scoreIelts(kind, marks, modelLimits, share === null ? facts : { ...facts, errorFree: AS_CURRENT[errorTier(share, v)] })
  const avg = CRITERIA.reduce((s, { key }) => s + r.criteria[key], 0) / CRITERIA.length
  return {
    band: ROUND[v.round](avg),
    criteria: r.criteria,
    limits: r.limits.map((l) => l.id),
    errorFree: share,
    sentences: facts.sentences,
  }
}

/**
 * Весь прогон: работы IELTS с эталоном — официальные (балл экзаменатора) и
 * наши (коридор). Обычные эссе (CEFR), задания и итоговые строки — мимо:
 * пороги и округление их не касаются.
 */
export function rescoreRun(answers, variants) {
  const input = new Map((answers.input ?? []).map((e) => [e.id, e]))
  const official = []
  const ours = []
  const skipped = []
  for (const r of answers.results ?? []) {
    const ex = input.get(r.id)
    if (ex?.task?.mode !== 'ielts' || !ex.expect?.band) continue
    if (r.status !== 'ok' || !r.output?.raw) {
      skipped.push({ id: r.id, why: r.error ?? (r.status === 'ok' ? 'ответ модели не разобран (О1)' : r.status) })
      continue
    }
    try {
      const bands = variants.map((v) => rescoreSheet(ex, r.output.raw, v))
      const item = { id: r.id, corridor: ex.expect.band, ran: r.output.grade?.band ?? null, bands }
      if (typeof ex.official === 'number') official.push({ ...item, official: ex.official })
      else ours.push(item)
    } catch (e) {
      skipped.push({ id: r.id, why: e.message })
    }
  }
  const stats = variants.map((_, i) => {
    const p6 = (list) => list.filter((x) => bandRow(x.corridor, x.bands[i]).ok).length
    const bias = official.length ? biasRow(official.map((x) => ({ id: x.id, official: x.official, band: x.bands[i].band }))) : null
    return { bias: bias?.stats ?? null, p11: bias?.ok ?? null, p6: p6(official), p6ours: p6(ours) }
  })
  return { official, ours, skipped, stats }
}

// ── печать ──────────────────────────────────────────────────────────────────

const num = (n) => String(n).replace('.', ',')
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + num(Math.abs(n))
const two = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2).replace('.', ',')
const mark = (ok) => (ok ? '✓' : '✗')

function table(rows) {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i] ?? '').length)))
  return rows.map((r) => r.map((c, i) => String(c ?? '').padEnd(w[i])).join('  ').trimEnd()).join('\n')
}

export function variantLine(v) {
  const how = `порог 7: ${num(v.t7)} · порог 8: ${num(v.t8)} · округление ${ROUNDS[v.round]}`
  return `${v.name.padEnd(6)} — ${how}${v === CURRENT ? ' (examiner.ts)' : ''}`
}

/** Отчёт пересчёта текстом: варианты, таблица официальных работ с итогом П6/П11, наши примеры. */
export function formatRescore(rep, variants, source) {
  const out = [`Пересчёт балла письма без AI: ${source}`, '', 'Варианты:', ...variants.map((v) => `  ${variantLine(v)}`)]
  const share = ({ bands: [b] }) => (b.errorFree === null ? '—' : `${Math.round(b.errorFree * b.sentences)} из ${b.sentences} (${num(b.errorFree.toFixed(2))})`)
  const changed = [...rep.official, ...rep.ours].filter((x) => x.ran !== null && x.ran !== x.bands[0].band)
  const ran = (x) => (x.ran === null ? '—' : num(x.ran) + (changed.includes(x) ? '*' : ''))

  out.push(
    '',
    '«в прогоне» — балл, который записал прогон; «без ошибок» — предложений без грамматических правок (доля сравнивается с порогами;',
    '«—» — правки не нашлись в тексте, доле код не верит). В колонке варианта — балл и разница с эталоном.',
  )
  out.push('', 'Официальные работы IELTS — П6: каждая в ±0,5 от экзаменатора; П11: средний сдвиг в ±0,25')
  if (rep.official.length) {
    const head = ['работа', 'экзаменатор', 'в прогоне', 'без ошибок', ...variants.map((v) => v.name)]
    const rows = rep.official.map((x) => [
      x.id,
      num(x.official),
      ran(x),
      share(x),
      ...x.bands.map((b) => `${num(b.band)} (${signed(b.band - x.official)})${Math.abs(b.band - x.official) > 0.5 ? ' ✗' : ''}`),
    ])
    const blank = ['', '', '', '']
    const s = rep.stats
    rows.push(
      ['сдвиг', ...blank.slice(1), ...s.map((x) => two(x.bias.bias))],
      ['разброс', ...blank.slice(1), ...s.map((x) => x.bias.mae.toFixed(2).replace('.', ','))],
      ['П6: в ±0,5', ...blank.slice(1), ...s.map((x) => `${x.p6} из ${rep.official.length} ${mark(x.p6 === rep.official.length)}`)],
      ['П11: сдвиг', ...blank.slice(1), ...s.map((x) => mark(x.p11))],
    )
    out.push(table([head, ...rows]))
  } else {
    out.push('  в прогоне нет официальных работ с ответом (нет essays.json или не дошла очередь)')
  }

  if (rep.ours.length) {
    out.push('', 'Наши примеры IELTS — П6: в коридоре эталона')
    const head = ['работа', 'эталон', 'в прогоне', 'без ошибок', ...variants.map((v) => v.name)]
    const rows = rep.ours.map((x) => [
      x.id,
      x.corridor.map(num).join('–'),
      ran(x),
      share(x),
      ...x.bands.map((b) => `${num(b.band)} ${mark(bandRow(x.corridor, b).ok)}`),
    ])
    rows.push(['П6', '', '', '', ...rep.stats.map((x) => `${x.p6ours} из ${rep.ours.length} ${mark(x.p6ours === rep.ours.length)}`)])
    out.push(table([head, ...rows]))
  }
  if (changed.length) out.push('', `* «сейчас» не совпал с баллом прогона у ${changed.length}: код экзаменатора менялся после прогона`)
  for (const s of rep.skipped) out.push(`… не пересчитана: ${s.id} — ${s.why}`)
  return out.join('\n')
}

/** Папка прогона (или сам answers.json); короткое имя ищется и в scripts/ai-quality/runs/. */
export function findAnswers(arg) {
  const here = resolve(arg)
  const runs = new URL(`runs/${arg}`, import.meta.url)
  for (const p of [here, decodeURIComponent(runs.pathname).replace(/^\/([A-Za-z]:)/, '$1')]) {
    if (!existsSync(p)) continue
    const file = statSync(p).isDirectory() ? resolve(p, 'answers.json') : p
    if (existsSync(file)) return file
  }
  return null
}

/** Режим `--rescore` целиком; возвращает код выхода. */
export function rescoreCli(argv) {
  const arg = argv.find((a) => a.startsWith('--rescore='))?.slice('--rescore='.length)
  let variants
  try {
    if (!arg) throw new Error('нужна папка прогона: --rescore=scripts/ai-quality/runs/writing-…')
    variants = parseVariants(argv)
  } catch (e) {
    console.error(e.message)
    return 1
  }
  const file = findAnswers(arg)
  if (!file) {
    console.error(`нет answers.json в «${arg}» (ни по этому пути, ни в scripts/ai-quality/runs/)`)
    return 1
  }
  const answers = JSON.parse(readFileSync(file, 'utf8'))
  if (answers.task !== 'writing') {
    console.error(`это прогон «${answers.task}», а пересчитывается только письмо (writing)`)
    return 1
  }
  const rep = rescoreRun(answers, variants)
  console.log(formatRescore(rep, variants, file))
  if (!rep.official.length && !rep.ours.length) {
    console.error('\nПересчитывать нечего: в прогоне нет работ IELTS с ответом модели.')
    return 1
  }
  return 0
}
