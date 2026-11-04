// Парадная дверь домена «Письмо» (архитектура §2): текст работы (цитаты
// правок, слова, абзацы, предложения) и «свой экзаменатор» — шкалы IELTS и
// CEFR и подсчёт балла по ним (журнал п.77). Промпт и вызов AI — пока в
// lib/writingGrade до переезда раздела (PLAN.md Ф3).
export { hasBullets, locateFixes, paragraphCount, sentences, wordCount, type EssayMark, type LocatedFixes, type Sentence } from './text'
export { CRITERIA, IELTS_LIMITS, ieltsScale, MIN_WORDS, modelLimits, type CritKey, type IeltsKind, type IeltsLimit } from './ielts'
export { ASPECTS, CEFR_LEVELS, cefrScale, type AspectKey, type CefrLevel } from './cefr'
export { cefrSchema, ieltsSchema } from './schema'
export {
  cefrLevel,
  cefrOverall,
  ERROR_FREE_FOR_7,
  ERROR_FREE_FOR_8,
  roundBand,
  scoreCefr,
  scoreIelts,
  textFacts,
  TOO_SHORT,
  type AppliedLimit,
  type CefrMark,
  type CefrResult,
  type FocusItem,
  type IeltsMark,
  type IeltsResult,
  type NextStep,
  type TextFacts,
} from './examiner'
