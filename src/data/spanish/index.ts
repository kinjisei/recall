// ============================================================================
// Испанский контент — перенесён из Flutter-приложения spanish (d:\projects\spanish).
// Слова с темами (A1/A2), тексты для чтения, диалоги и фразы для произношения.
// Данные встроены в бандл: работают офлайн и не требуют базы.
// ============================================================================
import type {
  SpanishDialogue,
  SpanishReading,
  SpanishSentence,
  SpanishTopic,
  SpanishWord,
} from '../../types'

import wordsA1Json from './words_a1.json'
import wordsA2Json from './words_a2.json'
import readingsJson from './readings.json'
import dialoguesJson from './dialogues.json'
import sentencesJson from './sentences.json'

interface WordsFile {
  topics: SpanishTopic[]
  words: SpanishWord[]
}

const wordsA1 = wordsA1Json as WordsFile
const wordsA2 = wordsA2Json as WordsFile

/** Все темы паков (A1 + A2), в исходном порядке. */
export const spanishTopics: SpanishTopic[] = [...wordsA1.topics, ...wordsA2.topics]

/** Все слова паков (A1 + A2). */
export const spanishWords: SpanishWord[] = [...wordsA1.words, ...wordsA2.words]

/** Слова одной темы. */
export function wordsByTopic(topicId: number): SpanishWord[] {
  return spanishWords.filter((w) => w.topic_id === topicId)
}

/** Тексты для чтения (A1–B2), с русским переводом по абзацам. */
export const spanishReadings = readingsJson as SpanishReading[]

/** Диалоги-сценки (A1–B2), с переводом реплик. */
export const spanishDialogues = dialoguesJson as SpanishDialogue[]

/** Фразы для тренировки произношения (рус → исп). */
export const spanishSentences = sentencesJson as SpanishSentence[]

/** Уровни, встречающиеся в испанском контенте (для фильтров UI). */
export const spanishLevels = ['A1', 'A2', 'B1', 'B2'] as const
