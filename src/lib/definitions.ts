// ============================================================================
// Английские определения слов для режима «Значения» (Match).
//
// Источники по порядку:
//   1) кэш в localStorage (определения не меняются — храним навсегда);
//   2) Free Dictionary API — бесплатно, без ключа, не тратит квоту Gemini;
//   3) Gemini (light) одним запросом на все оставшиеся слова — если словарь
//      не знает слово (редкие формы, фразы).
// Слово без определения из раунда просто исключается.
//
// Тонкость: словарь (на базе Wiktionary) часто ставит первым узкое или
// устаревшее значение — «brave» → «A Native American warrior». Поэтому из всех
// значений выбираем самое учебное, а часть речи подсказывает русский перевод
// карточки: «храбрый» → нужно adjective, «шептать» → verb.
// ============================================================================
import { lookup, type DictionarySense } from './dictionary'
import { chat } from './gemini'

const CACHE_KEY = 'recall.definitions'
const MAX_LEN = 110

/** Слово, для которого нужно определение (перевод — подсказка по части речи). */
export interface DefinitionRequest {
  word: string
  translation?: string
}

let cache: Record<string, string> | null = null

function readCache(): Record<string, string> {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, string>
  } catch {
    cache = {}
  }
  return cache
}

function writeCache(entries: Record<string, string>) {
  const c = { ...readCache(), ...entries }
  cache = c
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    // переполнение хранилища — не критично, просто не кэшируем
  }
}

/** Короткое определение: первое предложение, без самого слова в открытую. */
function tidy(definition: string, word: string): string {
  let d = definition.trim().replace(/\s+/g, ' ')
  const dot = d.indexOf('. ')
  if (dot > 30) d = d.slice(0, dot + 1)
  if (d.length > MAX_LEN) d = d.slice(0, MAX_LEN).replace(/\s+\S*$/, '') + '…'
  // не подсказываем ответ: прячем само слово, если оно попало в определение
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'gi')
  return d.replace(re, '…')
}

/**
 * Годится ли определение после маскировки. Словарь часто толкует слово через
 * него же («protest» → «A protest.»), и от такого определения остаются одни
 * точки — в игре это бесполезная подсказка.
 */
function isUsable(masked: string): boolean {
  const meaningful = masked.replace(/…/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return meaningful.length >= 12 && meaningful.split(/\s+/).length >= 3
}

/** Часть речи, которую подсказывает русский перевод карточки. */
function expectedPos(translation?: string): 'verb' | 'adjective' | 'noun' | null {
  if (!translation) return null
  const w = translation.toLowerCase().split(/[,;(/]/)[0].trim()
  if (!w) return null
  if (/(ться|ть|чь)$/.test(w)) return 'verb'
  if (/(ый|ий|ой|ая|яя|ое|ее|ые|ие)$/.test(w)) return 'adjective'
  return 'noun'
}

/** Насколько значение годится для учебной игры (больше — лучше). */
function scoreSense(masked: string, pos: string, want: ReturnType<typeof expectedPos>): number {
  let score = 0
  // часть речи, совпадающая с переводом, важнее всего
  if (want) {
    if (pos === want) score += 8
    else if (pos) score -= 4
  }
  // заглавные слова в середине — признак узкого/культурного значения
  const propers = masked.slice(1).match(/\b[A-Z][a-z]{2,}/g)
  score -= (propers?.length ?? 0) * 3
  // пометки редкости прямо в тексте словаря
  if (/\b(obsolete|archaic|dialect|slang|historical|heraldry|nautical)\b/i.test(masked)) score -= 5
  // «Of materials: …», «(of a person) …» — сужающие оговорки
  if (/^\(?of /i.test(masked)) score -= 2
  const len = masked.length
  if (len < 25) score -= 2
  else if (len <= 100) score += 1
  return score
}

/** Лучшее пригодное значение из всех, что дал словарь. */
function pickDefinition(
  senses: DictionarySense[] | undefined,
  word: string,
  translation?: string,
): string | undefined {
  const want = expectedPos(translation)
  let best: string | undefined
  let bestScore = -Infinity
  for (const sense of senses ?? []) {
    const masked = tidy(sense.text, word)
    if (!isUsable(masked)) continue
    const score = scoreSense(masked, sense.pos, want)
    if (score > bestScore) {
      best = masked
      bestScore = score
    }
  }
  return best
}

/** Определения от Gemini для слов, которых нет в словаре (одним запросом). */
async function fromGemini(words: string[]): Promise<Record<string, string>> {
  if (words.length === 0) return {}
  const system =
    'Ты англо-английский словарь для изучающих язык. Отвечай ТОЛЬКО JSON-объектом ' +
    'вида {"слово": "определение"}. Определение — простой английский (уровень B1), ' +
    'одна короткая фраза до 12 слов, БЕЗ использования самого слова.'
  try {
    const raw = await chat([{ role: 'user', content: `Words: ${words.join(', ')}` }], {
      system,
      light: true,
    })
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    const parsed = JSON.parse(json) as Record<string, string>
    const out: Record<string, string> = {}
    for (const [w, d] of Object.entries(parsed)) {
      if (typeof d !== 'string' || !d.trim()) continue
      const masked = tidy(d, w)
      if (isUsable(masked)) out[w.toLowerCase()] = masked
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Определения для набора слов. Возвращает только те, что удалось найти,
 * ключ — слово в нижнем регистре.
 */
export async function getDefinitions(
  requests: DefinitionRequest[],
): Promise<Record<string, string>> {
  const byWord = new Map<string, DefinitionRequest>()
  for (const r of requests) {
    const key = r.word.trim().toLowerCase()
    if (key && !byWord.has(key)) byWord.set(key, r)
  }

  const cached = readCache()
  const out: Record<string, string> = {}
  const missing: DefinitionRequest[] = []

  for (const [key, req] of byWord) {
    if (cached[key]) out[key] = cached[key]
    else missing.push({ ...req, word: key })
  }
  if (missing.length === 0) return out

  // Free Dictionary — параллельно, он бесплатный и быстрый
  const fresh: Record<string, string> = {}
  const results = await Promise.all(
    missing.map((req) =>
      lookup(req.word)
        .then((r) => [req.word, pickDefinition(r?.definitions, req.word, req.translation)] as const)
        .catch(() => [req.word, undefined] as const),
    ),
  )
  const stillMissing: string[] = []
  for (const [w, def] of results) {
    // pickDefinition уже вернул готовый (обрезанный и замаскированный) текст
    if (def) fresh[w] = def
    else stillMissing.push(w)
  }

  Object.assign(fresh, await fromGemini(stillMissing))

  if (Object.keys(fresh).length > 0) writeCache(fresh)
  return { ...out, ...fresh }
}
