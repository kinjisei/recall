import { supabase } from './supabase'
import type { Card, Deck } from '../types'

/**
 * Возвращает «колоду по умолчанию» текущего пользователя
 * (создаётся автоматически при регистрации — см. docs/schema.sql).
 */
export async function getDefaultDeck(): Promise<Deck> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Нет авторизации')

  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error) throw error
  return data as Deck
}

/**
 * Общий хелпер: добавить карточку (слово/фразу) в колоду.
 * Контракт (docs/ARCHITECTURE.md §7) — сигнатуру НЕ менять.
 * Если deckId не передан — кладём в колоду по умолчанию.
 *
 * Worker 1 (Колода) позже дополнит этот файл созданием review_states (FSRS).
 */
export async function addCard(input: {
  front: string
  back?: string
  example?: string
  ipa?: string
  audio_url?: string
  deckId?: string
  source?: 'manual' | 'reader' | 'ai'
}): Promise<Card> {
  const deckId = input.deckId ?? (await getDefaultDeck()).id

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
