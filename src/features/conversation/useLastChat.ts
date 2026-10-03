// ============================================================================
// Прошлая переписка «Диалога» этого языка. Раньше реплики писались в базу и
// НИКОГДА не читались: уход за словом или уроком обнулял чат.
//
// Не поднялась из-за связи — failed: экран так и говорит и даёт «Повторить»,
// а не показывает пустой чат, будто переписки не было (PLAN.md Ф1.13).
// Результат помнит свою загрузку (пользователь + язык + попытка), поэтому
// смена языка сама даёт «ещё поднимаем».
// ============================================================================
import { useEffect, useState } from 'react'
import { loadLastChat, type LoadedChat } from '../../lib/chatHistory'
import type { AppLang } from '../../types'

export interface LastChat {
  /** Ещё поднимаем — не мигаем приглашением начать разговор, который уже идёт. */
  loading: boolean
  /** Не поднялась из-за сбоя (связь, база). */
  failed: boolean
  retry: () => void
}

/**
 * @param onStart  началась новая загрузка (другой язык, «Повторить») — экран очищает ленту
 * @param onLoaded переписка нашлась
 */
export function useLastChat(
  userId: string | undefined,
  lang: AppLang,
  onStart: () => void,
  onLoaded: (chat: LoadedChat) => void,
): LastChat {
  const [attempt, setAttempt] = useState(0)
  const key = `${userId ?? ''}#${lang}#${attempt}`
  const [done, setDone] = useState<{ key: string; failed: boolean } | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    onStart()
    loadLastChat(userId, lang).then(
      (prev) => {
        if (!alive) return
        if (prev) onLoaded(prev)
        setDone({ key, failed: false })
      },
      () => alive && setDone({ key, failed: true }),
    )
    return () => {
      alive = false
    }
    // колбэки экрана пересоздаются на каждый рендер — загрузку задаёт key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const current = done?.key === key ? done : null
  return { loading: !current, failed: current?.failed ?? false, retry: () => setAttempt((n) => n + 1) }
}
