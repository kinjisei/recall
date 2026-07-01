// ============================================================================
// FSRS — интервальное повторение (обёртка над библиотекой ts-fsrs).
// Контракт: docs/ARCHITECTURE.md §7.
//   getDueCards() — карточки, которые пора повторить
//   reviewCard()  — записать оценку и вычислить следующий показ
// ============================================================================
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating as FsrsRating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs'
import { supabase } from './supabase'
import type { Card, ReviewState, ReviewStateName, Rating } from '../types'

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }))

const stateNameToEnum: Record<ReviewStateName, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
}

function stateEnumToName(s: State): ReviewStateName {
  switch (s) {
    case State.New:
      return 'new'
    case State.Learning:
      return 'learning'
    case State.Review:
      return 'review'
    default:
      return 'relearning'
  }
}

const ratingMap: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
}

/** Собрать объект ts-fsrs из нашей записи review_states (или пустую карточку). */
function toFsrsCard(state: ReviewState | null, now: Date): FsrsCard {
  const base = createEmptyCard(now)
  if (!state || state.state === 'new' || state.stability == null) return base
  return {
    ...base,
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty ?? base.difficulty,
    reps: state.reps,
    lapses: state.lapses,
    state: stateNameToEnum[state.state],
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  }
}

export interface DueCard {
  card: Card
  state: ReviewState | null
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Нет авторизации')
  return user.id
}

/**
 * Карточки, которые пора повторить: новые (без расписания) + те, у которых due <= сейчас.
 * Фильтрация — на сервере Supabase, чтобы не выкачивать всю колоду целиком.
 * Порядок: сначала новые, затем по просроченности (самые старые due — первыми).
 */
export async function getDueCards(limit = 50): Promise<DueCard[]> {
  const userId = await requireUserId()
  const nowIso = new Date().toISOString()

  const [newRes, dueRes] = await Promise.all([
    // Новые: карточки без записи в review_states (анти-джойн через is null).
    // RLS показывает только наши review_states, поэтому «новизна» считается лично для нас.
    supabase
      .from('cards')
      .select('*, review_states(id)')
      .is('review_states', null)
      .order('created_at', { ascending: true })
      .limit(limit),
    // Просроченные: расписание подошло (due <= сейчас).
    supabase
      .from('review_states')
      .select('*, cards(*)')
      .eq('user_id', userId)
      .lte('due', nowIso)
      .order('due', { ascending: true })
      .limit(limit),
  ])
  if (newRes.error) throw newRes.error
  if (dueRes.error) throw dueRes.error

  const due: DueCard[] = []
  for (const row of newRes.data ?? []) {
    const { review_states: _rs, ...card } = row as Card & { review_states: unknown }
    due.push({ card: card as Card, state: null })
  }
  for (const row of dueRes.data ?? []) {
    const { cards: card, ...state } = row as ReviewState & { cards: Card | null }
    if (card) due.push({ card, state: state as ReviewState })
  }

  return due.slice(0, limit)
}

/** Записать оценку по карточке и вычислить следующий показ (FSRS). */
export async function reviewCard(
  card: Card,
  existing: ReviewState | null,
  rating: Rating,
): Promise<void> {
  const userId = await requireUserId()
  const now = new Date()

  const fsrsCard = toFsrsCard(existing, now)
  const { card: next } = scheduler.next(fsrsCard, now, ratingMap[rating])

  const { error } = await supabase.from('review_states').upsert(
    {
      card_id: card.id,
      user_id: userId,
      stability: next.stability,
      difficulty: next.difficulty,
      due: next.due.toISOString(),
      last_review: (next.last_review ?? now).toISOString(),
      reps: next.reps,
      lapses: next.lapses,
      state: stateEnumToName(next.state),
    },
    { onConflict: 'card_id,user_id' },
  )
  if (error) throw error
}
