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

/** Строка из ответа AI или '' — ответ модели никогда не доверяем на тип. */
function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/**
 * Разбирает JSON-массив из ответа AI и приводит КАЖДЫЙ элемент к {word,base,ru}
 * строками. Без этого мусорный ответ Gemini (число вместо строки, объект без
 * поля) уходил дальше как есть: (t.base || w.word).toLowerCase() на числе бросал
 * бы TypeError, а «база» карточки могла оказаться не строкой.
 */
function parseTranslated(raw: string): Translated[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error('AI вернул не-JSON')
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('AI вернул не массив')
  return parsed.map((x) => {
    const o = (x ?? {}) as Record<string, unknown>
    return { word: asStr(o.word), base: asStr(o.base), ru: asStr(o.ru) }
  })
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
  return parseTranslated(raw)
}

/**
 * Добавляет ОТМЕЧЕННЫЕ слова ОДНОЙ ФРАЗОЙ (для фразовых глаголов и устойчивых
 * выражений: «look up», «give up», «take care of»). Слова должны прийти уже в
 * текстовом порядке. AI даёт словарную форму фразы (инфинитив у глагола) и
 * перевод ВСЕЙ фразы в контексте. Одна карточка. Возвращает true, если добавлена.
 */
export async function addPhrase(words: MarkedWord[], lang: AppLang): Promise<boolean> {
  if (words.length === 0) return false
  const phrase = words.map((w) => w.word).join(' ')
  const sentence = words[0]?.sentence ?? phrase
  const deck = await getDefaultDeck(lang)
  const langName = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ты — словарь ${langName} для русскоязычного ученика.`,
    'Тебе дают ФРАЗУ (часто фразовый глагол или устойчивое выражение) и предложение, где она встретилась.',
    'Верни ТОЛЬКО валидный JSON-объект без markdown: {"base":"…","ru":"…"}.',
    'base — словарная форма ВСЕЙ фразы (для фразового глагола — инфинитив, напр. "looked up" → "look up"; частицу/предлог сохраняй).',
    'ru — краткий перевод всей фразы В КОНТЕКСТЕ этого предложения (1-4 слова).',
  ].join('\n')
  const user = JSON.stringify({ phrase, sentence })

  let base = phrase
  let ru = ''
  try {
    const raw = await chat([{ role: 'user', content: user }], { system, task: 'word' })
    const s = raw.indexOf('{')
    const e = raw.lastIndexOf('}')
    if (s !== -1 && e > s) {
      const o = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>
      base = asStr(o.base) || phrase
      ru = asStr(o.ru)
    }
  } catch {
    // AI сбоит — кладём фразу без перевода (лучше карточка без back, чем ничего)
  }

  const added = await addCardsBulk(deck.id, [
    { front: base.toLowerCase(), back: ru || undefined, example: sentence },
  ])
  return added > 0
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
    // Сопоставляем перевод с исходным словом ПО ПОЗИЦИИ (AI обязан вернуть по
    // одному объекту на входное слово в том же порядке). Map по тексту слова
    // схлопывал бы повторное слово в разных предложениях в одну запись — оба
    // получали бы перевод последнего. Если AI вернул не столько объектов —
    // откатываемся на сопоставление по слову (надёжнее при сбое формата).
    const byIndex = translated.length === chunk.length
    const bySrc = byIndex ? null : new Map(translated.map((t) => [t.word.toLowerCase(), t]))
    added += await addCardsBulk(
      deck.id,
      chunk.map((w, j) => {
        const t = byIndex ? translated[j] : bySrc!.get(w.word.toLowerCase())
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
