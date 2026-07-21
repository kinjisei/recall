// ============================================================================
// FSRS — интервальное повторение (обёртка над библиотекой ts-fsrs).
// Контракт: docs/ARCHITECTURE.md §7.
//   getDueCards()   — карточки, которые пора повторить
//   countDueCards() — лёгкий счётчик тех же карточек (без тел строк)
//   reviewCard()    — записать оценку и вычислить следующий показ
//
// ts-fsrs подгружается лениво: getDueCards/countDueCards — чистые запросы к
// Supabase, планировщик нужен только reviewCard (экран повторения). Так
// библиотека не попадает в стартовый бандл Главной.
// ============================================================================
import type { FSRS, Card as FsrsCard, Grade, State } from 'ts-fsrs'
import { supabase, requireUserId } from './supabase'
import { getDeckIds } from './cards'
import type { AppLang, Card, ReviewState, ReviewStateName, Rating } from '../types'

type FsrsModule = typeof import('ts-fsrs')

let enginePromise: Promise<{ m: FsrsModule; scheduler: FSRS }> | null = null
function loadEngine() {
  return (enginePromise ??= import('ts-fsrs').then((m) => ({
    m,
    scheduler: m.fsrs(m.generatorParameters({ enable_fuzz: true })),
  })))
}

function stateNameToEnum(m: FsrsModule, name: ReviewStateName): State {
  switch (name) {
    case 'new':
      return m.State.New
    case 'learning':
      return m.State.Learning
    case 'review':
      return m.State.Review
    default:
      return m.State.Relearning
  }
}

function stateEnumToName(m: FsrsModule, s: State): ReviewStateName {
  switch (s) {
    case m.State.New:
      return 'new'
    case m.State.Learning:
      return 'learning'
    case m.State.Review:
      return 'review'
    default:
      return 'relearning'
  }
}

function ratingToGrade(m: FsrsModule, r: Rating): Grade {
  switch (r) {
    case 'again':
      return m.Rating.Again
    case 'hard':
      return m.Rating.Hard
    case 'good':
      return m.Rating.Good
    default:
      return m.Rating.Easy
  }
}

/** Собрать объект ts-fsrs из нашей записи review_states (или пустую карточку). */
function toFsrsCard(m: FsrsModule, state: ReviewState | null, now: Date): FsrsCard {
  const base = m.createEmptyCard(now)
  if (!state || state.state === 'new' || state.stability == null) return base
  return {
    ...base,
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty ?? base.difficulty,
    reps: state.reps,
    lapses: state.lapses,
    state: stateNameToEnum(m, state.state),
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  }
}

export interface DueCard {
  card: Card
  state: ReviewState | null
}

/**
 * Карточки, которые пора повторить: те, у которых due <= сейчас, + новые
 * (без расписания). Фильтрация — на сервере Supabase, чтобы не выкачивать
 * всю колоду целиком.
 * Порядок: СНАЧАЛА запланированные повторения (самые старые due — первыми),
 * затем новые — иначе после добавления большого пака (≥limit новых карточек)
 * реально запланированные слова вообще не попадали бы в выдачу и забывались.
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
  // Приоритет — запланированные повторения: их FSRS назначил на сегодня.
  for (const row of dueRes.data ?? []) {
    const { cards: card, ...state } = row as ReviewState & { cards: Card | null }
    if (card) due.push({ card, state: state as ReviewState })
  }
  // Новые — на оставшиеся места лимита.
  for (const row of newRes.data ?? []) {
    if (due.length >= limit) break
    const { review_states: _rs, ...card } = row as Card & { review_states: unknown }
    due.push({ card: card as Card, state: null })
  }

  return due.slice(0, limit)
}

/**
 * Сколько карточек к повторению (те же условия, что в getDueCards), но без
 * выкачивания строк — только count-запросы. Для счётчиков на Главной.
 */
export async function countDueCards(lang?: AppLang): Promise<number> {
  const userId = await requireUserId()
  const nowIso = new Date().toISOString()

  const deckIds = lang ? await getDeckIds(lang) : null
  if (deckIds && deckIds.length === 0) return 0

  let newQuery = supabase
    .from('cards')
    .select('id, review_states(id)', { count: 'exact', head: true })
    .is('review_states', null)
  if (deckIds) newQuery = newQuery.in('deck_id', deckIds)

  let dueQuery = supabase
    .from('review_states')
    .select('id, cards!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due', nowIso)
  if (deckIds) dueQuery = dueQuery.in('cards.deck_id', deckIds)

  const [newRes, dueRes] = await Promise.all([newQuery, dueQuery])
  if (newRes.error) throw newRes.error
  if (dueRes.error) throw dueRes.error

  return (newRes.count ?? 0) + (dueRes.count ?? 0)
}

/** Записать оценку по карточке и вычислить следующий показ (FSRS).
 *  Возвращает обновлённое расписание (нужно для повтора в той же сессии). */
export async function reviewCard(
  card: Card,
  existing: ReviewState | null,
  rating: Rating,
): Promise<ReviewState> {
  const userId = await requireUserId()
  const { m, scheduler } = await loadEngine()
  const now = new Date()

  const fsrsCard = toFsrsCard(m, existing, now)
  const { card: next } = scheduler.next(fsrsCard, now, ratingToGrade(m, rating))

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
        state: stateEnumToName(m, next.state),
      },
      { onConflict: 'card_id,user_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as ReviewState
}
