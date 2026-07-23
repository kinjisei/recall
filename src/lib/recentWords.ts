// ============================================================================
// Анти-повтор игр: история недавно показанных слов (на язык) в localStorage.
// Вынесено из wordPool в чистый модуль (без клиента БД) — гоняется мини-тестом
// scripts/test-distractors.mjs. Смысл: «в каждой игре одни и те же слова» —
// потому что раунды не помнили, что уже показывали.
// ============================================================================

const RECENT_KEY = 'recall.recent_words'
export const RECENT_MAX = 40

export function loadRecent(lang: string): string[] {
  try {
    const raw = localStorage.getItem(`${RECENT_KEY}.${lang}`)
    const list = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** Пометить слова показанными (все режимы, включая Спринт и Диктант). */
export function recordShown(lang: string, terms: string[]): void {
  if (terms.length === 0) return
  try {
    const now = new Set(terms.map((t) => t.toLowerCase()))
    const rest = loadRecent(lang).filter((t) => !now.has(t))
    const next = [...rest, ...now].slice(-RECENT_MAX)
    localStorage.setItem(`${RECENT_KEY}.${lang}`, JSON.stringify(next))
  } catch {
    /* приватный режим — истории просто не будет */
  }
}

/** Отфильтровать недавно показанные (пока кандидатов хватает на nNeed). */
export function withoutRecent<T extends { term: string }>(
  lang: string,
  items: T[],
  nNeed: number,
): T[] {
  const recent = new Set(loadRecent(lang))
  const fresh = items.filter((i) => !recent.has(i.term.toLowerCase()))
  return fresh.length >= nNeed ? fresh : items
}
