// ============================================================================
// «Где я нахожусь» — в адресе, а не в useState.
//
// Зачем. Ревью навигации (docs/mkt/20-ux-review-1g-navigation.md) замерило:
// больше половины внутренних экранов не существовало для истории браузера.
// «Назад» из открытого текста уводил на Главную мимо списка, F5 терял место, а
// ссылку «прочитай вот это» преподаватель прислать не мог. В установленном на
// телефон PWA свайп-назад — единственный способ вернуться, поэтому это не
// косметика.
//
// Правило, по которому это работает:
//   • ЗАХОД внутрь пушит запись в историю (чтобы «назад» вернул на шаг);
//   • ВОЗВРАТ кареткой запись НЕ пушит, а снимает (иначе свайп-назад
//     возвращает туда, откуда только что вышли, — так и было со «Спринтом»).
//
// Адресуемо МЕСТО (какой текст, урок, вкладка), а не ход раунда: спринт после
// F5 честно начинается заново.
// ============================================================================
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { withViewTransition } from './viewTransition'

/**
 * Один параметр адреса как состояние экрана.
 *
 * @param key   имя параметра (?view=, ?text=, ?lesson=…)
 * @param valid необязательная проверка: неизвестное значение (чужая ссылка,
 *              удалённый урок) трактуется как «параметра нет», а не как
 *              пустой экран
 *
 * @example
 *   const [view, setView] = useUrlState('view', (v) => v === 'reader')
 *   setView('reader')        // заход внутрь — «назад» вернёт в хаб
 *   setView(null)            // возврат кареткой — лишней записи не остаётся
 */
export function useUrlState(
  key: string,
  valid?: (value: string) => boolean,
): [string | null, (next: string | null) => void] {
  const [params, setParams] = useSearchParams()

  const raw = params.get(key)
  const value = raw !== null && (!valid || valid(raw)) ? raw : null

  const set = useCallback(
    (next: string | null) => {
      const nextParams = new URLSearchParams(params)
      if (next === null) nextParams.delete(key)
      else nextParams.set(key, next)
      // заход внутрь — новая запись в истории; возврат — замена текущей.
      // Без этого «назад» после выхода кареткой возвращал обратно внутрь.
      // Направление перехода берём отсюда же: null — выход наружу.
      withViewTransition(next === null ? 'out' : 'in', () => {
        setParams(nextParams, { replace: next === null })
      })
    },
    [params, setParams, key],
  )

  return [value, set]
}

/**
 * Несколько параметров разом — когда экран описывается парой значений
 * (например, задание + стадия его прохождения). Отдельными вызовами
 * useUrlState это сделать нельзя: два set подряд затрут друг друга, потому что
 * каждый читает свой снимок params.
 */
export function useUrlStates(
  keys: string[],
): [Record<string, string | null>, (next: Record<string, string | null>) => void] {
  const [params, setParams] = useSearchParams()

  const values: Record<string, string | null> = {}
  for (const k of keys) values[k] = params.get(k)

  const set = useCallback(
    (next: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(params)
      for (const [k, v] of Object.entries(next)) {
        if (v === null) nextParams.delete(k)
        else nextParams.set(k, v)
      }
      // если после правки ни одного «внутреннего» ключа не осталось — это
      // выход наружу, запись в историю не нужна
      const wentOut = keys.every((k) => !nextParams.get(k))
      withViewTransition(wentOut ? 'out' : 'in', () => {
        setParams(nextParams, { replace: wentOut })
      })
    },
    [params, setParams, keys],
  )

  return [values, set]
}
