// ============================================================================
// Recall — общие типы. Отражают таблицы в Supabase (см. docs/ARCHITECTURE.md §5).
// Все воркеры импортируют типы ОТСЮДА и не плодят свои дубликаты.
// ============================================================================

export type CEFRLevel = 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

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

export interface WritingSubmission {
  id: string
  user_id: string
  prompt: string | null
  text: string
  feedback: unknown | null
  created_at: string
}
