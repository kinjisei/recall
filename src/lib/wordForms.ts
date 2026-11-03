// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// «Слово есть в тексте» — по начальной форме и с разрывами (Ф2.25, журнал
// п.76 (8)): «missed her flight» ⇒ miss a flight, took ⇒ take, gates ⇒ gate,
// esperó ⇒ esperar, fue ⇒ ser / ir. Кусок другого слова — нет: gate в
// «gateway», maleta в «maletero».
//
// Им пользуются подсветка слов плана в тексте (шаг «Текст», d8-4) и отсев
// словарных упражнений (`lib/materialExercises`: пары и «слово по
// объяснению» — только слова из текста).
//
// Чистый модуль; справочники неправильных форм (английские неправильные
// глаголы и испанские спряжения из data/) грузятся ЛЕНИВО — `loadIrregular`:
// lib/materials попадает в стартовый кусок сборки (его зовёт Главная), а
// справочники нужны только генерации и шагу «Текст». Без справочника
// работают правила окончаний.
// ============================================================================
import type { AppLang, ConjugationReference } from '../types'

/** Неправильные формы → начальные: took → take; fue → ser, ir. */
export type IrregularForms = ReadonlyMap<string, readonly string[]>

/** Кусок текста, где нашлось слово: [start, end). */
export interface Span {
  start: number
  end: number
}

/** Служебные слова фразы — между значимыми допускаются любые слова: «miss a flight» ⇒ «missed her flight». */
const FUNCTION_WORDS: Record<AppLang, ReadonlySet<string>> = {
  en: new Set(['a', 'an', 'the', 'to', 'of', 'my', 'your', 'his', 'her', 'its', 'our', 'their', "one's", 'someone', 'somebody', 'something', 'sb', 'sth']),
  es: new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'de', 'del', 'al', 'a', 'lo']),
}

/** Сколько чужих слов может стоять между значимыми словами фразы. */
const MAX_GAP = 2

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu

/** Без регистра, знаков над буквами и с прямым апострофом. */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/’/g, "'")

interface Token {
  w: string
  start: number
  end: number
}

function tokenize(s: string): Token[] {
  return [...s.matchAll(WORD)].map((m) => ({ w: fold(m[0]), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }))
}

/** Начальные формы английского слова по правилам окончаний: waited → wait, stopping → stop, carried → carry. */
function enBases(w: string): string[] {
  const out = [w]
  const cut = (n: number, add = '') => {
    const b = w.slice(0, -n) + add
    if (b.length >= 2) out.push(b)
  }
  const doubled = (stem: string) => stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2] && !/[aeiou]/.test(stem[stem.length - 1] ?? '')
  if (w.endsWith("'s")) cut(2)
  if (w.endsWith('ies')) cut(3, 'y')
  else if (w.endsWith('es')) cut(2)
  if (w.endsWith('s') && !w.endsWith('ss')) cut(1)
  if (w.endsWith('ied')) cut(3, 'y')
  else if (w.endsWith('ed')) {
    cut(2)
    cut(1)
    if (doubled(w.slice(0, -2))) cut(3)
  }
  if (w.endsWith('ying')) cut(4, 'ie')
  if (w.endsWith('ing')) {
    cut(3)
    cut(3, 'e')
    if (doubled(w.slice(0, -3))) cut(4)
  }
  return out
}

// Окончания испанского глагола (без знаков над буквами): настоящее, прошедшее,
// имперфект, сослагательное, причастие и герундий — длинные раньше коротких.
const ES_ENDINGS = [
  'asteis', 'isteis', 'aramos', 'ieramos', 'abamos', 'iamos', 'ieron', 'aron', 'iendo', 'ando', 'abais', 'aban', 'abas', 'aba',
  'aste', 'iste', 'amos', 'emos', 'imos', 'ados', 'adas', 'idos', 'idas', 'ado', 'ada', 'ido', 'ida', 'ais', 'eis', 'ian', 'ias',
  'ia', 'io', 'as', 'an', 'es', 'en', 'is', 'o', 'a', 'e', 'i',
].sort((a, b) => b.length - a.length)
const ES_FUTURE = /^(.{2,}?[aei]r)(e|as|a|emos|eis|an|ia|ias|iamos|iais|ian)$/

// Местоимение на конце инфинитива и герундия: equivocarse → equivocar,
// comprarlo → comprar, levantándose → levantando.
const ES_CLITIC = /^(.{2,}?(?:[aei]r|ando|iendo))(me|te|se|nos|os|lo|la|le|los|las|les)$/

/**
 * Смена написания перед окончанием (правильные глаголы): перед e — qu ← c
 * (busqué → buscar), gu ← g (llegué → llegar), c ← z (empecé → empezar);
 * перед o и a — j ← g (cojo → coger), z ← c (venzo → vencer), g ← gu
 * (distingo → distinguir). Без них пара «equivocarse» к тексту «me
 * equivoqué» молча выбрасывалась (Ф2.25-4а).
 */
function esSpelling(stem: string, ending: string): string[] {
  const head = (n: number) => stem.slice(0, -n)
  if (ending.startsWith('e')) {
    if (stem.endsWith('qu') && head(2).length >= 2) return [head(2) + 'car']
    if (stem.endsWith('gu') && head(2).length >= 2) return [head(2) + 'gar']
    if (stem.endsWith('c') && head(1).length >= 2) return [head(1) + 'zar']
  } else if (ending.startsWith('o') || ending.startsWith('a')) {
    if (stem.endsWith('j') && head(1).length >= 2) return [head(1) + 'ger', head(1) + 'gir']
    if (stem.endsWith('z') && head(1).length >= 2) return [head(1) + 'cer', head(1) + 'cir']
    if (stem.endsWith('g') && !stem.endsWith('gu') && stem.length >= 3) return [stem + 'uir']
  }
  return []
}

/** Начальные формы испанского слова: maletas → maleta, esperó → esperar, esperaré → esperar. */
function esBases(w: string): string[] {
  const out = [w]
  const clitic = ES_CLITIC.exec(w)
  if (clitic?.[1]) out.push(...esBases(clitic[1]))
  if (w.endsWith('es') && w.length > 4) out.push(w.slice(0, -2))
  if (w.endsWith('s') && w.length > 3) out.push(w.slice(0, -1))
  const fut = ES_FUTURE.exec(w)
  if (fut?.[1]) out.push(fut[1])
  for (const e of ES_ENDINGS) {
    if (!w.endsWith(e)) continue
    const stem = w.slice(0, -e.length)
    if (stem.length >= 2) out.push(stem + 'ar', stem + 'er', stem + 'ir', ...esSpelling(stem, e))
  }
  return out
}

/** Все начальные формы слова: правила окончаний и справочник неправильных. */
function basesOf(w: string, lang: AppLang, irregular?: IrregularForms): Set<string> {
  const out = new Set(lang === 'es' ? esBases(w) : enBases(w))
  for (const b of irregular?.get(w) ?? []) out.add(b)
  return out
}

/** Одно и то же слово: у формы из текста и у слова плана есть общая начальная форма. */
function same(plan: string, text: string, lang: AppLang, irregular?: IrregularForms): boolean {
  if (plan === text) return true
  const t = basesOf(text, lang, irregular)
  if (t.has(plan)) return true
  for (const b of basesOf(plan, lang, irregular)) if (t.has(b)) return true
  return false
}

/**
 * Где во фразе текста стоит слово (или фраза) плана: значимые слова — по
 * порядку, по начальной форме, между ними — до двух чужих слов. Слово со
 * знаками внутри («a+b») — только буквально.
 */
export function findPhrase(text: string, phrase: string, lang: AppLang = 'en', irregular?: IrregularForms): Span[] {
  const raw = phrase.trim()
  if (!raw || !text) return []
  if (/[^\p{L}\p{N}\s'’-]/u.test(raw)) {
    const out: Span[] = []
    const low = text.toLowerCase()
    const p = raw.toLowerCase()
    for (let i = low.indexOf(p); i >= 0; i = low.indexOf(p, i + p.length)) out.push({ start: i, end: i + p.length })
    return out
  }
  const parts = tokenize(raw).map((t) => t.w)
  const content = parts.filter((w) => !FUNCTION_WORDS[lang].has(w))
  const need = content.length > 0 ? content : parts
  const toks = tokenize(text)
  const out: Span[] = []
  for (let i = 0; i < toks.length; i++) {
    if (!same(need[0]!, toks[i]!.w, lang, irregular)) continue
    let j = i
    let ok = true
    for (const word of need.slice(1)) {
      let found = -1
      for (let k = j + 1; k <= Math.min(toks.length - 1, j + 1 + MAX_GAP); k++) {
        if (same(word, toks[k]!.w, lang, irregular)) {
          found = k
          break
        }
      }
      if (found < 0) {
        ok = false
        break
      }
      j = found
    }
    if (!ok) continue
    out.push({ start: toks[i]!.start, end: toks[j]!.end })
    i = j
  }
  return out
}

/** Слово плана есть в тексте — в какой-нибудь своей форме. */
export const inText = (text: string, phrase: string, lang: AppLang = 'en', irregular?: IrregularForms): boolean =>
  findPhrase(text, phrase, lang, irregular).length > 0

/** Справочник неправильных форм английского: past и participle (варианты через «/») → base. */
export function irregularFromEnglish(groups: { verbs: { base: string; past: string; part: string }[] }[]): IrregularForms {
  const map = new Map<string, string[]>()
  for (const g of groups) {
    for (const v of g.verbs) {
      const base = fold(v.base)
      for (const form of [...v.past.split('/'), ...v.part.split('/')]) {
        const f = fold(form.trim())
        if (!f || f === base) continue
        map.set(f, [...new Set([...(map.get(f) ?? []), base])])
      }
    }
  }
  return map
}

/** Справочник испанских форм: каждая форма глагола (последнее слово сложной) → инфинитив («ser / ir» — оба). */
export function irregularFromSpanish(ref: Pick<ConjugationReference, 'tenses'>): IrregularForms {
  const map = new Map<string, string[]>()
  for (const t of ref.tenses) {
    for (const v of t.verbs) {
      const bases = v.infinitive.split('/').map((s) => fold(s.trim())).filter(Boolean)
      for (const form of v.forms) {
        const words = form.trim().split(/\s+/)
        const f = fold(words[words.length - 1] ?? '')
        if (!f || bases.includes(f)) continue
        map.set(f, [...new Set([...(map.get(f) ?? []), ...bases])])
      }
    }
  }
  return map
}

const loaded: Partial<Record<AppLang, Promise<IrregularForms>>> = {}

/** Справочник неправильных форм языка — один раз и лениво (не в стартовом куске сборки). */
export function loadIrregular(lang: AppLang): Promise<IrregularForms> {
  loaded[lang] ??=
    lang === 'es'
      ? import('../data/spanish/conjugation').then((m) => irregularFromSpanish(m.conjugationReference))
      : import('../data/english/irregular').then((m) => irregularFromEnglish(m.irregularGroups))
  return loaded[lang]
}
