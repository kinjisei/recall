// ============================================================================
// Recall — общие типы. Отражают таблицы в Supabase (см. docs/ARCHITECTURE.md §5).
// Все воркеры импортируют типы ОТСЮДА и не плодят свои дубликаты.
// ============================================================================

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** Язык изучения. Приложение объединяет английский и испанский. */
export type AppLang = 'en' | 'es'

/** Оценка ответа на карточку (для FSRS). */
export type Rating = 'again' | 'hard' | 'good' | 'easy'

export type Role = 'learner' | 'teacher'

export type CardSource = 'manual' | 'reader' | 'ai'

export type ReviewStateName = 'new' | 'learning' | 'review' | 'relearning'

export type ContentType = 'reading' | 'listening'

/** Тип занятия для activity_log (стрик и статистика). */
export type ActivityType =
  | 'flashcards'
  | 'reader'
  | 'pronunciation'
  | 'conversation'
  | 'writing'

export interface Profile {
  id: string
  display_name: string | null
  level: CEFRLevel
  native_lang: string
  role: Role
  created_at: string
}

export interface Deck {
  id: string
  owner_id: string
  title: string
  description: string | null
  is_shared: boolean
  lang: AppLang
  created_at: string
}

export interface Card {
  id: string
  deck_id: string
  front: string
  back: string | null
  example: string | null
  ipa: string | null
  audio_url: string | null
  source: CardSource
  created_at: string
}

export interface ReviewState {
  id: string
  card_id: string
  user_id: string
  stability: number | null
  difficulty: number | null
  due: string
  last_review: string | null
  reps: number
  lapses: number
  state: ReviewStateName
}

export interface ContentItem {
  id: string
  level: CEFRLevel | null
  title: string | null
  body: string | null
  type: ContentType
  audio_url: string | null
  source: string
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  day: string
  type: string
  items_done: number
  duration_sec: number
  created_at: string
}

/** Реплика для AI-чата (то, что летит в /api/gemini; не таблица БД). */
export interface ChatTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface Conversation {
  id: string
  user_id: string
  started_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Испанский контент (перенесён из приложения spanish; лежит в src/data/spanish).
// Это встроенные данные, не таблицы БД.
// ---------------------------------------------------------------------------

/** Тема пака слов («Семья», «Еда» …). */
export interface SpanishTopic {
  id: number
  name: string
  level: string
  icon: string
}

/** Слово из пака: испанский + русский + пример. */
export interface SpanishWord {
  spanish: string
  russian: string
  example_es?: string
  example_ru?: string
  level: string
  topic_id: number
  frequency_rank?: number
}

/** Текст для чтения с переводом по абзацам. */
export interface SpanishReading {
  id: number
  title: string
  titleRu: string
  level: string
  paragraphs: { es: string; ru: string }[]
}

/** Диалог (сценка) с репликами и переводом. */
export interface SpanishDialogue {
  id: number
  title: string
  level: string
  lines: { speaker: string; es: string; ru: string }[]
}

/** Фраза для тренировки произношения (рус → исп). */
export interface SpanishSentence {
  id: number
  level: string
  ru: string
  es: string
}

export interface WritingSubmission {
  id: string
  user_id: string
  prompt: string | null
  text: string
  feedback: unknown | null
  created_at: string
}
