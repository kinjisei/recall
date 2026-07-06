// ============================================================================
// Грамматика испанского — уроки A1–B2 (74 темы), перенесены из приложения spanish.
// У темы: theory (paragraph/table/example) + exercises (mcq/fill/order).
//
// Модуль грузится ЛЕНИВО (`await import('../data/spanish/grammar')`) — нужен
// только на экране «Грамматика», в стартовый бандл не тянется.
// ============================================================================
import type { GrammarTopic } from '../../types'

import grammarA1 from './grammar/grammar_a1.json'
import grammarA1Extra from './grammar/grammar_a1_extra.json'
import grammarA1Extra2 from './grammar/grammar_a1_extra2.json'
import grammarA2 from './grammar/grammar_a2.json'
import grammarA2Extra from './grammar/grammar_a2_extra.json'
import grammarA2Extra2 from './grammar/grammar_a2_extra2.json'
import grammarA2Extra3 from './grammar/grammar_a2_extra3.json'
import grammarB1 from './grammar/grammar_b1.json'
import grammarB1Extra from './grammar/grammar_b1_extra.json'
import grammarB1Extra2 from './grammar/grammar_b1_extra2.json'
import grammarB1Extra3 from './grammar/grammar_b1_extra3.json'
import grammarB2 from './grammar/grammar_b2.json'
import grammarB2Extra2 from './grammar/grammar_b2_extra2.json'
import grammarB2Extra3 from './grammar/grammar_b2_extra3.json'

// Тип без поля id (в JSON его нет — присваиваем ниже).
type RawTopic = Omit<GrammarTopic, 'id'>

const files: RawTopic[][] = [
  grammarA1,
  grammarA1Extra,
  grammarA1Extra2,
  grammarA2,
  grammarA2Extra,
  grammarA2Extra2,
  grammarA2Extra3,
  grammarB1,
  grammarB1Extra,
  grammarB1Extra2,
  grammarB1Extra3,
  grammarB2,
  grammarB2Extra2,
  grammarB2Extra3,
] as RawTopic[][]

const levelRank: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3 }

// Собираем все темы, сортируем по уровню → order → title и нумеруем (id = индекс).
const merged: RawTopic[] = files.flat()
merged.sort((a, b) => {
  const lr = (levelRank[a.level] ?? 9) - (levelRank[b.level] ?? 9)
  if (lr !== 0) return lr
  const or = (a.order ?? 0) - (b.order ?? 0)
  if (or !== 0) return or
  return a.title.localeCompare(b.title, 'ru')
})

/** Все темы грамматики с присвоенными id (стабильны при неизменных данных). */
export const grammarTopics: GrammarTopic[] = merged.map((t, i) => ({ ...t, id: i }))

/** Уровни грамматики (для группировки в UI). */
export const grammarLevels = ['A1', 'A2', 'B1', 'B2'] as const
