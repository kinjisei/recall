import { supabase } from './supabase'
import type { AppLang, Card, Deck } from '../types'

/**
 * Возвращает «колоду по умолчанию» текущего пользователя для языка
 * (en и es создаются автоматически при регистрации — см. docs/schema.sql).
 */
export async function getDefaultDeck(lang: AppLang = 'en'): Promise<Deck> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Нет авторизации')

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

/** id всех колод пользователя на данном языке (для фильтрации карточек). */
export async function getDeckIds(lang: AppLang): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Нет авторизации')

  const { data, error } = await supabase
    .from('decks')
    .select('id')
    .eq('owner_id', user.id)
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
