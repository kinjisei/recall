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
import { getDeckIds } from './cards'
import type { AppLang, Card, ReviewState, ReviewStateName, Rating } from '../types'

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
 * lang — показывать только карточки колод этого языка (en/es).
 */
export async function getDueCards(limit = 50, lang?: AppLang): Promise<DueCard[]> {
  const userId = await requireUserId()
  const nowIso = new Date().toISOString()

  // Колоды выбранного языка; без языка — все колоды пользователя (как раньше).
  const deckIds = lang ? await getDeckIds(lang) : null
  if (deckIds && deckIds.length === 0) return []

  let newQuery = supabase
    .from('cards')
    .select('*, review_states(id)')
    .is('review_states', null)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (deckIds) newQuery = newQuery.in('deck_id', deckIds)

  let dueQuery = supabase
    .from('review_states')
    .select('*, cards!inner(*)')
    .eq('user_id', userId)
    .lte('due', nowIso)
    .order('due', { ascending: true })
    .limit(limit)
  if (deckIds) dueQuery = dueQuery.in('cards.deck_id', deckIds)

  const [newRes, dueRes] = await Promise.all([
    // Новые: карточки без записи в review_states (анти-джойн через is null).
    // RLS показывает только наши review_states, поэтому «новизна» считается лично для нас.
    newQuery,
    // Просроченные: расписание подошло (due <= сейчас).
    dueQuery,
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

/** Записать оценку по карточке и вычислить следующий показ (FSRS).
 *  Возвращает обновлённое расписание (нужно для повтора в той же сессии). */
export async function reviewCard(
  card: Card,
  existing: ReviewState | null,
  rating: Rating,
): Promise<ReviewState> {
  const userId = await requireUserId()
  const now = new Date()

  const fsrsCard = toFsrsCard(existing, now)
  const { card: next } = scheduler.next(fsrsCard, now, ratingMap[rating])

  const { data, error } = await supabase
    .from('review_states')
    .upsert(
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
    .select()
    .single()
  if (error) throw error
  return data as ReviewState
}
