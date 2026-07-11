// ============================================================================
// Английский контент Recall (авторский): фразы для «Речи».
// Паки слов НЕ экспортируются отсюда — их грузят лениво из './words'.
// ============================================================================
import sentencesJson from './sentences.json'

/** Фраза для тренировки произношения (англ + русская подсказка). */
export interface EnglishSentence {
  id: number
  level: string
  en: string
  ru: string
}

export const englishSentences: EnglishSentence[] = sentencesJson as EnglishSentence[]
