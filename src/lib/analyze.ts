// ============================================================================
// Разбор выделенного фрагмента текста (кнопка «Разбор предложения» в попапе).
// ОДИН запрос AI (task 'analyze', умная модель): общий перевод + список
// примечательного по группам — фразовые глаголы, выражения, ключевые слова
// (добавляемые в «Мои слова») и грамматические структуры (объяснение + ссылка
// на урок). Ответу AI не доверяем на тип — санитайз; topicId сверяем с каталогом.
// ============================================================================
import { chat } from './gemini'
import type { AppLang } from '../types'

export type AnalyzedKind = 'phrasal' | 'expression' | 'word' | 'grammar'

export interface AnalyzedItem {
  kind: AnalyzedKind
  /** Как встречено во фрагменте (для слов/фраз). */
  text: string
  /** Словарная форма / название структуры. */
  base: string
  /** Краткий перевод (слова/фразы) или объяснение (грам-структура). */
  ru: string
  /** Только для kind:'grammar' — id урока из каталога, если сопоставлен. */
  topicId?: number
}

export interface Analysis {
  translation: string
  items: AnalyzedItem[]
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

const KINDS: AnalyzedKind[] = ['phrasal', 'expression', 'word', 'grammar']

/** Каталог уроков грамматики (id·уровень·название) для сопоставления структур. */
export async function loadGrammarCatalog(
  lang: AppLang,
): Promise<{ text: string; ids: Set<number> }> {
  try {
    const mod =
      lang === 'es' ? await import('../data/spanish/grammar') : await import('../data/english/grammar')
    const topics = mod.grammarTopics as { id: number; level: string; title: string }[]
    return {
      text: topics.map((t) => `${t.id} · ${t.level} · ${t.title}`).join('\n'),
      ids: new Set(topics.map((t) => t.id)),
    }
  } catch {
    return { text: '', ids: new Set() }
  }
}

/** Санитайз массива items из ответа AI (типы, topicId из каталога, обрезка). */
export function parseAnalyzedItems(
  rawItems: unknown[],
  ids: Set<number>,
  max = 8,
): AnalyzedItem[] {
  return rawItems
    .slice(0, max)
    .map((x): AnalyzedItem => {
      const it = (x ?? {}) as Record<string, unknown>
      const kind: AnalyzedKind = KINDS.includes(it.kind as AnalyzedKind)
        ? (it.kind as AnalyzedKind)
        : 'word'
      const text = asStr(it.text)
      const item: AnalyzedItem = { kind, text, base: asStr(it.base) || text, ru: asStr(it.ru) }
      if (kind === 'grammar' && typeof it.topicId === 'number' && ids.has(it.topicId)) {
        item.topicId = it.topicId
      }
      return item
    })
    .filter((it) => it.base && it.ru)
}

export async function analyzeSelection(
  fragment: string,
  sentence: string,
  lang: AppLang,
): Promise<Analysis> {
  const dict = lang === 'es' ? 'испанского' : 'английского'
  const { text: catalog, ids } = await loadGrammarCatalog(lang)

  // промпт выверен живым тестом на проде (умная модель): дешёвая теряла
  // фразовые глаголы и ломала формат, поэтому task:'analyze' (стандарт).
  const system = [
    `Ты — словарь ${dict} для русскоязычного ученика. Разбираешь выделенный фрагмент текста.`,
    'Верни ТОЛЬКО валидный JSON без markdown: {"translation":"…","items":[{"kind":"…","base":"…","ru":"…","topicId":N?}]}',
    'kind — РОВНО одно из: phrasal (фразовый глагол), expression (идиома/устойчивое выражение), word (отдельное слово), grammar (грамматическая структура). Пример: {"kind":"phrasal","base":"give up","ru":"бросить"}.',
    'translation — естественный СМЫСЛОВОЙ перевод фрагмента (фразовые глаголы переводи по смыслу: look up to = уважать, НЕ «смотреть вверх»).',
    'base фразового глагола ВКЛЮЧАЕТ частицу/предлог ЦЕЛИКОМ: looked up to → look up to, gave up → give up. Никогда не обрезай до look/give.',
    'В kind:"word" — 2-4 самых полезных ОТДЕЛЬНЫХ слова (не служебные: не up/to/is). Каждую единицу указывай ровно ОДИН раз.',
    'kind:"grammar" — заметные грам-структуры (Present Perfect, Passive, Conditionals…): base = название структуры, ru = короткое объяснение «зачем тут», по-русски. Если структура соответствует уроку из каталога ниже — добавь "topicId":<число id из каталога>, иначе topicId НЕ добавляй. Не выдумывай topicId.',
    'Максимум 8 элементов всего. Ничего не выдумывай: нет фразовых глаголов/выражений/структур — просто не добавляй.',
    catalog ? `Каталог уроков (id · уровень · название):\n${catalog}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const user = JSON.stringify({ fragment, sentence })
  const raw = await chat([{ role: 'user', content: user }], { system, task: 'analyze' })

  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error('AI вернул не-JSON')
  const o = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>

  const items = parseAnalyzedItems(Array.isArray(o.items) ? o.items : [], ids)
  return { translation: asStr(o.translation), items }
}
