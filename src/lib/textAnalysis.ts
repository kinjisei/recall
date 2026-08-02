// ============================================================================
// Движок «Разбор всего текста» (Заход 3e): режем на части (~200 слов), каждую
// разбираем (task 'analyze') с РУБРИКОЙ CEFR; уровень текста считаем В КОДЕ по
// ПОТОЛКУ (самая сложная часть) диапазоном — не усредняем (lib/cefr). Находки
// без жёсткого лимита, по убыванию полезности, дедуп с сохранением порядка.
// Промпт «никогда не пусто»: сначала примечательное под уровень, если мало —
// добор полезным, без выдумывания; плюс страховка-повтор при пустом ответе.
// Финальный запрос (синтез) — только «почему» и «что выучишь». Цена = части + 1.
// ============================================================================
import { chat } from './gemini'
import { loadGrammarCatalog, parseAnalyzedItems, type AnalyzedItem } from './analyze'
import { splitChunks } from './textChunks'
import { levelRange } from './cefr'
import type { AppLang } from '../types'

export interface TextAnalysis {
  /** Уровень текста для показа: «B1» или «B1–B2, сложнее к концу». */
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

// Рубрика CEFR: без неё модель оценивает «на глаз» и занижает простую по виду
// прозу (B1-текст читался как A1). Слабые фолбэк-модели без критериев особенно.
const CEFR_RUBRIC = [
  'Уровень определяй СТРОГО по шкале CEFR, а не «на глаз»:',
  'A1 — только Present Simple, be/have, самые частотные слова, короткие простые предложения.',
  'A2 — Past Simple, going to, can/must, простые придаточные, бытовая лексика.',
  'B1 — Present Perfect, первый кондишн (if…will), сравнения, герундий/инфинитив как подлежащее, придаточные (because/once/although), лексика вроде require/effective/repetition/willpower.',
  'B2 — Perfect Continuous, пассив, второй/третий кондишн, абстрактная и оценочная лексика, длинные сложные предложения.',
  'C1 — инверсия, сложные связки, идиоматика, редкая лексика.',
].join('\n')

async function analyzeChunk(
  chunk: string,
  lang: AppLang,
  catalog: string,
  ids: Set<number>,
): Promise<{ level: string; items: AnalyzedItem[] }> {
  const dict = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ты — преподаватель ${dict} для русскоязычного ученика. Разбираешь фрагмент текста: определи его уровень по CEFR и вытащи из него полезное.`,
    CEFR_RUBRIC,
    'Верни ТОЛЬКО валидный JSON без markdown: {"level":"A1..C1","items":[{"kind":"…","base":"…","ru":"…","topicId":N?}]}',
    'kind — РОВНО одно из: phrasal (фразовый глагол, base ЦЕЛИКОМ: gave up → give up), expression (идиома/устойчивое выражение), word (полезное отдельное слово, не служебное), grammar (грам-структура: base = название, ru = короткое объяснение, "topicId" из каталога если соответствует — не выдумывай).',
    'items СНАЧАЛА — самое примечательное под уровень фрагмента, по УБЫВАНИЮ полезности. Если примечательного мало — ДОБЕРИ полезными словами этого уровня и разбором главной грам-структуры фрагмента, чтобы список НИКОГДА не был пустым. Но ничего не выдумывай: несуществующих фраз/структур не добавляй.',
    'Столько элементов, сколько реально полезно (без мелочи), примерно до 15.',
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
    // без жёсткого лимита в 8 — берём всё полезное (мягкий потолок 20 на кусок)
    items: parseAnalyzedItems(Array.isArray(o.items) ? o.items : [], ids, 20),
  }
}

async function synthesize(
  level: string,
  items: AnalyzedItem[],
  lang: AppLang,
): Promise<{ why: string; takeaway: string }> {
  const dict = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ты помогаешь ученику ${dict}. Уровень текста уже определён: ${level || '—'}. Дан список того, что в тексте найдено.`,
    'Верни ТОЛЬКО JSON: {"why":"почему у текста такой уровень — 1 короткая строка, назови конкретные структуры или лексику","takeaway":"что ученик отсюда возьмёт — 1-2 строки"}. По-русски, просто, без терминов.',
  ].join('\n')
  const user = JSON.stringify({ level, found: items.slice(0, 15).map((i) => i.base) })
  const raw = await chat([{ role: 'user', content: user }], { system, task: 'analyze' })
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) return { why: '', takeaway: '' }
  const o = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>
  return { why: asStr(o.why), takeaway: asStr(o.takeaway) }
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
    // дедуп с СОХРАНЕНИЕМ порядка (модель уже отдала по убыванию полезности)
    for (const it of r.items) {
      const k = it.base.toLowerCase()
      if (!seen.has(k)) {
        seen.add(k)
        items.push(it)
      }
    }
    onProgress?.(++done, total)
  }

  // страховка «никогда не пусто»: разовый повтор по первому куску
  if (items.length === 0 && chunks[0]) {
    const retry = await analyzeChunk(chunks[0], lang, catalog, ids).catch(() => null)
    if (retry) {
      if (retry.level) levels.push(retry.level)
      for (const it of retry.items) {
        const k = it.base.toLowerCase()
        if (!seen.has(k)) {
          seen.add(k)
          items.push(it)
        }
      }
    }
  }

  // уровень — В КОДЕ по потолку, диапазоном (не усредняем): см. lib/cefr
  const range = levelRange(levels)
  const levelStr = range.level ? (range.note ? `${range.level}, ${range.note}` : range.level) : ''

  const syn = await synthesize(range.level, items, lang).catch(() => ({ why: '', takeaway: '' }))
  onProgress?.(++done, total)
  return { level: levelStr, why: syn.why, takeaway: syn.takeaway, items }
}
