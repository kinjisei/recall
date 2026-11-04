/**
 * Критерии 🤖 из criteria.md — то, что проверка качества AI сверяет сама, без
 * второй модели (PLAN.md Ф2.20). Чистый модуль: ни сети, ни базы — его
 * держит `scripts/test-ai-quality-rules.mjs` (каждое правило краснеет на
 * подложенном плохом ответе).
 *
 * Правило возвращает строки `{ id, ok, detail }`; `id` — номер критерия из
 * criteria.md, вес (Ж/М) берётся оттуда же. Критерий, к примеру не
 * относящийся, строки не даёт.
 */

import { readFileSync } from 'node:fs'
import { inText, irregularFromEnglish, irregularFromSpanish } from '../../src/lib/wordForms.ts'
import { irregularGroups } from '../../src/data/english/irregular.ts'
import { formatById, formatOf, normalizeRows } from '../../src/lib/exerciseFormats.ts'

const CYR = /[а-яё]/i

// «слово есть в тексте» — тем же правилом, что приложение (начальная форма, разрывы)
const IRREGULAR = {
  en: irregularFromEnglish(irregularGroups),
  es: irregularFromSpanish(JSON.parse(readFileSync(new URL('../../src/data/spanish/conjugation_reference.json', import.meta.url), 'utf8'))),
}
// кнопки «True / False / Not given» на языке текста (журнал п.76 (18)) — литералами
const TFNG = { en: ['True', 'False', 'Not given'], es: ['Verdadero', 'Falso', 'No se dice'] }
const lowLevel = (level) => /^A[12]$/i.test(String(level).trim())

/**
 * Упражнения против плана (Ф2.25-2): виды и сколько выбрал учитель — ровно,
 * у «Соедини пары» — одно упражнение на столько пар; вида не из плана нет.
 * Пусто — всё по плану.
 */
function planOff(rows, raw) {
  const want = normalizeRows(rows)
  if (!want.length) return []
  const known = raw.filter((x) => ['mcq', 'fill', 'order', 'match'].includes(x?.type))
  const off = want.flatMap((p) => {
    const mine = known.filter((x) => formatOf(x) === p.format)
    const pairs = formatById(p.format).type === 'match'
    const got = pairs ? (mine.length === 1 ? (mine[0].pairs ?? []).length : `${mine.length} упр.`) : mine.length
    return got === p.count ? [] : [`${p.format}: по плану ${p.count}${pairs ? ' пар' : ''}, есть ${got}${pairs && mine.length === 1 ? ' пар' : ''}`]
  })
  const extra = [...new Set(known.map(formatOf))].filter((id) => !want.some((p) => p.format === id))
  return [...off, ...(extra.length ? [`не из плана: ${list(extra)}`] : [])]
}

/**
 * Новые форматы Ф2.25 — по сырому ответу модели (приложение потом приводит его
 * к своему виду, и по итогу брака не видно):
 * М13 «True / False» — кнопки на языке текста, у A1–A2 две, quote — из текста, mark — в quote;
 * М14 «Соедини пары» — 3–8 пар, слова из текста, перевод — по-русски, объяснение — на языке текста
 *     без самого слова, лишний вариант — ровно один и не совпадает с парой;
 * М16 нет вопросов с открытым ответом — только наши виды.
 */
export function formatRows(body, raw, lang, level) {
  const out = []
  const tf = raw.filter((e) => e?.type === 'mcq' && e.format === 'tfng')
  if (tf.length) {
    const want = TFNG[lang].slice(0, lowLevel(level) ? 2 : 3).join('|')
    const bad = tf.flatMap((e) => {
      const why = []
      if ((e.options ?? []).join('|') !== want) why.push(`кнопки ${JSON.stringify(e.options)}`)
      const ng = e.answer === 2
      if (!ng && !(e.quote && isQuote(body, e.quote))) why.push(`цитаты нет в тексте: «${e.quote ?? ''}»`)
      if (!ng && e.mark && !fold(e.quote).includes(fold(e.mark))) why.push(`«${e.mark}» не в цитате`)
      return why.length ? [`«${e.prompt}»: ${why.join(', ')}`] : []
    })
    out.push(row('М13', bad.length === 0, bad.join('; ')))
  }
  const pairs = raw.filter((e) => e?.type === 'match')
  if (pairs.length) {
    const bad = pairs.flatMap((e) => {
      const why = []
      const ps = e.pairs ?? []
      if (ps.length < 3 || ps.length > 8) why.push(`пар ${ps.length}`)
      const off = ps.filter((p) => !inText(body, p.left, lang, IRREGULAR[lang])).map((p) => p.left)
      if (off.length) why.push(`нет в тексте: ${list(off)}`)
      const rights = ps.map((p) => p.right)
      if (e.format === 'translation' && rights.some((r) => !CYR.test(r))) why.push('перевод не по-русски')
      if (e.format === 'definition' && rights.some((r) => CYR.test(r))) why.push('объяснение не на языке текста')
      if (e.format === 'definition') {
        const leak = ps.filter((p) => hasWord(p.right, p.left)).map((p) => p.left)
        if (leak.length) why.push(`слово в своём объяснении: ${list(leak)}`)
      }
      const extra = e.extra ?? []
      if (extra.length !== 1 || rights.some((r) => fold(r) === fold(extra[0]))) why.push(`лишних вариантов ${extra.length}`)
      return why.length ? [`${e.prompt}: ${why.join(', ')}`] : []
    })
    out.push(row('М14', bad.length === 0, bad.join('; ')))
  }
  const KNOWN = new Set(['mcq', 'fill', 'order', 'match'])
  const open = raw.filter((e) => !KNOWN.has(e?.type) || (e.type === 'mcq' && e.format && !['tfng', 'form'].includes(e.format)))
  out.push(row('М16', open.length === 0, `не наш вид: ${list(open.map((e) => `${e?.type}${e?.format ? '/' + e.format : ''}`))}`))
  return out
}

/** Сравнение текста без мелочей набора: регистр, диакритика, кавычки, пробелы. */
export const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

/** То же, но и без пунктуации — для «это предложение из текста?». */
export const plain = (s) =>
  fold(s)
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokens = (s) => plain(s).split(' ').filter(Boolean)
const SKIP = new Set(['the', 'a', 'an', 'to', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'])
const stem = (w) => (w.length <= 4 ? w : w.length <= 6 ? w.slice(0, -1) : w.slice(0, -2))

/** Слово или фраза есть в тексте в какой-нибудь форме (грубо: по основе каждого значимого слова). */
export function hasWord(text, word) {
  const have = tokens(text)
  const parts = tokens(word).filter((t) => !SKIP.has(t))
  return parts.length > 0 && parts.every((p) => have.some((t) => t === p || t.startsWith(stem(p))))
}

const row = (id, ok, detail = '') => ({ id, ok: Boolean(ok), detail: ok ? '' : detail })
const list = (xs) => xs.map((x) => `«${x}»`).join(', ')

/** «50-100» → [45, 110]: заявленная длина с допуском 10 %. */
export function lengthBounds(range) {
  const [lo, hi] = range.split('-').map(Number)
  return [Math.floor(lo * 0.9), Math.ceil(hi * 1.1)]
}

/** Длина текста в словах; реплики диалога — без «Имя:». */
export function textWords(body) {
  return tokens(String(body ?? '').replace(/^\s*[\p{Lu}][\p{L} .'-]{0,30}:/gmu, ' ')).length
}

const SPEAKER = /^\s*[\p{Lu}][\p{L} .'-]{0,30}:\s*\S/u
const exText = (e) => [e.prompt, e.hint, ...(e.options ?? []), ...(Array.isArray(e.answer) ? e.answer : [String(e.answer ?? '')]), ...(e.words ?? [])].join(' ')
const RANK = { comprehension: 0, grammar: 1, vocab: 2 }

/** Пропуск — предложение из текста: подставили ответ (любой из «a/b») — нашли в тексте. */
export function fillFromText(body, e) {
  const prompt = String(e.prompt ?? '').replace(/\([^)]*\)/g, ' ')
  const text = plain(body)
  return String(e.answer ?? '')
    .split('/')
    .some((a) => text.includes(plain(prompt.replace(/_{2,}/, a.trim()))))
}

/** Упражнения: собирается ли, по тексту ли, без слова в определении. */
function exerciseRows(body, raw, valid, { fromText }) {
  const out = []
  out.push(row('М9', raw.length === valid.length, `приложение выбросило ${raw.length - valid.length} из ${raw.length}`))
  const vocab = valid.filter((e) => e.kind === 'vocab' && e.type === 'mcq')
  const leaked = vocab.filter((e) => e.options?.length !== 4 || hasWord(e.prompt, e.options[e.answer] ?? ''))
  if (vocab.length) out.push(row('М10', leaked.length === 0, `слово в определении или не 4 варианта: ${list(leaked.map((e) => e.prompt))}`))
  const kinds = valid.map((e) => RANK[e.kind] ?? 9)
  const ordered = kinds.every((k, i) => i === 0 || k >= kinds[i - 1])
  if (fromText) {
    const off = valid.filter(
      (e) =>
        (e.type === 'fill' && !fillFromText(body, e)) ||
        (e.type === 'order' && !plain(body).includes(plain(e.answer.join(' ')))),
    )
    out.push(row('М8', off.length === 0, `не из текста: ${list(off.map((e) => (e.type === 'order' ? e.answer.join(' ') : e.prompt)))}`))
  }
  return { rows: out, ordered }
}

/** О2 для материала: пояснения по-русски, сам текст и вопросы — на изучаемом языке. */
function materialLanguage(body, exercises, comments) {
  const bad = []
  if (comments !== undefined && !CYR.test(comments)) bad.push('comments не по-русски')
  if (CYR.test(body)) bad.push('в тексте кириллица')
  for (const e of exercises) {
    if (e.type === 'fill' && e.hint && !CYR.test(e.hint)) bad.push(`подсказка не по-русски: «${e.hint}»`)
    if (e.type === 'order' && !CYR.test(e.prompt)) bad.push(`перевод не по-русски: «${e.prompt}»`)
    if (e.type === 'mcq' && CYR.test(e.prompt + (e.options ?? []).join(''))) bad.push(`вопрос по-русски: «${e.prompt}»`)
  }
  return row('О2', bad.length === 0, bad.join('; '))
}

/**
 * Материал по заявке: план и текст с упражнениями.
 * `out` = { plan, content, raw: { exercises } } — content после фильтров приложения.
 */
export function materialRules(ex, out) {
  const { plan, content } = out
  const raw = out.raw?.exercises ?? content.exercises
  const e = ex.expect ?? {}
  const rows = []
  if (e.planNoWords) {
    const kept = e.planNoWords.filter((w) => plan.vocabulary.some((v) => fold(v) === fold(w)))
    rows.push(row('М1', kept.length === 0, `слово не по уровню осталось в плане: ${list(kept)}`))
  }
  if (e.planWordsCount) {
    const [lo, hi] = e.planWordsCount
    const n = plan.vocabulary.length
    rows.push(row('М2', n >= lo && n <= hi, `слов в плане ${n}, нужно ${lo}–${hi}`))
  }
  const [lo, hi] = lengthBounds(ex.req.lengthRange)
  const n = textWords(content.body)
  rows.push(row('М4', n >= lo && n <= hi, `${n} слов, нужно ${lo}–${hi} (${ex.req.lengthRange} ± 10 %)`))
  const missing = plan.vocabulary.filter((w) => !hasWord(content.body, w))
  rows.push(row('М5', missing.length === 0, `слов плана нет в тексте: ${list(missing)}`))
  const exr = exerciseRows(content.body, raw, content.exercises, { fromText: true })
  rows.push(...exr.rows)
  const off = planOff(plan.exercise_plan ?? [], raw)
  rows.push(row('М11', off.length === 0 && exr.ordered, [...off, exr.ordered ? '' : 'порядок не «понимание → грамматика → слова»'].filter(Boolean).join('; ')))
  if (e.dialog) {
    const lines = content.body.split('\n').map((l) => l.trim()).filter(Boolean)
    const ok = lines.filter((l) => SPEAKER.test(l)).length
    rows.push(row('М12', ok >= lines.length * 0.8, `«Имя: реплика» — ${ok} строк из ${lines.length}`))
  }
  if (e.struggling) {
    const notInText = e.struggling.filter((w) => !hasWord(content.body, w))
    const notInEx = e.struggling.filter((w) => !content.exercises.some((x) => hasWord(exText(x), w)))
    rows.push(
      row(
        'Д1',
        notInText.length === 0 && notInEx.length < e.struggling.length,
        [notInText.length ? `нет в тексте: ${list(notInText)}` : '', notInEx.length === e.struggling.length ? 'ни одного в упражнениях' : '']
          .filter(Boolean)
          .join('; '),
      ),
    )
  }
  if (e.weakTopic) {
    const where = fold([plan.grammar_focus, ...(plan.exercise_plan ?? []).map((p) => p.note)].join(' '))
    rows.push(row('Д2', e.weakTopic.some((k) => where.includes(fold(k))), `в плане нет слабой темы (${e.weakTopic.join(' / ')}): «${plan.grammar_focus}»`))
  }
  rows.push(...formatRows(content.body, raw, ex.req.lang, ex.req.level))
  rows.push(materialLanguage(content.body, content.exercises, plan.comments))
  return rows
}

/** «Свой текст»: только упражнения по готовому тексту учителя. */
export function ownTextRules(ex, out) {
  const { content } = out
  const raw = out.raw?.exercises ?? content.exercises
  const exr = exerciseRows(content.body, raw, content.exercises, { fromText: true })
  const words = textWords(content.body)
  const compr = words < 100 ? [3, 5] : words <= 250 ? [5, 10] : [7, 12]
  const count = (k) => raw.filter((x) => x.kind === k).length
  // виды выбраны в заявке (d16-3) — ровно они; нет — сколько просит промпт сам
  const byPlan = ex.ownText.rows?.length ? planOff(ex.ownText.rows, raw) : null
  const bad = [
    ...(byPlan ?? [
      count('comprehension') < compr[0] || count('comprehension') > compr[1] ? `понимание ${count('comprehension')}, нужно ${compr.join('–')}` : '',
      count('grammar') < 3 || count('grammar') > 6 ? `грамматика ${count('grammar')}, нужно 3–6` : '',
      count('vocab') < 3 || count('vocab') > 6 ? `слова ${count('vocab')}, нужно 3–6` : '',
    ]),
    exr.ordered ? '' : 'порядок не «понимание → грамматика → слова»',
  ].filter(Boolean)
  return [...exr.rows, row('М11', bad.length === 0, bad.join('; ')), ...formatRows(content.body, raw, ex.ownText.lang, ex.ownText.level), materialLanguage(content.body, content.exercises)]
}

/**
 * Разбор сданной работы. `out` = { review, raw: { items } }: review — то, что
 * вернула `generateAiReview` (пропуски она дозаполняет авто-проверкой), raw —
 * что прислала модель.
 */
export function reviewRules(ex, out) {
  const rows = []
  const rawIdx = new Set((out.raw?.items ?? []).map((x) => x.index))
  const lost = ex.items.map((_, i) => i).filter((i) => !rawIdx.has(i))
  rows.push(row('Р5', lost.length === 0, `нет вердикта модели на упражнения ${lost.join(', ')}`))
  const at = (i) => out.review.find((r) => r.index === i) ?? { ok: false, comment: '' }
  const wrongFalse = []
  const wrongTrue = []
  const unexplained = []
  const noMention = []
  ex.items.forEach(([e, given, want, , mention], i) => {
    const got = at(i)
    if (want === false && got.ok) wrongFalse.push(`${i}: «${given || '(пусто)'}»`)
    if (want === true && !got.ok) wrongTrue.push(`${i}: «${given}»`)
    const name = mention ?? (want === false ? correctText(e) : null)
    if (name && !fold(got.comment).includes(fold(name))) (want === false ? unexplained : noMention).push(`${i}: нет «${name}»`)
  })
  rows.push(row('Р1', wrongFalse.length === 0, `ошибка засчитана как верно: ${wrongFalse.join(', ')}`))
  rows.push(row('Р2', wrongTrue.length === 0, `придумана ошибка: ${wrongTrue.join(', ')}`))
  if (ex.items.some((it) => it[4])) rows.push(row('Р3', noMention.length === 0, `синоним без пометки: ${noMention.join(', ')}`))
  rows.push(row('Р4', unexplained.length === 0, `у неверного нет правильного ответа: ${unexplained.join(', ')}`))
  const latin = out.review.filter((r) => r.comment && !CYR.test(r.comment))
  rows.push(row('О2', latin.length === 0, `комментарий не по-русски: ${list(latin.map((r) => r.comment))}`))
  rows.push(tyRow(out.review.map((r) => r.comment)))
  return rows
}

/** Ответ упражнения текстом (как `correctAnswerText` приложения). */
function correctText(e) {
  if (e.type === 'mcq') return e.options[e.answer]
  if (e.type === 'order') return e.answer.join(' ')
  return String(e.answer).split('/')[0]
}

/** Цитата есть в тексте ученика (куски через «…» — каждый). */
export function isQuote(essay, was) {
  const text = fold(essay)
  return String(was)
    .split(/\.{3}|…/)
    .map((p) => fold(p).replace(/^[\s"'.,;:!?-]+|[\s"'.,;:!?-]+$/g, ''))
    .filter((p) => p.length >= 2)
    .every((p) => text.includes(p))
}

const overlaps = (a, b) => {
  const [x, y] = [fold(a), fold(b)]
  return x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))
}

/** Разбор письма. `out` = { grade, raw } — grade после `parseGrade` приложения. */
/** «Напишите», «Используйте», «Постарайтесь» — к человеку на «вы». */
const VY = /(^|[^а-яё])(напиш|добав|использу|обрат|попроб|избега|провер|замен|перепиш|раскро|убер|пиш|след|сдела|повтор|постара|учит|запомн|выуч|подумай|разде|соедин|раздел)[а-яё]*(ите|йте)(сь)?(?![а-яё])/i

/** О6: по-русски к человеку — на «ты», как всё приложение (журнал п.71, lib/promptRules). */
export function tyRow(texts) {
  const bad = texts.filter((s) => typeof s === 'string' && VY.test(s))
  return row('О6', bad.length === 0, `на «вы»: ${list(bad.slice(0, 3))}`)
}

/** П6: балл IELTS в коридоре эталона и согласован с четырьмя критериями (±0,5). */
export function bandRow(corridor, grade) {
  const c = grade.criteria ?? {}
  const mean = (c.task + c.coherence + c.lexis + c.grammar) / 4
  const inBand = typeof grade.band === 'number' && grade.band >= corridor[0] && grade.band <= corridor[1]
  return row(
    'П6',
    inBand && Math.abs(grade.band - mean) <= 0.5,
    `балл ${grade.band}, эталон ${corridor.join('–')}; критерии ${[c.task, c.coherence, c.lexis, c.grammar].join('/')} (среднее ${mean})`,
  )
}

export function writingRules(ex, out) {
  const { grade } = out
  const e = ex.expect
  const rows = []
  const pairs = [...(grade.errors ?? []), ...(grade.focus ?? []).flatMap((f) => f.examples)]
  const fake = pairs.filter((p) => !isQuote(ex.essay, p.was))
  rows.push(row('П1', fake.length === 0, `не цитата из текста: ${list(fake.map((p) => p.was))}`))
  const found = e.planted.filter((p) => pairs.some((x) => overlaps(x.was, p)))
  const missed = e.planted.filter((p) => !found.includes(p))
  rows.push(row('П2', found.length >= Math.ceil(e.planted.length * 0.8), `найдено ${found.length} из ${e.planted.length}, пропущены: ${list(missed)}`))
  const touched = []
  for (const t of e.traps) {
    for (const p of pairs) {
      const inside = fold(t).includes(fold(p.was)) && plain(p.was) !== plain(p.fix)
      const around = fold(p.was).includes(fold(t)) && !fold(p.fix).includes(fold(t))
      if (inside || around) touched.push(`«${p.was}» → «${p.fix}»`)
    }
  }
  rows.push(row('П3', touched.length === 0, `исправлено верное: ${touched.join(', ')}`))
  const tense = (e.tense ?? []).map((t) => ({ t, hits: pairs.filter((p) => overlaps(p.was, t.was)) })).filter((x) => x.hits.length)
  if (tense.length) {
    const bad = tense.flatMap(({ t, hits }) => hits.filter((p) => !fold(p.fix).includes(fold(t.must)) || fold(p.fix).includes(fold(t.not))))
    rows.push(row('П4', bad.length === 0, `сдвинуто время: ${bad.map((p) => `«${p.was}» → «${p.fix}»`).join(', ')}`))
  }
  const rawFocus = Array.isArray(out.raw?.focus) ? out.raw.focus.length : 0
  rows.push(row('П5', rawFocus >= 1 && rawFocus <= 3 && (grade.focus ?? []).length >= 1, `типов в фокусе: ${rawFocus} (нужно 1–3)`))
  if (e.band) rows.push(bandRow(e.band, grade))
  if (e.taskMax !== undefined) rows.push(row('П7', (grade.criteria?.task ?? 9) <= e.taskMax, `Task Achievement ${grade.criteria?.task} при неверных данных, потолок ${e.taskMax}`))
  if (e.words || e.level) {
    const bad = []
    for (const [w, used] of Object.entries(e.words ?? {})) {
      const got = (grade.targetWords ?? []).find((x) => fold(x.w) === fold(w))
      if (!got) bad.push(`нет строки «${w}»`)
      else if (got.used !== used) bad.push(`«${w}»: ${got.used ? 'употребил' : 'не употребил'}, а на деле ${used ? 'да' : 'нет'}`)
    }
    const levels = String(grade.level ?? '').toUpperCase().match(/[ABC][12]/g) ?? []
    if (e.level && (levels.length === 0 || levels.some((l) => !e.level.includes(l)))) bad.push(`уровень «${grade.level}», эталон ${e.level.join('–')}`)
    rows.push(row('П8', bad.length === 0, bad.join('; ')))
  }
  const ru = [...(grade.focus ?? []).map((f) => f.why), ...(grade.strengths ?? []), ...(grade.improve ?? [])].filter((s) => !CYR.test(s))
  rows.push(row('О2', ru.length === 0, `пояснение не по-русски: ${list(ru)}`))
  rows.push(tyRow([...(grade.focus ?? []).flatMap((f) => [f.type, f.why]), ...(grade.strengths ?? []), ...(grade.improve ?? [])]))
  return rows
}

/** Придуманное AI задание IELTS (вопрос или график). */
export function writingTaskRules(ex, out) {
  const e = ex.expect
  const rows = []
  if (out.chart) {
    const s = out.chart.series ?? []
    const pts = s[0]?.points ?? []
    const sum = pts.reduce((a, p) => a + p.value, 0)
    const [lo, hi] = e.pieSum
    rows.push(
      row(
        'П10',
        s.length === 1 && pts.length >= e.points[0] && pts.length <= e.points[1] && sum >= lo && sum <= hi && /summari[sz]e/i.test(out.prompt),
        `рядов ${s.length}, точек ${pts.length}, сумма ${sum}; задание: «${out.prompt}»`,
      ),
    )
  } else {
    const q = String(out.prompt ?? '')
    rows.push(row('П10', q.length > 40 && !CYR.test(q) && /agree|disagree|discuss|advantage|extent|opinion|why/i.test(q), `вопрос: «${q}»`))
  }
  return rows
}

/**
 * Программа обучения. `out` = { plan, raw } — plan после `sanitize`
 * приложения, raw — недели, как их прислала модель. `catalog` — Map
 * «номер урока → уровень» каталога языка программы.
 */
export function programRules(ex, out, catalog) {
  const e = ex.expect ?? {}
  const rows = []
  const weeks = Array.isArray(out.raw?.weeks) ? out.raw.weeks : []
  const badWeeks = weeks
    .map((w, i) => {
      const items = w.items ?? []
      const types = new Set(items.map((it) => it.type))
      return items.length < 3 || items.length > 5 || types.size < 2 ? `неделя ${i + 1}: ${items.length} пунктов, типов ${types.size}` : ''
    })
    .filter(Boolean)
  rows.push(row('Пр1', weeks.length === ex.req.weeks && badWeeks.length === 0, [`недель ${weeks.length} из ${ex.req.weeks}`, ...badWeeks].join('; ')))
  const grammar = weeks.flatMap((w, wi) => (w.items ?? []).filter((it) => it.type === 'grammar').map((it) => ({ ...it, week: wi })))
  const invented = grammar.filter((it) => !catalog.has(it.topicId))
  rows.push(row('Пр2', invented.length === 0, `номера не из каталога: ${invented.map((it) => `${it.topicId} «${it.title}»`).join(', ')}`))
  if (e.early?.length) {
    const early = grammar.filter((it) => it.week < 2).map((it) => it.topicId)
    rows.push(row('Пр3', e.early.some((id) => early.includes(id)), `в первых двух неделях нет слабых тем ${e.early.join(', ')} (есть: ${early.join(', ') || 'ничего'})`))
  }
  if (e.levels) {
    const off = grammar.filter((it) => catalog.has(it.topicId) && !e.levels.includes(catalog.get(it.topicId)) && !(e.early ?? []).includes(it.topicId))
    rows.push(row('Пр4', off.length === 0, `не тот уровень: ${off.map((it) => `${it.topicId} (${catalog.get(it.topicId)})`).join(', ')}`))
  }
  const notes = (out.plan.weeks ?? []).flatMap((w) => w.items.map((it) => it.note)).filter((n) => !CYR.test(n))
  rows.push(row('О2', CYR.test(out.plan.summary) && notes.length === 0, `не по-русски: ${list([CYR.test(out.plan.summary) ? '' : 'summary', ...notes].filter(Boolean))}`))
  rows.push(tyRow([out.plan.summary, ...(out.plan.weeks ?? []).flatMap((w) => w.items.flatMap((it) => [it.title, it.note]))]))
  return rows
}
