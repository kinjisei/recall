// ============================================================================
// Анти-повтор игр: история недавно показанных слов (на язык) в localStorage.
// Вынесено из wordPool в чистый модуль (без клиента БД) — гоняется мини-тестом
// scripts/test-distractors.mjs. Смысл: «в каждой игре одни и те же слова» —
// потому что раунды не помнили, что уже показывали.
// ============================================================================

// .ts в пути — этот модуль грузят node-тесты напрямую (стрип типов), которым
// нужно явное расширение; vite/tsc такой импорт тоже принимают.
import { readJson, writeJson } from './storage.ts'

const RECENT_KEY = 'recall.recent_words'
export const RECENT_MAX = 40

export function loadRecent(lang: string): string[] {
  const list = readJson<string[]>(`${RECENT_KEY}.${lang}`, [])
  return Array.isArray(list) ? list : []
}

/** Пометить слова показанными (все режимы, включая Спринт и Диктант). */
export function recordShown(lang: string, terms: string[]): void {
  if (terms.length === 0) return
  const now = new Set(terms.map((t) => t.toLowerCase()))
  const rest = loadRecent(lang).filter((t) => !now.has(t))
  writeJson(`${RECENT_KEY}.${lang}`, [...rest, ...now].slice(-RECENT_MAX))
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
