// ============================================================================
// Готовые паки слов — общий источник для ученика и преподавателя.
//
// Ученик берёт паки сам («Учёба → Мой словарь → Паки»), преподаватель выдаёт их
// адресно из карточки ученика. Загрузка и разбивка на категории живут ЗДЕСЬ, а
// не в двух экранах: разъехавшись, они показали бы одному и тому же паку разные
// уровни и разные названия категорий — а сверить это глазами невозможно.
//
// Словари грузятся динамическим import: каждый язык — отдельный чанк (испанский
// ~836 КБ), в стартовый бандл он не попадает.
// ============================================================================
import type { AppLang, WordTopic } from '../types'

/** Слово пака в общем виде — уже как будущая карточка. */
export interface PackWord {
  front: string
  back: string
  example?: string
}

export interface LoadedPacks {
  topics: WordTopic[]
  wordsByTopic: Map<number, PackWord[]>
}

/** Категория пака: база уровня, идиомы или обычные темы. */
export type PackCategory = 'base' | 'idioms' | 'themes'

/**
 * Категория по названию темы. Правило одно на приложение: «База уровня» —
 * частотный минимум, «Идиомы» — сборник EFE, остальное — тематические паки.
 */
export function packCategory(topicName: string): PackCategory {
  if (topicName.startsWith('База')) return 'base'
  if (topicName.startsWith('Идиомы')) return 'idioms'
  return 'themes'
}

export const PACK_CATEGORY_LABEL: Record<PackCategory, string> = {
  base: '⭐ База уровня — самые нужные слова',
  themes: 'Темы',
  idioms: 'Идиомы',
}

/** Ленивая загрузка словаря нужного языка (каждый — отдельный чанк). */
export async function loadPacks(lang: AppLang): Promise<LoadedPacks> {
  const map = new Map<number, PackWord[]>()
  let topics: WordTopic[]
  if (lang === 'es') {
    const m = await import('../data/spanish/words')
    topics = m.allTopics
    for (const w of m.allWords) {
      const arr = map.get(w.topic_id) ?? []
      arr.push({ front: w.spanish, back: w.russian, example: w.example_es })
      map.set(w.topic_id, arr)
    }
  } else {
    const m = await import('../data/english/words')
    topics = m.allTopics
    for (const w of m.allWords) {
      const arr = map.get(w.topic_id) ?? []
      arr.push({ front: w.english, back: w.russian, example: w.example_en })
      map.set(w.topic_id, arr)
    }
  }
  return { topics, wordsByTopic: map }
}

/** Порядок уровней для группировки в списках. */
export const PACK_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
