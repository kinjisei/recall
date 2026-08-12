// ============================================================================
// Готовые паки слов — общий источник для ученика и преподавателя.
//
// Ученик берёт паки сам («Учёба → Мой словарь → Паки»), преподаватель выдаёт их
// адресно из карточки ученика. Загрузка и разбивка на категории живут ЗДЕСЬ, а
// не в двух экранах: разъехавшись, они показали бы одному и тому же паку разные
// уровни и разные названия категорий — а сверить это глазами невозможно.
//
// Словари грузятся динамическим import: каждый язык — отдельный чанк (испанский
// ~836 КБ), в стартовый бандл он не попадает.
// ============================================================================
import type { AppLang, WordTopic } from '../types'

/** Слово пака в общем виде — уже как будущая карточка. */
export interface PackWord {
  front: string
  back: string
  example?: string
}

export interface LoadedPacks {
  topics: WordTopic[]
  wordsByTopic: Map<number, PackWord[]>
}

/** Категория пака: база уровня, идиомы или обычные темы. */
export type PackCategory = 'base' | 'idioms' | 'themes'

/**
 * Категория по названию темы. Правило одно на приложение: «База уровня» —
 * частотный минимум, «Идиомы» — сборник EFE, остальное — тематические паки.
 */
export function packCategory(topicName: string): PackCategory {
  if (topicName.startsWith('База')) return 'base'
  if (topicName.startsWith('Идиомы')) return 'idioms'
  return 'themes'
}

export const PACK_CATEGORY_LABEL: Record<PackCategory, string> = {
  base: '⭐ База уровня — самые нужные слова',
  themes: 'Темы',
  idioms: 'Идиомы',
}

// ---------------------------------------------------------------------------
// Сборка паков: одна тема — один пак, порция — 20 слов
//
// Пак — это то, что ученик берёт целиком, поэтому он обязан быть однозначным:
// одна строка на тему и по одному слову в ней. Данные приехали из полутора
// десятков файлов и сами по себе этого не дают — «Природа · A2» описана в двух
// файлах (14 слов и 26), «Описание людей · B1» тоже (12 и 30, причём sociable и
// callado есть в обоих), а испанские «Фразы из диалогов» и вовсе повторяют один
// id. На экране это выглядело как две одинаковые строки подряд, и человек
// выбирал между ними наугад.
//
// Пак должен помещаться в неделю между уроками. «База уровня» — это 38 тем
// РОВНО по 100 слов, испанская «Базовая лексика A1» — 462: выдать такое ученику
// значит выдать заведомо невыполнимое, а преподавателю — не дать ничего
// отмерить. Больше 30 слов у нас 56 тем из 357.
//
// Режем ПРАВИЛОМ ПРИ ЗАГРУЗКЕ, а не в файлах словаря: там 9512 слов, испанские
// сверяемы с исходным приложением (d:\projects\spanish), и неудачная конвертация
// не откатывается. id тем нигде не сохраняются — ни в базе, ни в localStorage,
// — поэтому новые номера частей ничего не ломают (в grammar_mistakes.topic_id
// лежат темы ГРАММАТИКИ, это другой каталог).
//
// ⚠️ Правило живёт ЗДЕСЬ и только здесь: и «Паки» ученика, и выдача слов
// преподавателем читают этот модуль. Второй экземпляр разошёлся бы с первым
// молча — и один и тот же пак назывался бы по-разному на двух экранах.
// ---------------------------------------------------------------------------

/** Размер порции. */
export const PACK_PART_SIZE = 20
/** До этого размера включительно тему не трогаем вообще. */
export const PACK_SPLIT_OVER = 30
/** Хвост короче этого приклеивается к предыдущей части. */
export const PACK_MIN_PART = 8

/**
 * Делит слова темы на порции по 20.
 *
 * Порядок слов ИСХОДНЫЙ: в «Базе уровня» он частотный, значит первая часть —
 * самая нужная, и перемешивать её нельзя. Хвост короче восьми приклеивается к
 * предыдущей части, иначе список пополнялся бы огрызками «часть 6 · 2 слова».
 */
export function splitTopicWords(words: PackWord[]): PackWord[][] {
  if (words.length <= PACK_SPLIT_OVER) return [words]
  const parts: PackWord[][] = []
  for (let i = 0; i < words.length; i += PACK_PART_SIZE) {
    parts.push(words.slice(i, i + PACK_PART_SIZE))
  }
  if (parts.length > 1 && parts[parts.length - 1]!.length < PACK_MIN_PART) {
    const tail = parts.pop()!
    parts[parts.length - 1] = [...parts[parts.length - 1]!, ...tail]
  }
  return parts
}

/** Ключ пака: имя и уровень. Одинаковые — значит одна и та же тема. */
const packKey = (t: WordTopic) => `${t.name.trim().toLowerCase()}|${t.level}`

/** Слово узнаём по лицевой стороне без учёта регистра и пробелов по краям. */
const wordKey = (w: PackWord) => w.front.trim().toLowerCase()

/**
 * Собирает готовые паки: склеивает одноимённые темы, снимает повторы слов и
 * разворачивает большие темы в части.
 *
 * Склейка идёт по имени и уровню, а не по id: одна тема бывает описана и одним
 * id в двух файлах, и разными id — снаружи это одно и то же, и человек ждёт
 * одну строку. Разные уровни не склеиваются никогда: «Природа · A2» и
 * «Природа · B2» — разные паки по замыслу.
 *
 * Порядок слов исходный, первым идёт файл, который встретился раньше. Уровень и
 * иконка достаются от первой встреченной темы, категория считается по имени.
 * Первая часть сохраняет исходный id, остальные получают номера выше
 * максимального — так части не сталкиваются с настоящими темами.
 */
export function preparePacks({ topics, wordsByTopic }: LoadedPacks): LoadedPacks {
  // 1. Группируем описания одной темы. ids собираем без повторов: у «Фраз из
  //    диалогов» два описания делят один id, и слова оттуда уже слиты в карте —
  //    взяв их дважды, мы бы удвоили пак.
  const groups = new Map<string, { topic: WordTopic; ids: number[] }>()
  for (const t of topics) {
    const key = packKey(t)
    const group = groups.get(key)
    if (!group) groups.set(key, { topic: t, ids: [t.id] })
    else if (!group.ids.includes(t.id)) group.ids.push(t.id)
  }

  let nextId = topics.reduce((max, t) => Math.max(max, t.id), 0) + 1
  const outTopics: WordTopic[] = []
  const outWords = new Map<number, PackWord[]>()

  for (const { topic, ids } of groups.values()) {
    // 2. Слова всех описаний подряд, каждое слово — один раз. Повтор внутри
    //    пака означал бы две одинаковые карточки в колоде ученика.
    const seen = new Set<string>()
    const words: PackWord[] = []
    for (const id of ids) {
      for (const w of wordsByTopic.get(id) ?? []) {
        const key = wordKey(w)
        if (seen.has(key)) continue
        seen.add(key)
        words.push(w)
      }
    }

    // 3. Разворачиваем в части, если пак не помещается в неделю.
    const parts = splitTopicWords(words)
    if (parts.length === 1) {
      outTopics.push(topic)
      outWords.set(topic.id, words)
      continue
    }
    parts.forEach((part, i) => {
      const id = i === 0 ? topic.id : nextId++
      outTopics.push({ ...topic, id, name: `${topic.name} · ${i + 1}/${parts.length}` })
      outWords.set(id, part)
    })
  }
  return { topics: outTopics, wordsByTopic: outWords }
}

/** Ленивая загрузка словаря нужного языка (каждый — отдельный чанк). */
export async function loadPacks(lang: AppLang): Promise<LoadedPacks> {
  const map = new Map<number, PackWord[]>()
  let topics: WordTopic[]
  if (lang === 'es') {
    const m = await import('../data/spanish/words')
    topics = m.allTopics
    for (const w of m.allWords) {
      const arr = map.get(w.topic_id) ?? []
      arr.push({ front: w.spanish, back: w.russian, example: w.example_es })
      map.set(w.topic_id, arr)
    }
  } else {
    const m = await import('../data/english/words')
    topics = m.allTopics
    for (const w of m.allWords) {
      const arr = map.get(w.topic_id) ?? []
      arr.push({ front: w.english, back: w.russian, example: w.example_en })
      map.set(w.topic_id, arr)
    }
  }
  // Сборка паков живёт ЗДЕСЬ — оба экрана получают готовое и не знают ни про
  // склейку одноимённых тем, ни про разбиение на части.
  return preparePacks({ topics, wordsByTopic: map })
}

/** Порядок уровней для группировки в списках. */
export const PACK_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
