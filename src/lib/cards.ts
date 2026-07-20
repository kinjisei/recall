import { supabase, requireUserId } from './supabase'
import type { AppLang, Card, Deck, ReviewState } from '../types'
import { statusOf, type WordStatus } from './wordChecks'

/**
 * Возвращает «колоду по умолчанию» текущего пользователя для языка
 * (en и es создаются автоматически при регистрации — см. docs/schema.sql).
 */
export async function getDefaultDeck(lang: AppLang = 'en'): Promise<Deck> {
  const user = { id: await requireUserId() }

  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('owner_id', user.id)
    .eq('lang', lang)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error) throw error
  return data as Deck
}

/**
 * id всех ДОСТУПНЫХ колод данного языка (для фильтрации карточек).
 * Без фильтра по владельцу: RLS отдаёт свои колоды + назначенные
 * преподавателем (Фаза 4) — так задания попадают в очередь ученицы.
 */
export async function getDeckIds(lang: AppLang): Promise<string[]> {
  await requireUserId() // ранний отказ без сессии; сам список фильтрует RLS

  const { data, error } = await supabase
    .from('decks')
    .select('id')
    .eq('lang', lang)

  if (error) throw error
  return (data ?? []).map((d) => d.id as string)
}

/**
 * Общий хелпер: добавить карточку (слово/фразу) в колоду.
 * Контракт (docs/ARCHITECTURE.md §7) — сигнатуру НЕ менять (расширять можно).
 * Если deckId не передан — кладём в колоду по умолчанию языка lang (или en).
 */
export async function addCard(input: {
  front: string
  back?: string
  example?: string
  ipa?: string
  audio_url?: string
  deckId?: string
  lang?: AppLang
  source?: 'manual' | 'reader' | 'ai'
}): Promise<Card> {
  const deckId = input.deckId ?? (await getDefaultDeck(input.lang ?? 'en')).id

  const { data, error } = await supabase
    .from('cards')
    .insert({
      deck_id: deckId,
      front: input.front,
      back: input.back ?? null,
      example: input.example ?? null,
      ipa: input.ipa ?? null,
      audio_url: input.audio_url ?? null,
      source: input.source ?? 'manual',
    })
    .select()
    .single()

  if (error) throw error
  return data as Card
}

/**
 * Массовое добавление карточек (паки слов). Пропускает дубликаты:
 * слова, у которых front уже есть в колоде. Возвращает число добавленных.
 */
export async function addCardsBulk(
  deckId: string,
  cards: { front: string; back?: string; example?: string }[],
): Promise<number> {
  if (cards.length === 0) return 0

  // Какие front уже есть в колоде — их не дублируем.
  const { data: existing, error: exErr } = await supabase
    .from('cards')
    .select('front')
    .eq('deck_id', deckId)
  if (exErr) throw exErr
  const known = new Set((existing ?? []).map((c) => (c.front as string).toLowerCase()))

  const fresh = cards.filter((c) => !known.has(c.front.toLowerCase()))
  if (fresh.length === 0) return 0

  const { error } = await supabase.from('cards').insert(
    fresh.map((c) => ({
      deck_id: deckId,
      front: c.front,
      back: c.back ?? null,
      example: c.example ?? null,
      source: 'manual',
    })),
  )
  if (error) throw error
  return fresh.length
}

// ---------------------------------------------------------------------------
// «Мои слова»: просмотр, правка и удаление собственных карточек.
// RLS-политика «cards via own deck» разрешает владельцу колоды всё, поэтому
// отдельных RPC не нужно. Расписание повторений (review_states) удаляется
// каскадом вместе с карточкой — см. docs/schema.sql.
// ---------------------------------------------------------------------------

/** Карточка вместе с её расписанием и статусом изученности. */
export interface MyWord {
  card: Card
  state: ReviewState | null
  status: WordStatus
  intervalDays: number
}

/** Все слова пользователя выбранного языка: свежие сверху. */
export async function listMyWords(lang: AppLang): Promise<MyWord[]> {
  const user = { id: await requireUserId() }

  const deckIds = await getDeckIds(lang)
  if (deckIds.length === 0) return []

  const [cardsRes, statesRes] = await Promise.all([
    supabase
      .from('cards')
      .select('*')
      .in('deck_id', deckIds)
      .order('created_at', { ascending: false }),
    supabase.from('review_states').select('*').eq('user_id', user.id),
  ])
  if (cardsRes.error) throw cardsRes.error
  if (statesRes.error) throw statesRes.error

  const byCard = new Map<string, ReviewState>()
  for (const s of (statesRes.data ?? []) as ReviewState[]) byCard.set(s.card_id, s)

  return ((cardsRes.data ?? []) as Card[]).map((card) => {
    const state = byCard.get(card.id) ?? null
    return { card, state, ...statusOf(state) }
  })
}

/** Правка карточки: слово, перевод, пример. */
export async function updateCard(
  id: string,
  fields: { front?: string; back?: string | null; example?: string | null },
): Promise<void> {
  const patch: Record<string, string | null> = {}
  if (fields.front !== undefined) {
    const front = fields.front.trim()
    if (!front) throw new Error('Слово не может быть пустым')
    patch.front = front
  }
  if (fields.back !== undefined) patch.back = fields.back?.trim() || null
  if (fields.example !== undefined) patch.example = fields.example?.trim() || null

  const { error } = await supabase.from('cards').update(patch).eq('id', id)
  if (error) throw error
}

/** Удаление карточки (расписание уйдёт каскадом). */
export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}

/** Сколько всего своих слов на языке (для счётчика на плитке). */
export async function countMyWords(lang: AppLang): Promise<number> {
  const deckIds = await getDeckIds(lang)
  if (deckIds.length === 0) return 0
  const { count, error } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .in('deck_id', deckIds)
  if (error) throw error
  return count ?? 0
}
