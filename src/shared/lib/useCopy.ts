// ============================================================================
// «Скопировать» с отметкой «Скопировано» на пару секунд. Одна на приложение:
// код приглашения в студии, реквизиты на «Как оплатить», ссылка рефералки
// (Ф2.3) — раньше каждый экран писал свой try/catch и свой таймер.
//
// Буфер бывает недоступен (старый браузер, запрет, не https) — тогда copy()
// вернёт false, а экран скажет, что делать: текст на экране всегда виден и
// выделяется целиком.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react'

export function useCopy(holdMs = 2000): {
  /** Что скопировано только что (ключ из copy), иначе null. */
  copied: string | null
  copy: (key: string, text: string) => Promise<boolean>
} {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (key: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        return false
      }
      setCopied(key)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(null), holdMs)
      return true
    },
    [holdMs],
  )

  return { copied, copy }
}
