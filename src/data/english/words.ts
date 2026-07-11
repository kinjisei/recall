// ============================================================================
// Английский словарь: паки слов по темам (B1–C1), авторский контент Recall.
// Модуль подключается ТОЛЬКО динамически (`await import('../data/english/words')`),
// чтобы Vite вынес его в отдельный чанк — как и испанский словарь.
// ============================================================================
import type { EnglishWord, WordTopic } from '../../types'

import wordsB1 from './words/words_b1.json'
import wordsB2 from './words/words_b2.json'
import wordsC1 from './words/words_c1.json'

interface WordsFile {
  topics: WordTopic[]
  words: EnglishWord[]
}

// Порядок важен: B1 → B2 → C1.
const files: WordsFile[] = [wordsB1, wordsB2, wordsC1] as WordsFile[]

/** Все темы английских паков. */
export const allTopics: WordTopic[] = files.flatMap((f) => f.topics)

/** Все слова из всех паков. */
export const allWords: EnglishWord[] = files.flatMap((f) => f.words)

/** Уровни, встречающиеся среди тем (для группировки в UI). */
export const wordLevels = ['B1', 'B2', 'C1'] as const
