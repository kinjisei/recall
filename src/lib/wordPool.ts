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
import { getProfile } from './profile'
import { readJson, writeJson } from './storage'
import type { AppLang, Card, ReviewState } from '../types'

/** Слово для игры: термин + перевод (+ пример и связь с карточкой колоды). */
export interface PoolItem {
  term: string
  translation: string
  example?: string
  /** Уровень слова из пака (у карточек пользователя его нет). */
  level?: string
  /** Тема пака (topic_id) — для подбора однотемных обманок в играх. */
  topic?: number
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
    // профиль — из общего кэша (lib/profile), а не отдельным запросом
    const profile = await getProfile(userId)
    return profile?.level ?? 'B1'
  } catch {
    return 'B1'
  }
}

export interface GamePool {
  /** Язык пула — нужен анти-повтору (история показанных слов на язык). */
  lang: AppLang
  items: PoolItem[]
  /** Сколько первых элементов items — карточки пользователя. */
  fromDeck: number
}

// shuffle/sample — в lib/random (чистые), здесь реэкспорт + внутреннее использование
export { shuffle, sample } from './random'

// --- анти-повтор и умные обманки --------------------------------------------
// История показанных слов и подбор похожих обманок вынесены в чистые модули
// (lib/recentWords, lib/distractors) — их гоняет мини-тест. Здесь реэкспорт,
// чтобы игры продолжали импортировать всё из wordPool.
export { recordShown, withoutRecent } from './recentWords'
export { pickDistractors, ruPos } from './distractors'
import { pickRound } from './pickRound'
import { loadRecent, recordShown as recordShownImpl } from './recentWords'

/**
 * Участники раунда: СНАЧАЛА слова из колоды пользователя (он их реально учит,
 * и только по ним работает возврат на повтор), паками добираем лишь нехватку.
 * Недавно показанные слова пропускаются, пока пул позволяет (анти-повтор).
 *
 * Порядок результата — приоритетный (колода → паки), а НЕ случайный: игры
 * могут отбросить часть кандидатов (например, если не нашлось определения),
 * и тогда выбывать должны слова из паков, а не из колоды. Перемешивание для
 * показа каждая игра делает сама.
 */
export function pickWords(pool: GamePool, n: number): PoolItem[] {
  const picked = pickRound(
    pool.items.slice(0, pool.fromDeck),
    pool.items.slice(pool.fromDeck),
    n,
    new Set(loadRecent(pool.lang)),
  )
  recordShownImpl(pool.lang, picked.map((i) => i.term))
  return picked
}

const MAX_CARDS = 200

/**
 * Годится ли выражение для игр с ВЫБОРОМ варианта (перевод, пропуск,
 * аудирование, пары). Варианты рисуются в столбик с переносом строки, поэтому
 * длинная фраза не ломает вёрстку — кнопка просто становится выше.
 *
 * Лимит был 3 слова / 28 символов и отсекал половину идиом: из 911 в играх
 * участвовали 466. При 5 словах / 40 символах — 820. Именно ради идиом
 * («bark up the wrong tree») ограничение и ослаблено: учить их списком, но не
 * иметь возможности потренировать, — половина пользы впустую.
 */
function isPlayable(term: string, translation: string): boolean {
  if (!term || !translation) return false
  if (term.split(/\s+/).length > 5 || term.length > 40) return false
  if (translation.length > 60) return false
  return true
}

/**
 * Годится ли выражение для игр, где ответ НАБИРАЮТ руками (диктант).
 * Здесь лимит должен быть жёстче общего: выбрать «a watched pot never boils»
 * из четырёх вариантов легко, а напечатать по памяти — мучение, и человек
 * решит, что игра сломана.
 */
export function isTypable(term: string): boolean {
  if (!term) return false
  return term.split(/\s+/).length <= 2 && term.length <= 20
}

/** Карточки пользователя выбранного языка вместе с расписанием. */
async function loadDeckItems(lang: AppLang): Promise<PoolItem[]> {
  const deckIds = await getDeckIds(lang)
  if (deckIds.length === 0) return []

  const { data, error } = await supabase
    .from('cards')
    .select('*, review_states(*)')
    .in('deck_id', deckIds)
    // порядок обязателен: LIMIT без ORDER BY даёт недетерминированный срез, и у
    // колоды больше MAX_CARDS слов часть навсегда выпадала бы из игр. Свежие
    // первыми — их и хочется тренировать.
    .order('created_at', { ascending: false })
    .limit(MAX_CARDS)
  if (error) throw error

  const items: PoolItem[] = []
  for (const row of data ?? []) {
    const { review_states, ...card } = row as Card & {
      review_states: ReviewState[] | ReviewState | null
    }
    const term = card.front?.trim() ?? ''
    // в back может лежать «перевод · пояснение» — для игр берём первую часть
    const translation = ((card.back ?? '').split('·')[0] ?? '').trim()
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

// Обработанные паки кэшируются на сессию: данные статичны (build-time), а
// map+isPlayable по ~4600 словам иначе прогонялся заново на КАЖДЫЙ вход в игру
// (Match→Спринт→Пропуск… — каждый заново). import() и так кэшируется модульной
// системой, но фильтрация — нет; кэшируем результат.
const packItemsCache = new Map<AppLang, PoolItem[]>()

/** Слова из готовых паков (ленивый импорт — в стартовый бандл не идут). */
async function loadPackItems(lang: AppLang): Promise<PoolItem[]> {
  const cached = packItemsCache.get(lang)
  if (cached) return cached

  const items: PoolItem[] = []
  if (lang === 'es') {
    const m = await import('../data/spanish/words')
    for (const w of m.allWords) {
      const term = w.spanish?.trim() ?? ''
      const translation = w.russian?.trim() ?? ''
      if (!isPlayable(term, translation)) continue
      items.push({ term, translation, example: w.example_es ?? undefined, level: w.level, topic: w.topic_id })
    }
  } else {
    const m = await import('../data/english/words')
    for (const w of m.allWords) {
      const term = w.english?.trim() ?? ''
      const translation = w.russian?.trim() ?? ''
      if (!isPlayable(term, translation)) continue
      items.push({ term, translation, example: w.example_en ?? undefined, level: w.level, topic: w.topic_id })
    }
  }
  packItemsCache.set(lang, items)
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
      // неизвестный уровень — считаем «далёким», но не отбрасываем;
      // r — случайный разрыв ничьих: внутри одной дистанции порядок каждый раз
      // новый, иначе добор паков всегда давал одни и те же первые ~80 слов
      return { item, distance: i < 0 ? 9 : Math.abs(i - t), r: Math.random() }
    })
    .sort((a, b) => a.distance - b.distance || a.r - b.r)
    .map((x) => x.item)
}

/**
 * Пул для раунда: сначала карточки пользователя, при нехватке — слова паков.
 * `need` — сколько слов минимально нужно игре; добираем с запасом, чтобы
 * хватало на варианты-обманки.
 */
// --- кэш «слова дня» --------------------------------------------------------
// Вычисление тянет ленивый чанк словаря (для ES ~836 КБ) — поэтому готовый
// результат храним в localStorage до конца дня: повторные открытия Главной
// словарь вообще не грузят.
const WOD_KEY = 'recall.word_of_day'

interface WodCache {
  day: number
  word: PoolItem | null
}

function todayNumber(): number {
  return Math.floor(Date.now() / 86_400_000)
}

/** Слово дня из кэша на сегодня (синхронно, без загрузки словаря).
 *  undefined — кэша нет (нужен полный newWordOfDay). */
export function cachedWordOfDay(lang: AppLang): PoolItem | null | undefined {
  const c = readJson<WodCache | null>(`${WOD_KEY}.${lang}`, null)
  if (!c || c.day !== todayNumber()) return undefined
  return c.word
}

function saveWordOfDay(lang: AppLang, word: PoolItem | null): void {
  writeJson(`${WOD_KEY}.${lang}`, { day: todayNumber(), word } satisfies WodCache)
}

/**
 * «Слово дня» для Главной: НОВОЕ слово из пака уровня пользователя, которого
 * ещё нет в колоде (пользователь может добавить его кнопкой «В колоду»).
 * Стабильно в течение дня: индекс = номер дня % размер выборки; результат
 * кэшируется в localStorage на текущий день (см. cachedWordOfDay).
 * null — паки кончились (всё уже в колоде) или не загрузились.
 */
export async function newWordOfDay(lang: AppLang): Promise<PoolItem | null> {
  const cached = cachedWordOfDay(lang)
  if (cached !== undefined) return cached

  // Компактный датасет слова дня (~11КБ gzip) вместо всего словаря (~204КБ):
  // раньше Главная ради одного слова грузила полный пак. Датасет генерится
  // scripts/gen-word-of-day.mjs (по ~40 слов на уровень).
  const [mod, level, deckItems] = await Promise.all([
    import('../data/wordOfDay'),
    targetLevel(lang),
    loadDeckItems(lang).catch(() => []),
  ])
  const entries = lang === 'es' ? mod.wordOfDayES : mod.wordOfDayEN
  const items: PoolItem[] = entries.map((e) => ({
    term: e.t,
    translation: e.r,
    example: e.e,
    level: e.l,
  }))
  const have = new Set(deckItems.map((i) => i.term.toLowerCase()))
  // ближайшие к уровню ~60 кандидатов: слово по силам, но меняется день ото дня
  let candidates = sortByLevelCloseness(items, level)
    .filter((p) => !have.has(p.term.toLowerCase()))
    .slice(0, 60)
  // всё из выборки уже в колоде — показываем что-нибудь по уровню, а не пусто
  if (candidates.length === 0) candidates = sortByLevelCloseness(items, level).slice(0, 60)
  // индекс по модулю длины в границах, когда candidates непуст
  const word = candidates.length === 0 ? null : candidates[todayNumber() % candidates.length]!
  // пустой датасет = сбой загрузки (сеть) — null не кэшируем, чтобы не остаться
  // без слова дня до завтра из-за разовой ошибки
  if (items.length > 0) saveWordOfDay(lang, word)
  return word
}

export async function loadGamePool(lang: AppLang, need = 24): Promise<GamePool> {
  const [deckItems, level] = await Promise.all([
    loadDeckItems(lang).catch(() => []),
    targetLevel(lang),
  ])
  const seen = new Set(deckItems.map((i) => i.term.toLowerCase()))
  const items = [...deckItems]

  // Паки грузим ВСЕГДА. Раньше условие было `items.length < need` (24), то есть
  // при колоде больше 24 слов пак не подмешивался вообще — игры бесконечно
  // крутили одну и ту же колоду. Полный словарь (~204КБ) грузится здесь, при
  // входе в игры — это ленивый чанк, и для игр он нужен по делу (Главная его
  // больше не тянет — там компактный датасет слова дня).
  const packBudget = Math.max(need * 3, 60)
  const packs = await loadPackItems(lang).catch(() => [])
  let added = 0
  // добираем словами СВОЕГО уровня, а не первыми попавшимися
  for (const it of sortByLevelCloseness(packs, level)) {
    const key = it.term.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(it)
    // берём с запасом на обманки, но не тащим весь словарь
    if (++added >= packBudget) break
  }

  return { lang, items, fromDeck: deckItems.length }
}
