// ============================================================================
// Испанский словарь для «Ввода»: перевод слова на русский.
// Порядок поиска:
//   1) локальные паки слов (все ~4668 слов, src/data/spanish/words) — офлайн;
//   2) Gemini через наш /api/gemini — для слов вне паков.
// (Free Dictionary API надёжно работает только для английского.)
//
// Полный словарь грузится ЛЕНИВО (динамический import) и кэшируется —
// его ~1.4 МБ не тянутся в стартовый бандл.
// ============================================================================
import { chat } from './gemini'
import type { SpanishWord } from '../types'

export interface SpanishLookupResult {
  word: string
  translation?: string
  example?: string
  exampleRu?: string
}

// Кэш загруженного словаря (промис, чтобы не грузить дважды).
let wordsPromise: Promise<SpanishWord[]> | null = null
function loadWords(): Promise<SpanishWord[]> {
  if (!wordsPromise) {
    wordsPromise = import('../data/spanish/words').then((m) => m.allWords)
  }
  return wordsPromise
}

/** Убирает пунктуацию/регистр, оставляя испанские буквы. */
function cleanWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-záéíóúüñ'-]/gi, '')
}

/** Слово без артикля: «el viaje» → «viaje» (в паках слова часто с артиклем). */
function stripArticle(s: string): string {
  return s.replace(/^(el|la|los|las|un|una)\s+/i, '')
}

/** Поиск в локальных паках (точное слово или совпадение без артикля). */
async function lookupLocal(word: string): Promise<SpanishLookupResult | null> {
  const target = cleanWord(word)
  if (!target) return null

  const words = await loadWords()
  for (const w of words) {
    const entry = w.spanish.toLowerCase()
    if (entry === target || stripArticle(entry) === target) {
      return {
        word: w.spanish,
        translation: w.russian,
        example: w.example_es,
        exampleRu: w.example_ru,
      }
    }
  }
  return null
}

/** Запасной путь: перевод через Gemini. Просим строгий JSON и парсим его. */
async function lookupAi(word: string): Promise<SpanishLookupResult | null> {
  const target = cleanWord(word)
  if (!target) return null

  try {
    const raw = await chat([{ role: 'user', content: target }], {
      task: 'word', // перевод одного слова — мини-модель справляется
      system: [
        'Ты — испанско-русский словарь. Пользователь присылает одно испанское слово.',
        'Ответь СТРОГО одним JSON-объектом без пояснений и без markdown:',
        '{"word":"слово с артиклем, если это существительное",',
        '"translation":"перевод на русский (1-3 варианта через запятую)",',
        '"example":"короткий пример на испанском",',
        '"exampleRu":"перевод примера на русский"}',
      ].join(' '),
    })

    // Gemini иногда оборачивает JSON в ```json … ``` — вырезаем объект.
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Partial<SpanishLookupResult>
    if (!parsed.translation) return null
    return {
      word: parsed.word || target,
      translation: parsed.translation,
      example: parsed.example,
      exampleRu: parsed.exampleRu,
    }
  } catch {
    return null
  }
}

/**
 * Ищет перевод испанского слова: локальные паки → Gemini.
 * null — если слово не найдено нигде (его всё равно можно добавить в колоду).
 */
export async function lookupSpanish(word: string): Promise<SpanishLookupResult | null> {
  return (await lookupLocal(word)) ?? (await lookupAi(word))
}
