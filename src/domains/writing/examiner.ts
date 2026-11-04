// ============================================================================
// «Свой экзаменатор» (журнал п.77): балл письма считает наш код, а не модель.
// Модель — «глаза»: по каждому критерию называет высшую ступень шкалы, всем
// признакам которой работа соответствует полностью (`ielts.ts`, `cefr.ts`), и
// чего не хватает до следующей — с цитатой из текста. Код:
//   • применяет ограничивающие признаки шкалы — названные моделью и
//     посчитанные сам (абзацы, пункты списком, доля предложений без ошибок);
//   • считает итог: IELTS — среднее четырёх критериев, CEFR — уровень,
//     который держат три стороны текста из четырёх;
//   • выстраивает советы по тому, что сильнее поднимет балл.
// Чистые функции, без сети — держит scripts/test-writing-examiner.mjs.
// ============================================================================

import { ASPECTS, CEFR_LEVELS, type AspectKey, type CefrLevel } from './cefr'
import { CRITERIA, IELTS_LIMITS, MIN_WORDS, type CritKey, type IeltsKind } from './ielts'
import { hasBullets, locateFixes, paragraphCount, sentences, wordCount } from './text'

/** Чего не хватает до следующей ступени: признак шкалы по-русски и место в тексте. */
export interface NextStep {
  need: string
  was: string
  fix: string
}

/** Пункт советов — та же форма, что `WritingGrade.focus`. */
export interface FocusItem {
  type: string
  why: string
  examples: { was: string; fix: string }[]
}

/** Факты о тексте, которые считает код, а не модель. */
export interface TextFacts {
  words: number
  paragraphs: number
  bullets: boolean
  sentences: number
  /** Доля предложений без грамматических правок; null — правки не нашлись в тексте, доле не верим. */
  errorFree: number | null
}

/**
 * «The majority of sentences are error-free» — признак ступени 8, «error-free
 * sentences are frequent» — ступени 7 (шкала GRA). «Большинство» — больше
 * половины; «часто» шкала числом не задаёт — 0,35 начальная догадка, её
 * сверяет check-ai-writing на официальных работах IELTS (П6, П11; журнал
 * п.77): занижает сильным — порог вниз.
 */
export const ERROR_FREE_FOR_8 = 0.5
export const ERROR_FREE_FOR_7 = 0.35
/** Правок, которые не нашлись в тексте, больше этой доли — доле предложений без ошибок не верим. */
const LOST_QUOTES = 0.3
/** «Responses of 20 words or fewer are rated at Band 1» — во всех четырёх критериях. */
export const TOO_SHORT = 20

/**
 * Факты текста. `grammarQuotes` — цитаты «было» грамматических правок: по
 * ним видно, в каком предложении ошибка.
 */
export function textFacts(essay: string, grammarQuotes: readonly string[]): TextFacts {
  const list = sentences(essay)
  const { marks } = locateFixes(essay, grammarQuotes.map((was) => ({ was })))
  const lost = grammarQuotes.length - marks.length
  const withError = new Set<number>()
  for (const m of marks) {
    const at = list.findIndex((s) => m.start >= s.start && m.start < s.end)
    if (at !== -1) withError.add(at)
  }
  const reliable = list.length > 0 && (grammarQuotes.length === 0 || lost / grammarQuotes.length <= LOST_QUOTES)
  return {
    words: wordCount(essay),
    paragraphs: paragraphCount(essay),
    bullets: hasBullets(essay),
    sentences: list.length,
    errorFree: reliable ? 1 - withError.size / list.length : null,
  }
}

/** Итог задания — среднее четырёх критериев вниз до половины балла: экзаменатор не завышает. */
export function roundBand(avg: number): number {
  return Math.floor(avg * 2 + 1e-9) / 2
}

export interface IeltsMark {
  band: number
  next: NextStep | null
}

export interface AppliedLimit {
  id: string
  crit: CritKey
  max: number
  /** На сколько потолок срезал ступень модели (0 — модель и так поставила не выше). */
  cut: number
}

export interface IeltsResult {
  criteria: Record<CritKey, number>
  band: number
  limits: AppliedLimit[]
  /** Советы по порядку влияния на балл — все; экран берёт первые три. */
  advice: FocusItem[]
}

/** Ограничивающие признаки, которые находит код. */
function codeLimits(kind: IeltsKind, facts: TextFacts): string[] {
  const out: string[] = []
  if (kind === 'task2' && facts.paragraphs < 2 && facts.words >= 100) out.push('no_paragraphs')
  if (facts.bullets) out.push('bullets')
  if (facts.errorFree !== null && facts.sentences >= 4) {
    if (facts.errorFree < ERROR_FREE_FOR_7) out.push('errors_frequent')
    else if (facts.errorFree <= ERROR_FREE_FOR_8) out.push('errors_majority')
  }
  return out
}

const LABEL = Object.fromEntries(CRITERIA.map((c) => [c.key, c.label])) as Record<CritKey, string>

export function scoreIelts(kind: IeltsKind, marks: Record<CritKey, IeltsMark>, modelLimitIds: readonly string[], facts: TextFacts): IeltsResult {
  const criteria = {} as Record<CritKey, number>
  for (const { key } of CRITERIA) criteria[key] = Math.max(0, Math.min(9, Math.floor(marks[key].band)))
  if (facts.words <= TOO_SHORT) {
    for (const { key } of CRITERIA) criteria[key] = Math.min(criteria[key], 1)
  }

  const ids = [...new Set([...modelLimitIds, ...codeLimits(kind, facts)])]
  const limits: AppliedLimit[] = []
  for (const id of ids) {
    const l = IELTS_LIMITS[id]
    if (!l || !l.kinds.includes(kind)) continue
    limits.push({ id, crit: l.crit, max: l.max, cut: Math.max(0, criteria[l.crit] - l.max) })
    criteria[l.crit] = Math.min(criteria[l.crit], l.max)
  }
  const avg = CRITERIA.reduce((s, c) => s + criteria[c.key], 0) / CRITERIA.length

  // Советы: сначала потолки (каждый стоит целой ступени и больше), потом
  // длина, потом критерии от слабого к сильному — у каждого «что нужно для
  // следующей ступени» с местом в тексте.
  const advice: FocusItem[] = []
  const byLimit = [...limits].sort((a, b) => b.cut - a.cut || a.max - b.max)
  for (const a of byLimit) {
    const l = IELTS_LIMITS[a.id]
    if (l) advice.push({ type: `${LABEL[a.crit]} не выше ${a.max}: ${l.ru.toLowerCase()}`, why: l.how, examples: [] })
  }
  const min = MIN_WORDS[kind]
  if (facts.words > TOO_SHORT && facts.words < min) {
    advice.push({
      type: `Мало слов: ${facts.words} из ${min}`,
      why: 'Короткий ответ экзамен снижает по Task: идеям не хватает развития. Добавь пример или пояснение к каждой мысли.',
      examples: [],
    })
  }
  const limited = new Set(limits.map((l) => l.crit))
  const order = [...CRITERIA].sort((a, b) => criteria[a.key] - criteria[b.key])
  for (const { key } of order) {
    const next = marks[key].next
    if (limited.has(key) || criteria[key] >= 9 || !next?.need) continue
    advice.push({
      type: `${LABEL[key]} ${criteria[key]} → ${criteria[key] + 1}`,
      why: next.need,
      examples: next.was && next.fix ? [{ was: next.was, fix: next.fix }] : [],
    })
  }
  return { criteria, band: roundBand(avg), limits, advice }
}

// ── CEFR: обычное эссе ──────────────────────────────────────────────────────

export interface CefrMark {
  level: CefrLevel
  next: NextStep | null
}

export interface CefrResult {
  level: CefrLevel
  aspects: Record<AspectKey, CefrLevel>
  advice: FocusItem[]
}

/** «B1+», «уровень b2» → B2; не узнали — null. */
export function cefrLevel(v: unknown): CefrLevel | null {
  const m = String(v ?? '').toUpperCase().match(/[ABC][12]/)
  return m ? (m[0] as CefrLevel) : null
}

const rank = (l: CefrLevel) => CEFR_LEVELS.indexOf(l)

/**
 * Общий уровень — тот, который держат три стороны текста из четырёх (вторая
 * снизу): одна слабая сторона не обрушивает уровень, но и одна сильная его не
 * поднимает.
 */
export function cefrOverall(levels: readonly CefrLevel[]): CefrLevel {
  const sorted = [...levels].sort((a, b) => rank(a) - rank(b))
  return sorted[Math.min(1, sorted.length - 1)] ?? 'A1'
}

export function scoreCefr(marks: Record<AspectKey, CefrMark>, facts: TextFacts, minWords?: number): CefrResult {
  const aspects = {} as Record<AspectKey, CefrLevel>
  for (const { key } of ASPECTS) aspects[key] = facts.words <= TOO_SHORT ? 'A1' : marks[key].level
  const level = cefrOverall(Object.values(aspects))

  const advice: FocusItem[] = []
  if (minWords && facts.words > TOO_SHORT && facts.words < minWords) {
    advice.push({
      type: `Мало слов: ${facts.words} из ${minWords}`,
      why: 'В коротком тексте не видно, что ты умеешь: раскрой каждый пункт задания примером или подробностью.',
      examples: [],
    })
  }
  const order = [...ASPECTS].sort((a, b) => rank(aspects[a.key]) - rank(aspects[b.key]))
  for (const { key, label } of order) {
    const next = marks[key].next
    const at = rank(aspects[key])
    if (at >= CEFR_LEVELS.length - 1 || !next?.need) continue
    advice.push({
      type: `${label} ${aspects[key]} → ${CEFR_LEVELS[at + 1]}`,
      why: next.need,
      examples: next.was && next.fix ? [{ was: next.was, fix: next.fix }] : [],
    })
  }
  return { level, aspects, advice }
}
