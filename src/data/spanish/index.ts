// ============================================================================
// Испанский контент — перенесён из Flutter-приложения spanish (d:\projects\spanish).
// Тексты для чтения, диалоги и фразы для произношения (встроены в бандл).
//
// Словарь (все паки слов, ~4668 слов) вынесен в ./words.ts и грузится ЛЕНИВО
// (`await import('./words')`) — он тяжёлый и нужен не на каждом экране.
// ============================================================================
import type {
  SpanishDialogue,
  SpanishReading,
  SpanishSentence,
} from '../../types'

import readingsJson from './readings.json'
import dialoguesJson from './dialogues.json'
import sentencesJson from './sentences.json'

/** Тексты для чтения (A1–B2), с русским переводом по абзацам. */
export const spanishReadings = readingsJson as SpanishReading[]

/** Диалоги-сценки (A1–B2), с переводом реплик. */
export const spanishDialogues = dialoguesJson as SpanishDialogue[]

/** Фразы для тренировки произношения (рус → исп). */
export const spanishSentences = sentencesJson as SpanishSentence[]

/** Уровни, встречающиеся в испанском контенте (для фильтров UI). */
export const spanishLevels = ['A1', 'A2', 'B1', 'B2'] as const
