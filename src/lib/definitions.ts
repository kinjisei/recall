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
  // пометки редкости/узости прямо в тексте словаря
  if (
    /\b(obsolete|archaic|dialect|slang|historical|heraldry|nautical|monarch|nobleman|formerly|chiefly|poetic|rare|dated|in former times)\b/i.test(
      masked,
    )
  )
    score -= 6
  // «Of materials: …», «(of a person) …» — сужающие оговорки
  if (/^\(?of /i.test(masked)) score -= 2
  // отсылки «see …», «same as …» — бесполезны в игре
  if (/\b(see|same as|used to)\b/i.test(masked.slice(0, 20))) score -= 3
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
  const list = senses ?? []
  for (let i = 0; i < list.length; i++) {
    const masked = tidy(list[i].text, word)
    if (!isUsable(masked)) continue
    // ранние значения обычно частотнее — небольшой бонус за место в списке
    const score = scoreSense(masked, list[i].pos, want) + Math.max(0, 3 - i)
    if (score > bestScore) {
      best = masked
      bestScore = score
    }
  }
  return best
}

/** Определения от Gemini для слов, которых нет в словаре (одним запросом). */
async function fromGemini(words: string[], simple: boolean): Promise<Record<string, string>> {
  if (words.length === 0) return {}
  const system =
    'Ты англо-английский словарь для изучающих язык. Отвечай ТОЛЬКО JSON-объектом ' +
    'вида {"слово": "определение"}. ' +
    (simple
      ? 'Определение — ОЧЕНЬ простой английский для новичка (A1–A2): максимум 8 слов, ' +
        'только самые частотные слова, как объяснил бы ребёнку. Пример: chair → ' +
        '"you sit on it". Никаких научных или энциклопедических формулировок. '
      : 'Определение — простой английский (уровень B1), одна короткая фраза до 12 слов. ') +
    'БЕЗ использования самого слова.'
  try {
    const raw = await chat([{ role: 'user', content: `Words: ${words.join(', ')}` }], {
      system,
      task: 'definition', // простые определения — сервер даст мини-модель
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
 *
 * level — уровень ученика: для A1/A2 словарные определения (часто взрослые и
 * «энциклопедичные») не годятся, поэтому Free Dictionary пропускается и все
 * определения пишет Gemini сверхпростым английским. Кэш у простых определений
 * отдельный (префикс "s:"), чтобы уровни не перемешивались.
 */
export async function getDefinitions(
  requests: DefinitionRequest[],
  level?: string | null,
): Promise<Record<string, string>> {
  const simple = level === 'A1' || level === 'A2'
  const ck = (w: string) => (simple ? 's:' + w : w)

  const byWord = new Map<string, DefinitionRequest>()
  for (const r of requests) {
    const key = r.word.trim().toLowerCase()
    if (key && !byWord.has(key)) byWord.set(key, r)
  }

  const cached = readCache()
  const out: Record<string, string> = {}
  const missing: DefinitionRequest[] = []

  for (const [key, req] of byWord) {
    if (cached[ck(key)]) out[key] = cached[ck(key)]
    else missing.push({ ...req, word: key })
  }
  if (missing.length === 0) return out

  const fresh: Record<string, string> = {}

  // AI (через лёгкий путь chat → Groq) — ОСНОВНОЙ источник: определения чище и
  // проще словарных (Free Dictionary давал архаичные толкования вроде
  // «interview → meeting of monarchs»), а у Groq щедрый бесплатный лимит —
  // Gemini не трогаем. Всё кэшируется в localStorage навсегда.
  Object.assign(fresh, await fromGemini(missing.map((r) => r.word), simple))

  // Кого AI вдруг не вернул (редко) — добираем бесплатным словарём (не для новичка).
  if (!simple) {
    const rest = missing.filter((r) => !fresh[r.word])
    if (rest.length > 0) {
      const results = await Promise.all(
        rest.map((req) =>
          lookup(req.word)
            .then((r) => [req.word, pickDefinition(r?.definitions, req.word, req.translation)] as const)
            .catch(() => [req.word, undefined] as const),
        ),
      )
      for (const [w, def] of results) if (def) fresh[w] = def
    }
  }

  if (Object.keys(fresh).length > 0) {
    writeCache(Object.fromEntries(Object.entries(fresh).map(([w, d]) => [ck(w), d])))
  }
  return { ...out, ...fresh }
}
