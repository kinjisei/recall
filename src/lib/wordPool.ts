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
import { supabase, currentUserId } from './supabase'
import { getDeckIds } from './cards'
import { getEsLevel } from './esLevel'
import { sample } from './random'
import type { AppLang, Card, ReviewState } from '../types'

/** Слово для игры: термин + перевод (+ пример и связь с карточкой колоды). */
export interface PoolItem {
  term: string
  translation: string
  example?: string
  /** Уровень слова из пака (у карточек пользователя его нет). */
  level?: string
  /** Есть, только если слово взято из колоды пользователя. */
  card?: Card
  state?: ReviewState | null
}

/** Шкала CEFR — для сортировки слов по близости к уровню пользователя. */
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Уровень изучаемого языка: EN — из профиля, ES — из placement (локально). */
async function targetLevel(lang: AppLang): Promise<string> {
  if (lang === 'es') return getEsLevel() ?? 'A1'
  try {
    const userId = await currentUserId()
    if (!userId) return 'B1'
    const { data } = await supabase.from('profiles').select('level').eq('id', userId).single()
    return ((data as { level?: string } | null)?.level as string) ?? 'B1'
  } catch {
    return 'B1'
  }
}

export interface GamePool {
  items: PoolItem[]
  /** Сколько первых элементов items — карточки пользователя. */
  fromDeck: number
}

// shuffle/sample — в lib/random (чистые), здесь реэкспорт + внутреннее использование
export { shuffle, sample } from './random'

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

/** Слова из готовых паков (ленивый импорт — в стартовый бандл не идут). */
async function loadPackItems(lang: AppLang): Promise<PoolItem[]> {
  const items: PoolItem[] = []
  if (lang === 'es') {
    const m = await import('../data/spanish/words')
    for (const w of m.allWords) {
      const term = w.spanish?.trim() ?? ''
      const translation = w.russian?.trim() ?? ''
      if (!isPlayable(term, translation)) continue
      items.push({ term, translation, example: w.example_es ?? undefined, level: w.level })
    }
  } else {
    const m = await import('../data/english/words')
    for (const w of m.allWords) {
      const term = w.english?.trim() ?? ''
      const translation = w.russian?.trim() ?? ''
      if (!isPlayable(term, translation)) continue
      items.push({ term, translation, example: w.example_en ?? undefined, level: w.level })
    }
  }
  return items
}

/**
 * Сортирует слова паков по близости к уровню пользователя: сначала его
 * уровень, потом соседние. Без этого игрок уровня B1 получал слова C1
 * вперемешку — учить их рано, а угадывать бессмысленно.
 */
function sortByLevelCloseness(items: PoolItem[], target: string): PoolItem[] {
  const t = LEVEL_ORDER.indexOf(target)
  if (t < 0) return items
  return items
    .map((item) => {
      const i = LEVEL_ORDER.indexOf(item.level ?? '')
      // неизвестный уровень — считаем «далёким», но не отбрасываем
      return { item, distance: i < 0 ? 9 : Math.abs(i - t) }
    })
    .sort((a, b) => a.distance - b.distance)
    .map((x) => x.item)
}

/**
 * Пул для раунда: сначала карточки пользователя, при нехватке — слова паков.
 * `need` — сколько слов минимально нужно игре; добираем с запасом, чтобы
 * хватало на варианты-обманки.
 */
export async function loadGamePool(lang: AppLang, need = 24): Promise<GamePool> {
  const [deckItems, level] = await Promise.all([
    loadDeckItems(lang).catch(() => []),
    targetLevel(lang),
  ])
  const seen = new Set(deckItems.map((i) => i.term.toLowerCase()))
  const items = [...deckItems]

  if (items.length < need) {
    const packs = await loadPackItems(lang).catch(() => [])
    // добираем словами СВОЕГО уровня, а не первыми попавшимися
    for (const it of sortByLevelCloseness(packs, level)) {
      const key = it.term.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      items.push(it)
      // берём с запасом на обманки, но не тащим весь словарь
      if (items.length >= Math.max(need * 4, 80)) break
    }
  }

  return { items, fromDeck: deckItems.length }
}
