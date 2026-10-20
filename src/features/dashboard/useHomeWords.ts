// ============================================================================
// Слова на Главной: сколько карточек ждёт повторения, сколько слов всего
// (0 — колода пуста, новичка не путаем «Всё повторено») и слово дня.
// Вынесено из DashboardPage без правок поведения.
//
// Слово дня — НОВОЕ слово из пака уровня с кнопкой «В колоду». Кэш на день
// читаем сразу; полный расчёт тянет ленивый чанк словаря (ES ~836 КБ),
// поэтому первую загрузку откладываем до простоя браузера, чтобы не
// конкурировать с первым рендером Главной. Пока считается — `wordPending`:
// Главная держит место, чтобы низ не прыгал.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { countDueCards } from '../../lib/fsrs'
import { countMyWords } from '../../lib/cards'
import { cachedWordOfDay, newWordOfDay, type PoolItem } from '../../lib/wordPool'
import type { AppLang } from '../../types'

export interface HomeWords {
  /** null — ещё считаем или не вышло; до 99. */
  dueCount: number | null
  /** null — ещё считаем или не вышло. */
  wordCount: number | null
  wordOfDay: PoolItem | null
  /** Слово дня ещё считается. */
  wordPending: boolean
}

/** Что пришло — и к какому входу и языку: ответ по старому языку не годится. */
interface Got {
  key: string
  due?: number
  words?: number
  /** Слово дня досчитано (null — посчитать не вышло). */
  word?: PoolItem | null
}

export function useHomeWords(userId: string | undefined, lang: AppLang): HomeWords {
  // Результат помнит, к какой загрузке относится: смена языка сама даёт
  // «ещё считаем», без сброса состояния в эффекте (как useHomeData).
  const key = `${userId ?? ''}#${lang}`
  const [got, setGot] = useState<Got>({ key: '' })
  // кэш слова дня на сегодня — сразу, без ожидания
  const cached = useMemo(() => cachedWordOfDay(lang), [lang])

  useEffect(() => {
    if (!userId) return
    // alive: при быстром переключении EN/ES ответ по старому языку не должен
    // перетирать данные нового
    let alive = true
    const put = (patch: Omit<Got, 'key'>) => {
      if (alive) setGot((g) => ({ ...(g.key === key ? g : { key }), ...patch }))
    }
    // счётчик — лёгкие count-запросы, без выкачивания строк карточек
    countDueCards(lang)
      .then((n) => put({ due: Math.min(n, 99) }))
      .catch(() => {})
    countMyWords(lang)
      .then((n) => put({ words: n }))
      .catch(() => {})

    let idleId = 0
    let usedIdle = false
    if (cachedWordOfDay(lang) === undefined) {
      const load = () => {
        newWordOfDay(lang)
          .then((w) => put({ word: w }))
          .catch(() => put({ word: null }))
      }
      if (typeof requestIdleCallback === 'function') {
        usedIdle = true
        idleId = requestIdleCallback(load, { timeout: 3000 })
      } else {
        idleId = window.setTimeout(load, 1500)
      }
    }
    return () => {
      alive = false
      if (idleId) {
        if (usedIdle) cancelIdleCallback(idleId)
        else window.clearTimeout(idleId)
      }
    }
  }, [userId, lang, key])

  const mine = got.key === key ? got : null
  return {
    dueCount: mine?.due ?? null,
    wordCount: mine?.words ?? null,
    wordOfDay: cached ?? mine?.word ?? null,
    wordPending: cached === undefined && mine?.word === undefined,
  }
}
