// ============================================================================
// Загрузка данных экрана: различает «пусто» и «не удалось загрузить».
//
// Раньше повсеместно стояло `.catch(() => setRows([]))`, и при сбое сети или
// ошибке RLS ученица видела «Пока нет заданий» вместо ошибки — то есть была
// уверена, что работы нет, и не повторяла попытку. Хук возвращает ошибку
// отдельно и даёт reload().
//
// Внутри есть alive-флаг: ответ отменённой загрузки (например, после смены
// языка) не перетирает актуальные данные.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'

export interface AsyncData<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: React.DependencyList,
  fallbackMessage = 'Не удалось загрузить данные',
): AsyncData<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  // load пересоздаётся на каждый рендер у вызывающего, поэтому зависим от deps
  // самого экрана, а не от функции
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    run()
      .then((res) => {
        if (!alive) return
        setData(res)
        setLoading(false)
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : fallbackMessage)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [run, attempt, fallbackMessage])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return { data, error, loading, reload }
}
