// ============================================================================
// Фразовые глаголы английского: 30 базовых глаголов × 6–12 самых частотных
// фраз. Собрано воркфлоу агентов (Haiku-генерация → Sonnet-проверка →
// критик полноты), 2026-07-23. Структуру проверяет validate-exercises.mjs.
// Модуль грузится ЛЕНИВО (await import) — только на экране «Грамматика» EN.
// ============================================================================
import raw from './phrasal/phrasal.json'

export interface PhrasalItem {
  /** Фраза целиком: «look forward to». */
  phrase: string
  /** Краткий перевод. */
  ru: string
  example: string
  exampleRu: string
  /** true — дополнение можно вставить внутрь (turn the light on). */
  separable: boolean
  level: 'B1' | 'B2'
}

export interface PhrasalEntry {
  /** Базовый глагол: «look». */
  verb: string
  items: PhrasalItem[]
}

export const phrasalVerbs = raw as PhrasalEntry[]
