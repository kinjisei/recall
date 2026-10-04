// ============================================================================
// «Сейчас», которое само обновляется: линия текущего времени в расписании,
// «через 50 мин», «идёт», «прошёл». Раз в полминуты — чаще подписи не
// меняются, а лишняя перерисовка всей недели раз в секунду ни к чему.
// Вкладка вернулась из фона — обновляем сразу, а не через полминуты.
// ============================================================================
import { useEffect, useState } from 'react'

export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = window.setInterval(tick, everyMs)
    const onShow = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [everyMs])
  return now
}
