// ============================================================================
// Нижние типы: язык, уровень, формат упражнения. На них опираются и
// types/index.ts, и types/materials.ts — отдельный файл, чтобы между ними не
// было цикла импортов. Импортировать — по-прежнему из `types` (реэкспорт).
// ============================================================================

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** Язык изучения. Приложение объединяет английский и испанский. */
export type AppLang = 'en' | 'es'

/** Упражнение в уроке грамматики. */
export type GrammarExercise =
  | { type: 'mcq'; prompt: string; options: string[]; answer: number }
  | { type: 'fill'; prompt: string; answer: string; hint?: string }
  | { type: 'order'; prompt: string; words: string[]; answer: string[] }
