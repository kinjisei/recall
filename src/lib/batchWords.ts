// ============================================================================
// Пакетное добавление отмеченных слов из читалки: ОДИН запрос AI (tier lite)
// на всю пачку — базовая форма + краткий перевод в контексте предложения.
// Бережём квоту: не по запросу на слово, а чанками до 15 слов за вызов.
// Результат кладётся addCardsBulk с предложением-примером.
// ============================================================================
import { chat } from './gemini'
import { addCardsBulk, getDefaultDeck } from './cards'
import type { AppLang } from '../types'

export interface MarkedWord {
  word: string
  sentence: string
}

interface Translated {
  word: string
  base: string
  ru: string
}

const CHUNK = 15

function parseJsonArray<T>(raw: string): T[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error('AI вернул не-JSON')
  return JSON.parse(raw.slice(start, end + 1)) as T[]
}

async function translateChunk(words: MarkedWord[], lang: AppLang): Promise<Translated[]> {
  const langName = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ты — словарь ${langName} для русскоязычного ученика.`,
    'Для КАЖДОГО слова из списка верни: base — словарная (начальная) форма, ru — краткий перевод по-русски (1-3 слова) В КОНТЕКСТЕ данного предложения.',
    'Отвечай ТОЛЬКО валидным JSON-массивом без markdown: [{"word":"…","base":"…","ru":"…"}, …] — ровно по одному объекту на входное слово, в том же порядке.',
  ].join('\n')
  const user = JSON.stringify(words.map((w) => ({ word: w.word, sentence: w.sentence })))
  const raw = await chat([{ role: 'user', content: user }], { system, task: 'batch' })
  return parseJsonArray<Translated>(raw)
}

/**
 * Переводит пачку слов и кладёт их в колоду по умолчанию данного языка.
 * Возвращает число реально добавленных карточек (дубликаты пропускаются).
 */
export async function addMarkedWords(words: MarkedWord[], lang: AppLang): Promise<number> {
  if (words.length === 0) return 0
  const deck = await getDefaultDeck(lang)

  let added = 0
  for (let i = 0; i < words.length; i += CHUNK) {
    const chunk = words.slice(i, i + CHUNK)
    let translated: Translated[]
    try {
      translated = await translateChunk(chunk, lang)
    } catch {
      // AI сбоит — кладём слова без перевода (лучше карточка без back, чем ничего)
      translated = chunk.map((w) => ({ word: w.word, base: w.word, ru: '' }))
    }
    const bySrc = new Map(translated.map((t) => [t.word.toLowerCase(), t]))
    added += await addCardsBulk(
      deck.id,
      chunk.map((w) => {
        const t = bySrc.get(w.word.toLowerCase())
        return {
          front: (t?.base || w.word).toLowerCase(),
          back: t?.ru || undefined,
          example: w.sentence,
        }
      }),
    )
  }
  return added
}
