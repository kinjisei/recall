// ============================================================================
// Общий пул слов для мини-игр раздела «Слова» (EN и ES).
//
// Приоритет — карточки пользователя (то, что он реально учит): к ним привязан
// card + расписание FSRS, поэтому ошибка в игре может вернуть слово на повтор.
// Если карточек не хватает на раунд, добираем слова из паков уровня — играть
// можно с первого дня, даже с пустой колодой.
//
// Контракт: docs/ARCHITECTURE.md §7.
// ============================================================================
import { supabase } from './supabase'
import { getDeckIds } from './cards'
import type { AppLang, Card, ReviewState } from '../types'

/** Слово для игры: термин + перевод (+ пример и связь с карточкой колоды). */
export interface PoolItem {
  term: string
  translation: string
  example?: string
  /** Есть, только если слово взято из колоды пользователя. */
  card?: Card
  state?: ReviewState | null
}

export interface GamePool {
  items: PoolItem[]
  /** Сколько первых элементов items — карточки пользователя. */
  fromDeck: number
}

/** Возвращает НОВЫЙ массив в случайном порядке (Фишер–Йейтс). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** n случайных элементов без повторов. */
export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

/**
 * Участники раунда: СНАЧАЛА слова из колоды пользователя (он их реально учит,
 * и только по ним работает возврат на повтор), паками добираем лишь нехватку.
 *
 * Порядок результата — приоритетный (колода → паки), а НЕ случайный: игры
 * могут отбросить часть кандидатов (например, если не нашлось определения),
 * и тогда выбывать должны слова из паков, а не из колоды. Перемешивание для
 * показа каждая игра делает сама.
 */
export function pickWords(pool: GamePool, n: number): PoolItem[] {
  const deck = pool.items.slice(0, pool.fromDeck)
  const packs = pool.items.slice(pool.fromDeck)
  const picked = sample(deck, n)
  if (picked.length < n) picked.push(...sample(packs, n - picked.length))
  return picked
}

const MAX_CARDS = 200

/** Слишком длинные фразы в играх неудобны (кнопки разъезжаются). */
function isPlayable(term: string, translation: string): boolean {
  if (!term || !translation) return false
  if (term.split(/\s+/).length > 3 || term.length > 28) return false
  if (translation.length > 60) return false
  return true
}

/** Карточки пользователя выбранного языка вместе с расписанием. */
async function loadDeckItems(lang: AppLang): Promise<PoolItem[]> {
  const deckIds = await getDeckIds(lang)
  if (deckIds.length === 0) return []

  const { data, error } = await supabase
    .from('cards')
    .select('*, review_states(*)')
    .in('deck_id', deckIds)
    .limit(MAX_CARDS)
  if (error) throw error

  const items: PoolItem[] = []
  for (const row of data ?? []) {
    const { review_states, ...card } = row as Card & {
      review_states: ReviewState[] | ReviewState | null
    }
    const term = card.front?.trim() ?? ''
    // в back может лежать «перевод · пояснение» — для игр берём первую часть
    const translation = (card.back ?? '').split('·')[0].trim()
    if (!isPlayable(term, translation)) continue
    const state = Array.isArray(review_states) ? (review_states[0] ?? null) : (review_states ?? null)
    items.push({
      term,
      translation,
      example: card.example ?? undefined,
      card: card as Card,
      state,
    })
  }
  return items
}

/** Слова из готовых паков уровня (ленивый импорт — в стартовый бандл не идут). */
async function loadPackItems(lang: AppLang): Promise<PoolItem[]> {
  const items: PoolItem[] = []
  if (lang === 'es') {
    const m = await import('../data/spanish/words')
    for (const w of m.allWords) {
      const term = w.spanish?.trim() ?? ''
      const translation = w.russian?.trim() ?? ''
      if (!isPlayable(term, translation)) continue
      items.push({ term, translation, example: w.example_es ?? undefined })
    }
  } else {
    const m = await import('../data/english/words')
    for (const w of m.allWords) {
      const term = w.english?.trim() ?? ''
      const translation = w.russian?.trim() ?? ''
      if (!isPlayable(term, translation)) continue
      items.push({ term, translation, example: w.example_en ?? undefined })
    }
  }
  return items
}

/**
 * Пул для раунда: сначала карточки пользователя, при нехватке — слова паков.
 * `need` — сколько слов минимально нужно игре; добираем с запасом, чтобы
 * хватало на варианты-обманки.
 */
export async function loadGamePool(lang: AppLang, need = 24): Promise<GamePool> {
  const deckItems = await loadDeckItems(lang).catch(() => [])
  const seen = new Set(deckItems.map((i) => i.term.toLowerCase()))
  const items = [...deckItems]

  if (items.length < need) {
    const packs = await loadPackItems(lang).catch(() => [])
    for (const it of packs) {
      const key = it.term.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      items.push(it)
    }
  }

  return { items, fromDeck: deckItems.length }
}
