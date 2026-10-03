// ============================================================================
// Загрузка данных экрана: различает «пусто» и «не удалось загрузить».
//
// Раньше повсеместно стояло `.catch(() => setRows([]))`, и при сбое сети или
// ошибке RLS ученик видел «Пока нет заданий» вместо ошибки — то есть была
// уверена, что работы нет, и не повторяла попытку. Хук возвращает ошибку
// отдельно и даёт reload().
//
// Внутри есть alive-флаг: ответ отменённой загрузки (например, после смены
// языка) не перетирает актуальные данные.
//
// Ждём не вечно (PLAN.md Ф1.13): на зависшей связи запрос не падает, а висит,
// и экран стоял на заглушках без единого слова. Через LOAD_TIMEOUT_MS — ошибка
// с «Повторить»; опоздавший ответ всё равно принимается и убирает её.
// Ленивый раздел, не скачанный без сети (import() данных), — свой текст.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { CHUNK_OFFLINE_TEXT, isChunkLoadError, isConnectionError, NETWORK_CODE } from '../api/connection'
import { LOAD_TIMEOUT_MS } from './settleAll'

export interface AsyncData<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/**
 * Текст ошибки для плашки: своё сообщение модуля — как есть, сырое сетевое —
 * общий текст экрана. Сбой связи, уже переведённый dbError («Похоже, пропал
 * интернет…», код NETWORK), — тоже как есть: он точнее общего.
 */
function errorText(e: unknown, fallbackMessage: string): string {
  if (isChunkLoadError(e)) return CHUNK_OFFLINE_TEXT
  const translated = (e as { code?: unknown } | null)?.code === NETWORK_CODE
  if (isConnectionError(e) && !translated) return fallbackMessage
  return e instanceof Error ? e.message : fallbackMessage
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
  // самого экрана, а не от функции. Обёртка, а не сам load: функция модуля
  // (`useAsyncData(loadPaymentClaims, [version])`) — один и тот же объект, и
  // useCallback(load, deps) при смене deps вернул бы его же — экран молча не
  // перечитывался (нашлось на списке заявок в /admin, PLAN.md Ф2.1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => load(), deps)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      if (!alive) return
      setError(fallbackMessage)
      setLoading(false)
    }, LOAD_TIMEOUT_MS)
    run()
      .then((res) => {
        if (!alive) return
        setData(res)
        setError(null)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(errorText(e, fallbackMessage))
        setLoading(false)
      })
      .finally(() => clearTimeout(timer))
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [run, attempt, fallbackMessage])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return { data, error, loading, reload }
}
