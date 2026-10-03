// ============================================================================
// Прошлая переписка «Диалога» этого языка. Раньше реплики писались в базу и
// НИКОГДА не читались: уход за словом или уроком обнулял чат.
//
// Не поднялась из-за связи — failed: экран так и говорит и даёт «Повторить»,
// а не показывает пустой чат, будто переписки не было (PLAN.md Ф1.13).
// Результат помнит свою загрузку (пользователь + язык + попытка), поэтому
// смена языка сама даёт «ещё поднимаем».
// ============================================================================
import { useEffect, useState, type RefObject } from 'react'
import { loadLastChat } from '../../lib/chatHistory'
import type { AppLang, ChatTurn } from '../../types'

export interface LastChat {
  /** Ещё поднимаем — не мигаем приглашением начать разговор, который уже идёт. */
  loading: boolean
  /** Не поднялась из-за сбоя (связь, база). */
  failed: boolean
  retry: () => void
}

/**
 * @param setMsgs   лента экрана: новая загрузка (другой язык, «Повторить») её
 *                  очищает, найденная переписка — заполняет
 * @param convIdRef номер переписки, в которую экран дописывает реплики
 */
export function useLastChat(
  userId: string | undefined,
  lang: AppLang,
  setMsgs: (turns: ChatTurn[]) => void,
  convIdRef: RefObject<string | null>,
): LastChat {
  const [attempt, setAttempt] = useState(0)
  const key = `${userId ?? ''}#${lang}#${attempt}`
  const [done, setDone] = useState<{ key: string; failed: boolean } | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    convIdRef.current = null
    setMsgs([])
    loadLastChat(userId, lang).then(
      (prev) => {
        if (!alive) return
        if (prev) {
          convIdRef.current = prev.id
          setMsgs(prev.turns)
        }
        setDone({ key, failed: false })
      },
      () => alive && setDone({ key, failed: true }),
    )
    return () => {
      alive = false
    }
    // setMsgs и convIdRef у экрана постоянные — загрузку задаёт key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const current = done?.key === key ? done : null
  return { loading: !current, failed: current?.failed ?? false, retry: () => setAttempt((n) => n + 1) }
}
