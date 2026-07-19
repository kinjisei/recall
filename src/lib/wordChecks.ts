// ============================================================================
// Перепроверка слов: учитель выбирает слова из колоды ученицы, ученица
// печатает их по памяти (рус → англ/исп). Неверные возвращаются в колоду
// оценкой «again». Таблица word_checks, RLS — docs/schema.sql.
// ============================================================================
import { supabase } from './supabase'
import { reviewCard } from './fsrs'
import type { Card, ReviewState, WordCheck, WordCheckResult } from '../types'

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Нет авторизации')
  return user.id
}

/** Статус изученности слова (по интервалу FSRS). */
export type WordStatus = 'new' | 'learning' | 'learned'

export interface StudentWord {
  card: Card
  state: ReviewState | null
  status: WordStatus
  intervalDays: number // текущий интервал повторения (0 для новых)
}

function statusOf(state: ReviewState | null): { status: WordStatus; intervalDays: number } {
  if (!state || state.state === 'new') return { status: 'new', intervalDays: 0 }
  const last = state.last_review ? new Date(state.last_review).getTime() : Date.now()
  const days = Math.max(0, Math.round((new Date(state.due).getTime() - last) / 86400000))
  // «изучено» = FSRS уже отправил слово далеко (интервал от 3 недель)
  if (state.state === 'review' && days >= 21) return { status: 'learned', intervalDays: days }
  return { status: 'learning', intervalDays: days }
}

/** Слова ученицы с расписаниями (для экрана выбора у преподавателя). */
export async function getStudentWords(studentId: string): Promise<StudentWord[]> {
  const { data: decks, error: dErr } = await supabase
    .from('decks')
    .select('id')
    .eq('owner_id', studentId)
  if (dErr) throw dErr
  const deckIds = (decks ?? []).map((d) => d.id as string)
  if (deckIds.length === 0) return []

  const [cardsRes, statesRes] = await Promise.all([
    supabase.from('cards').select('*').in('deck_id', deckIds),
    supabase.from('review_states').select('*').eq('user_id', studentId),
  ])
  if (cardsRes.error) throw cardsRes.error
  if (statesRes.error) throw statesRes.error

  const byCard = new Map<string, ReviewState>()
  for (const s of (statesRes.data ?? []) as ReviewState[]) byCard.set(s.card_id, s)

  const words = ((cardsRes.data ?? []) as Card[]).map((card) => {
    const state = byCard.get(card.id) ?? null
    return { card, state, ...statusOf(state) }
  })
  // самые «изученные» (большой интервал) — наверху: их и стоит перепроверять
  words.sort((a, b) => b.intervalDays - a.intervalDays)
  return words
}

/** Назначить перепроверку выбранных слов. */
export async function assignWordCheck(studentId: string, cardIds: string[]): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('word_checks').insert({
    teacher_id: userId,
    student_id: studentId,
    card_ids: cardIds,
  })
  if (error) throw error
}

/** Перепроверки, назначенные ученице (для отчёта у преподавателя). */
export async function getWordChecks(studentId: string): Promise<WordCheck[]> {
  const { data, error } = await supabase
    .from('word_checks')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WordCheck[]
}

/** Незавершённые перепроверки текущей ученицы + карточки к ним. */
export async function getMyPendingWordChecks(): Promise<
  { check: WordCheck; cards: Card[] }[]
> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('word_checks')
    .select('*')
    .eq('student_id', userId)
    .is('completed_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  const checks = (data ?? []) as WordCheck[]
  if (checks.length === 0) return []

  const allIds = [...new Set(checks.flatMap((c) => c.card_ids))]
  const { data: cards, error: cErr } = await supabase
    .from('cards')
    .select('*')
    .in('id', allIds)
  if (cErr) throw cErr
  const byId = new Map(((cards ?? []) as Card[]).map((c) => [c.id, c]))

  return checks.map((check) => ({
    check,
    cards: check.card_ids
      .map((id) => byId.get(id))
      .filter((c): c is Card => Boolean(c)),
  }))
}

/**
 * Ученица завершила перепроверку: сохраняем результаты; каждое неверное слово
 * получает оценку «again» и возвращается в очередь повторения.
 */
export async function submitWordCheck(
  check: WordCheck,
  results: WordCheckResult[],
): Promise<void> {
  const userId = await requireUserId()

  // неверные слова → again (вернутся в колоду; FSRS сожмёт интервал)
  const wrong = results.filter((r) => !r.ok)
  if (wrong.length > 0) {
    const ids = wrong.map((r) => r.card_id)
    const [cardsRes, statesRes] = await Promise.all([
      supabase.from('cards').select('*').in('id', ids),
      supabase.from('review_states').select('*').eq('user_id', userId).in('card_id', ids),
    ])
    const cards = (cardsRes.data ?? []) as Card[]
    const states = new Map(
      ((statesRes.data ?? []) as ReviewState[]).map((s) => [s.card_id, s]),
    )
    for (const card of cards) {
      await reviewCard(card, states.get(card.id) ?? null, 'again')
    }
  }

  const { error } = await supabase
    .from('word_checks')
    .update({ results, completed_at: new Date().toISOString() })
    .eq('id', check.id)
  if (error) throw error
}
