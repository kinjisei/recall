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
 * Отсортированы: сначала самые «просроченные».
 */
export async function getDueCards(limit = 50): Promise<DueCard[]> {
  const userId = await requireUserId()

  // RLS уже ограничивает выборку только нашими данными.
  const [{ data: cards, error: cErr }, { data: states, error: sErr }] =
    await Promise.all([
      supabase.from('cards').select('*'),
      supabase.from('review_states').select('*').eq('user_id', userId),
    ])
  if (cErr) throw cErr
  if (sErr) throw sErr

  const byCard = new Map<string, ReviewState>()
  for (const s of (states ?? []) as ReviewState[]) byCard.set(s.card_id, s)

  const now = Date.now()
  const due: DueCard[] = []
  for (const card of (cards ?? []) as Card[]) {
    const state = byCard.get(card.id) ?? null
    const isDue = !state || new Date(state.due).getTime() <= now
    if (isDue) due.push({ card, state })
  }

  due.sort((a, b) => {
    const da = a.state ? new Date(a.state.due).getTime() : 0
    const db = b.state ? new Date(b.state.due).getTime() : 0
    return da - db
  })

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
