// ============================================================================
// Разбор выделенного фрагмента текста (зажать + провести по словам в читалке).
// ОДИН запрос AI (tier lite — как перевод слова, бережём дневной лимит):
// общий перевод фрагмента + список примечательного по группам —
// фразовые глаголы, устойчивые выражения/идиомы, ключевые слова. Каждый
// элемент можно добавить в «Мои слова». Ответу AI не доверяем на тип — санитайз.
// ============================================================================
import { chat } from './gemini'
import type { AppLang } from '../types'

export type AnalyzedKind = 'phrasal' | 'expression' | 'word'

export interface AnalyzedItem {
  kind: AnalyzedKind
  /** Как встречено во фрагменте. */
  text: string
  /** Словарная форма (инфинитив у фразового глагола). */
  base: string
  /** Краткий перевод по-русски. */
  ru: string
}

export interface Analysis {
  translation: string
  items: AnalyzedItem[]
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export async function analyzeSelection(
  fragment: string,
  sentence: string,
  lang: AppLang,
): Promise<Analysis> {
  const dict = lang === 'es' ? 'испанского' : 'английского'
  // промпт выверен живым тестом на проде (умная модель): дешёвая теряла
  // фразовые глаголы и ломала формат, поэтому task:'analyze' (стандарт).
  const system = [
    `Ты — словарь ${dict} для русскоязычного ученика. Разбираешь выделенный фрагмент текста.`,
    'Верни ТОЛЬКО валидный JSON без markdown: {"translation":"…","items":[{"kind":"…","base":"…","ru":"…"}]}',
    'kind — РОВНО одно из: phrasal (фразовый глагол), expression (идиома/устойчивое выражение), word (отдельное слово). Пример: {"kind":"phrasal","base":"give up","ru":"бросить"}.',
    'translation — естественный СМЫСЛОВОЙ перевод фрагмента (фразовые глаголы переводи по смыслу: look up to = уважать, НЕ «смотреть вверх»).',
    'base фразового глагола ВКЛЮЧАЕТ частицу/предлог ЦЕЛИКОМ: looked up to → look up to, gave up → give up. Никогда не обрезай до look/give.',
    'В kind:"word" — 2-4 самых полезных ОТДЕЛЬНЫХ слова (не служебные: не up/to/is). Каждую единицу указывай ровно ОДИН раз (не дублируй фразу в phrasal и word). Максимум 7 элементов.',
    'Ничего не выдумывай: если фразовых глаголов/выражений нет — просто не добавляй их.',
  ].join('\n')
  const user = JSON.stringify({ fragment, sentence })
  const raw = await chat([{ role: 'user', content: user }], { system, task: 'analyze' })

  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error('AI вернул не-JSON')
  const o = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>

  const rawItems = Array.isArray(o.items) ? o.items : []
  const items: AnalyzedItem[] = rawItems
    .slice(0, 8)
    .map((x): AnalyzedItem => {
      const it = (x ?? {}) as Record<string, unknown>
      const kind: AnalyzedKind =
        it.kind === 'phrasal' || it.kind === 'expression' ? it.kind : 'word'
      const text = asStr(it.text)
      return { kind, text, base: asStr(it.base) || text, ru: asStr(it.ru) }
    })
    .filter((it) => it.base && it.ru)

  return { translation: asStr(o.translation), items }
}
