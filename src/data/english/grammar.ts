// ============================================================================
// Грамматика английского — авторские уроки Recall (пополняются по уровням).
// У темы: theory (paragraph/table/example c полем en) + exercises (mcq/fill/order).
//
// Модуль грузится ЛЕНИВО (`await import('../data/english/grammar')`) — нужен
// только на экране «Грамматика», в стартовый бандл не тянется.
// ============================================================================
import type { GrammarTopic } from '../../types'

import grammarA1 from './grammar/grammar_a1.json'
import grammarA1Extra from './grammar/grammar_a1_extra.json'
import grammarA2 from './grammar/grammar_a2.json'
import grammarA2Extra from './grammar/grammar_a2_extra.json'
import grammarB1 from './grammar/grammar_b1.json'
import grammarB1Extra from './grammar/grammar_b1_extra.json'
import grammarB2 from './grammar/grammar_b2.json'
import grammarB2Extra from './grammar/grammar_b2_extra.json'
import grammarC1 from './grammar/grammar_c1.json'
import grammarC1Extra from './grammar/grammar_c1_extra.json'

// Тип без поля id (в JSON его нет — присваиваем ниже).
type RawTopic = Omit<GrammarTopic, 'id'>

const files: RawTopic[][] = [
  grammarA1,
  grammarA1Extra,
  grammarA2,
  grammarA2Extra,
  grammarB1,
  grammarB1Extra,
  grammarB2,
  grammarB2Extra,
  grammarC1,
  grammarC1Extra,
] as RawTopic[][]

const levelRank: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4 }

// Собираем все темы, сортируем по уровню → order → title и нумеруем (id = индекс).
const merged: RawTopic[] = files.flat()
merged.sort((a, b) => {
  const lr = (levelRank[a.level] ?? 9) - (levelRank[b.level] ?? 9)
  if (lr !== 0) return lr
  const or = (a.order ?? 0) - (b.order ?? 0)
  if (or !== 0) return or
  return a.title.localeCompare(b.title, 'ru')
})

/** Все темы английской грамматики с присвоенными id. */
export const grammarTopics: GrammarTopic[] = merged.map((t, i) => ({ ...t, id: i }))

/** Уровни, на которых уже есть уроки. */
export const grammarLevels = [...new Set(merged.map((t) => t.level))]
