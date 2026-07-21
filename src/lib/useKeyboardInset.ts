// ============================================================================
// Высота экранной клавиатуры через visualViewport API. 0 — клавиатура закрыта.
// Нужен, чтобы прижатую к низу панель ввода (Диалог) поднимать над клавиатурой,
// а не прятать её под ней. Если API нет (старый браузер) — всегда 0 (панель
// просто стоит над навигацией, как обычно).
// ============================================================================
import { useEffect, useState } from 'react'

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return

    const update = () => {
      // сколько «съедено» снизу видимой области = высота клавиатуры
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      // мелкие колебания (адресная строка и т.п.) игнорируем
      setInset(kb > 120 ? kb : 0)
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
