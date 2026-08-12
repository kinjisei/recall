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
// Разбиение больших паков на порции
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

/**
 * Разворачивает большие темы в части. Уровень, иконка и категория наследуются
 * (категорию считает packCategory по имени, а имя части начинается с исходного).
 * Первая часть сохраняет исходный id, остальные получают номера выше
 * максимального — так части не сталкиваются с настоящими темами.
 */
export function splitLargePacks({ topics, wordsByTopic }: LoadedPacks): LoadedPacks {
  let nextId = topics.reduce((max, t) => Math.max(max, t.id), 0) + 1
  const outTopics: WordTopic[] = []
  const outWords = new Map<number, PackWord[]>()
  const done = new Set<number>()
  for (const t of topics) {
    // Одна тема может быть описана дважды: испанские «Фразы из диалогов» лежат
    // в двух файлах с одним id, и слова оттуда СЛИВАЮТСЯ — так задумано. А вот
    // строка в списке при этом двоилась: два одинаковых пака с одинаковым
    // содержимым. С разбиением задвоились бы и все части.
    if (done.has(t.id)) continue
    done.add(t.id)
    const words = wordsByTopic.get(t.id) ?? []
    const parts = splitTopicWords(words)
    if (parts.length === 1) {
      outTopics.push(t)
      outWords.set(t.id, words)
      continue
    }
    parts.forEach((part, i) => {
      const id = i === 0 ? t.id : nextId++
      outTopics.push({ ...t, id, name: `${t.name} · ${i + 1}/${parts.length}` })
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
  // Большие темы разворачиваются в части ЗДЕСЬ — оба экрана получают уже
  // готовые паки и ничего не знают про разбиение.
  return splitLargePacks({ topics, wordsByTopic: map })
}

/** Порядок уровней для группировки в списках. */
export const PACK_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
