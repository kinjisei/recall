// ============================================================================
// Перепроверка слов: учитель выбирает слова из колоды ученика, ученик
// печатает их по памяти (рус → англ/исп). Неверные возвращаются в колоду
// оценкой «again». Таблица word_checks, RLS — docs/schema.sql.
// ============================================================================
import { supabase, requireUserId, toJson } from './supabase'
import { dbError } from './dbError'
import { reviewCard } from './fsrs'
import type { AppLang, Card, ReviewState, WordCheck, WordCheckResult } from '../types'

/** Статус изученности слова (по интервалу FSRS). */
export type WordStatus = 'new' | 'learning' | 'learned'

/** Единая цветовая кодировка статуса (токены Nocturne) — одинаково у ученика
 *  («Мои слова») и у преподавателя, чтобы «учу» не был двух разных цветов.
 *  Подпись задаётся на месте (перспектива: «учу» у себя / «учится» у учителя). */
export const WORD_STATUS_CLS: Record<WordStatus, string> = {
  new: 'bg-white/[0.08] text-[var(--night-text-40)]',
  learning: 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]',
  learned: 'bg-emerald-500/20 text-emerald-300',
}

export interface StudentWord {
  card: Card
  state: ReviewState | null
  status: WordStatus
  intervalDays: number // текущий интервал повторения (0 для новых)
  /** Язык КОЛОДЫ, в которой лежит карточка. У ученика их две (en и es), а у
   *  самой карточки языка нет — он есть только у колоды. Без этого поля любой
   *  подсчёт «слов ученика» молча складывает английские с испанскими. */
  lang: AppLang
}

/** Минимум, из которого считается статус: экраны, которым не нужны все поля
 *  расписания (например /progress), выбирают только эти три колонки. */
export type StatusInput = Pick<ReviewState, 'state' | 'due' | 'last_review'>

/**
 * ЕДИНОЕ правило «новое / учу / изучено» для всего приложения: «Мои слова»,
 * выбор слов преподавателем, диагностическая карта, отчёт родителям и метрика
 * «Слов изучено» на /progress.
 *
 * ⚠️ Не заводить рядом «свой» вариант подсчёта: /progress считал изученным
 * любое слово в состоянии review, без порога по интервалу, и на одной и той же
 * колоде ученик видел 4, а преподаватель в диагностике — 3 (находка ревью
 * 2А №5). Порог 21 день здесь — единственное место, где он задан.
 */
export function statusOf(state: StatusInput | null): { status: WordStatus; intervalDays: number } {
  if (!state || state.state === 'new') return { status: 'new', intervalDays: 0 }
  const last = state.last_review ? new Date(state.last_review).getTime() : Date.now()
  const days = Math.max(0, Math.round((new Date(state.due).getTime() - last) / 86400000))
  // «изучено» = FSRS уже отправил слово далеко (интервал от 3 недель)
  if (state.state === 'review' && days >= 21) return { status: 'learned', intervalDays: days }
  return { status: 'learning', intervalDays: days }
}

/** Слова ученика с расписаниями (для экрана выбора у преподавателя). */
export async function getStudentWords(studentId: string): Promise<StudentWord[]> {
  const { data: decks, error: dErr } = await supabase
    .from('decks')
    .select('id, lang')
    .eq('owner_id', studentId)
  if (dErr) throw dErr
  const deckIds = (decks ?? []).map((d) => d.id as string)
  if (deckIds.length === 0) return []
  const deckLang = new Map((decks ?? []).map((d) => [d.id as string, (d.lang ?? 'en') as AppLang]))

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
    return { card, state, lang: deckLang.get(card.deck_id) ?? 'en', ...statusOf(state) }
  })
  // самые «изученные» (большой интервал) — наверху: их и стоит перепроверять
  words.sort((a, b) => b.intervalDays - a.intervalDays)
  return words
}

/** Назначить перепроверку выбранных слов (через RPC — проверяет связь). */
export async function assignWordCheck(studentId: string, cardIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('assign_word_check', {
    p_student_id: studentId,
    p_card_ids: cardIds,
  })
  if (error) throw dbError(error, 'назначить перепроверку слов')
}

/** Перепроверки, назначенные ученику (для отчёта у преподавателя). */
export async function getWordChecks(studentId: string): Promise<WordCheck[]> {
  const { data, error } = await supabase
    .from('word_checks')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WordCheck[]
}

/** Незавершённые перепроверки текущего ученика + карточки к ним. */
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

  // Помечаем перепроверку завершённой через RPC (атомарно, только если ещё не
  // завершена). counted=true только тому, кто засчитал её сейчас — иначе
  // (ретрай/повтор) НЕ начисляем again повторно (двойной штраф FSRS).
  //
  // ⚠️ Вердикт ставит СЕРВЕР. Раньше клиент присылал готовое ok по каждому
  // слову, и прямым вызовом RPC можно было отправить «всё верно»: отчёт
  // преподавателю врал, а штраф FSRS не наступал. Теперь мы шлём только
  // ответы, а какие слова неверны — говорит сервер, и «ещё раз» получают
  // именно они.
  const { data, error } = await supabase.rpc('submit_word_check', {
    p_id: check.id,
    p_results: toJson(results),
  })
  if (error) throw dbError(error, 'сохранить результат перепроверки')
  const verdict = data as unknown as { counted?: boolean; wrong?: string[] } | boolean | null
  // старая версия RPC (миграция ещё не залита) отвечала boolean — не ломаемся
  const counted = typeof verdict === 'boolean' ? verdict : Boolean(verdict?.counted)
  if (!counted) return // уже завершена — идемпотентно

  const ids =
    typeof verdict === 'boolean' || !Array.isArray(verdict?.wrong)
      ? results.filter((r) => !r.ok).map((r) => r.card_id) // старый путь
      : verdict.wrong
  if (ids.length === 0) return
  const [cardsRes, statesRes] = await Promise.all([
    supabase.from('cards').select('*').in('id', ids),
    supabase.from('review_states').select('*').eq('user_id', userId).in('card_id', ids),
  ])
  // если карточки/расписания не выбрались — не молчим: иначе слово не вернётся
  // в очередь, а перепроверка уже помечена завершённой
  if (cardsRes.error) throw cardsRes.error
  if (statesRes.error) throw statesRes.error
  const cards = (cardsRes.data ?? []) as Card[]
  const states = new Map(
    ((statesRes.data ?? []) as ReviewState[]).map((s) => [s.card_id, s]),
  )
  for (const card of cards) {
    await reviewCard(card, states.get(card.id) ?? null, 'again')
  }
}
