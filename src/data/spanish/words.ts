// ============================================================================
// Полный испанский словарь: ВСЕ паки слов из приложения spanish (~4668 слов,
// ~281 тема, уровни A1–B2), включая большой частотный CSV-пак.
//
// Этот модуль тяжёлый (~1.4 МБ), поэтому его подключают ТОЛЬКО динамически
// (`await import('../data/spanish/words')`) — Vite выносит его в отдельный
// чанк, который грузится лишь при открытии «Паков» или поиске исп. слова.
// ============================================================================
import type { SpanishTopic, SpanishWord } from '../../types'

import wordsA1 from './words/words_a1.json'
import wordsA1Extra from './words/words_a1_extra.json'
import wordsA1Pack2 from './words/words_a1_pack2.json'
import wordsA2 from './words/words_a2.json'
import wordsA2Extra from './words/words_a2_extra.json'
import wordsA2Extra2 from './words/words_a2_extra2.json'
import wordsA2Pack3 from './words/words_a2_pack3.json'
import wordsA2Pack4 from './words/words_a2_pack4.json'
import wordsB1 from './words/words_b1.json'
import wordsB1Extra from './words/words_b1_extra.json'
import wordsB1Extra2 from './words/words_b1_extra2.json'
import wordsB1Pack3 from './words/words_b1_pack3.json'
import wordsB1Pack4 from './words/words_b1_pack4.json'
import wordsB1Pack5 from './words/words_b1_pack5.json'
import wordsB1Pack6 from './words/words_b1_pack6.json'
import wordsB1Pack7 from './words/words_b1_pack7.json'
import wordsB2 from './words/words_b2.json'
import wordsB2Pack2 from './words/words_b2_pack2.json'
import wordsB2Pack3 from './words/words_b2_pack3.json'
import wordsConnectorsPack from './words/words_connectors_pack.json'
import wordsCsvPack from './words/words_csv_pack.json'
import wordsPhrasesDialogues from './words/words_phrases_dialogues.json'
import wordsPhrasesDialogues2 from './words/words_phrases_dialogues2.json'
import wordsSpeakingPack from './words/words_speaking_pack.json'

interface WordsFile {
  topics: SpanishTopic[]
  words: SpanishWord[]
}

// Порядок важен: A1 → A2 → B1 → B2 → спец-паки (связки, частотный CSV, фразы).
const files: WordsFile[] = [
  wordsA1,
  wordsA1Extra,
  wordsA1Pack2,
  wordsA2,
  wordsA2Extra,
  wordsA2Extra2,
  wordsA2Pack3,
  wordsA2Pack4,
  wordsB1,
  wordsB1Extra,
  wordsB1Extra2,
  wordsB1Pack3,
  wordsB1Pack4,
  wordsB1Pack5,
  wordsB1Pack6,
  wordsB1Pack7,
  wordsB2,
  wordsB2Pack2,
  wordsB2Pack3,
  wordsConnectorsPack,
  wordsCsvPack,
  wordsPhrasesDialogues,
  wordsPhrasesDialogues2,
  wordsSpeakingPack,
] as WordsFile[]

// Темы: дедуп по id (первое вхождение выигрывает). Два файла «фразы из диалогов»
// делят id 9001–9004 — их слова просто сливаются в одни и те же темы.
const topicMap = new Map<number, SpanishTopic>()
for (const f of files) {
  for (const t of f.topics) {
    if (!topicMap.has(t.id)) topicMap.set(t.id, t)
  }
}

/** Все темы паков (A1–B2 + спец-наборы), в исходном порядке появления. */
export const allTopics: SpanishTopic[] = [...topicMap.values()]

/** Все слова из всех паков. */
export const allWords: SpanishWord[] = files.flatMap((f) => f.words)

/** Слова одной темы. */
export function wordsByTopic(topicId: number): SpanishWord[] {
  return allWords.filter((w) => w.topic_id === topicId)
}

/** Уровни, встречающиеся среди тем (для группировки в UI). */
export const wordLevels = ['A1', 'A2', 'B1', 'B2'] as const
