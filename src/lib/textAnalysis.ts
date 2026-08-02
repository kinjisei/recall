// ============================================================================
// Движок «Разбор всего текста»: режем на части (~200 слов, textChunks), каждую
// разбираем (task 'analyze'), дедуплицируем находки по base, финальным запросом
// сводим общий уровень + «что выучишь». Цена = число частей + 1. Кэш — отдельно
// (textAnalysisCache). UI (лист-итог) — Заход 2b.
// ============================================================================
import { chat } from './gemini'
import { loadGrammarCatalog, parseAnalyzedItems, type AnalyzedItem } from './analyze'
import { splitChunks, mostCommon } from './textChunks'
import type { AppLang } from '../types'

export interface TextAnalysis {
  /** Итоговый уровень текста (A1..C1). */
  level: string
  /** Почему такой уровень — одна строка. */
  why: string
  /** Что ученик отсюда возьмёт — 1-2 строки. */
  takeaway: string
  /** Найденное по всему тексту (дедуп): фразовые/выражения/слова/грамматика. */
  items: AnalyzedItem[]
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

async function analyzeChunk(
  chunk: string,
  lang: AppLang,
  catalog: string,
  ids: Set<number>,
): Promise<{ level: string; items: AnalyzedItem[] }> {
  const dict = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ты — словарь ${dict} для русскоязычного ученика. Разбираешь фрагмент текста.`,
    'Верни ТОЛЬКО валидный JSON без markdown: {"level":"A1..C1","items":[{"kind":"…","base":"…","ru":"…","topicId":N?}]}',
    'level — уровень СЛОЖНОСТИ этого фрагмента (A1/A2/B1/B2/C1).',
    'kind — РОВНО одно из: phrasal, expression, word, grammar. base фразового глагола ЦЕЛИКОМ (gave up → give up). kind:"word" — 2-4 полезных отдельных слова. kind:"grammar" — название структуры + объяснение (ru) + "topicId" из каталога, если есть (не выдумывай).',
    'Максимум 8 элементов. Ничего не выдумывай.',
    catalog ? `Каталог уроков (id · уровень · название):\n${catalog}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const raw = await chat([{ role: 'user', content: chunk }], { system, task: 'analyze' })
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) return { level: '', items: [] }
  const o = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>
  return {
    level: asStr(o.level),
    items: parseAnalyzedItems(Array.isArray(o.items) ? o.items : [], ids),
  }
}

async function synthesize(
  levels: string[],
  items: AnalyzedItem[],
  lang: AppLang,
): Promise<{ level: string; why: string; takeaway: string }> {
  const dict = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ты помогаешь ученику ${dict}. Даны уровни частей текста и что в нём найдено.`,
    'Верни ТОЛЬКО JSON: {"level":"A1..C1","why":"почему такой уровень, 1 строка","takeaway":"что ученик отсюда возьмёт, 1-2 строки"}. По-русски, просто, без терминов.',
  ].join('\n')
  const user = JSON.stringify({ levels, found: items.slice(0, 12).map((i) => i.base) })
  const raw = await chat([{ role: 'user', content: user }], { system, task: 'analyze' })
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) return { level: mostCommon(levels), why: '', takeaway: '' }
  const o = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>
  return {
    level: asStr(o.level) || mostCommon(levels),
    why: asStr(o.why),
    takeaway: asStr(o.takeaway),
  }
}

/**
 * Полный разбор текста. onProgress(done, total) — для прогресса в UI.
 * Стоимость (AI-действий) = число частей + 1; сверяется с estimateCost().
 */
export async function analyzeText(
  text: string,
  lang: AppLang,
  onProgress?: (done: number, total: number) => void,
): Promise<TextAnalysis> {
  const chunks = splitChunks(text)
  const total = chunks.length + 1
  const { text: catalog, ids } = await loadGrammarCatalog(lang)

  const levels: string[] = []
  const seen = new Set<string>()
  const items: AnalyzedItem[] = []
  let done = 0
  for (const chunk of chunks) {
    const r = await analyzeChunk(chunk, lang, catalog, ids).catch(() => ({
      level: '',
      items: [] as AnalyzedItem[],
    }))
    if (r.level) levels.push(r.level)
    for (const it of r.items) {
      const k = it.base.toLowerCase()
      if (!seen.has(k)) {
        seen.add(k)
        items.push(it)
      }
    }
    onProgress?.(++done, total)
  }

  const syn = await synthesize(levels, items, lang).catch(() => ({
    level: mostCommon(levels),
    why: '',
    takeaway: '',
  }))
  onProgress?.(++done, total)
  return { level: syn.level, why: syn.why, takeaway: syn.takeaway, items }
}
