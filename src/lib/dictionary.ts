// ============================================================================
// Словарь — Free Dictionary API (https://dictionaryapi.dev), без ключа.
// Контракт: docs/ARCHITECTURE.md §7 — lookup(word).
// ============================================================================

/** Значение слова вместе с частью речи (noun/verb/adjective…). */
export interface DictionarySense {
  text: string
  pos: string
}

export interface DictionaryResult {
  word: string
  definition?: string
  /** Все найденные значения (для режима «Значения»: первое не всегда годится). */
  definitions?: DictionarySense[]
  example?: string
  ipa?: string
  audio_url?: string
}

/** Нормализуем аудио-ссылку (API иногда отдаёт «//ssl.gstatic…»). */
function normalizeAudio(url?: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('//')) return 'https:' + url
  return url
}

/**
 * Ищет слово в англо-английском словаре.
 * Возвращает определение, пример, транскрипцию и ссылку на произношение.
 * null — если слово не найдено или нет сети.
 */
export async function lookup(word: string): Promise<DictionaryResult | null> {
  const clean = word
    .trim()
    .toLowerCase()
    .replace(/[^a-z'-]/g, '')
  if (!clean) return null

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
    )
    if (!res.ok) return null
    const data = await res.json()
    const entry = Array.isArray(data) ? data[0] : null
    if (!entry) return null

    let ipa: string | undefined = entry.phonetic
    let audio: string | undefined
    for (const p of entry.phonetics ?? []) {
      if (!ipa && p.text) ipa = p.text
      if (!audio && p.audio) audio = p.audio
    }

    let definition: string | undefined
    let example: string | undefined
    const definitions: DictionarySense[] = []
    for (const meaning of entry.meanings ?? []) {
      for (const def of meaning.definitions ?? []) {
        if (!def?.definition) continue
        if (!definition) {
          definition = def.definition
          example = def.example
        }
        definitions.push({ text: def.definition, pos: meaning.partOfSpeech ?? '' })
        if (definitions.length >= 12) break
      }
      if (definitions.length >= 12) break
    }

    return {
      word: clean,
      definition,
      definitions,
      example,
      ipa: ipa ? ipa.replace(/\//g, '') : undefined,
      audio_url: normalizeAudio(audio),
    }
  } catch {
    return null
  }
}
