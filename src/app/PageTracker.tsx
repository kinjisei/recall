// ============================================================================
// Счётчик просмотров экранов. Живёт внутри BrowserRouter и срабатывает на смену
// маршрута — включая заходы БЕЗ входа в аккаунт. Именно эти визиты и есть
// знаменатель воронки: без них 5 регистраций из 500 визитов и 5 из 50 выглядят
// одинаково, хотя второй канал в десять раз лучше.
//
// Источник (utm/реферер) запоминается один раз при первом заходе — до того, как
// человек кликнет дальше и параметр из адреса пропадёт.
// ============================================================================
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { captureSource, trackPageView } from '../lib/analytics'

export function PageTracker() {
  const { pathname, search } = useLocation()
  const last = useRef<string | null>(null)

  useEffect(() => {
    captureSource(search)
  }, [search])

  useEffect(() => {
    // повторный рендер того же маршрута не считаем вторым визитом
    if (last.current === pathname) return
    last.current = pathname
    trackPageView(pathname)
  }, [pathname])

  return null
}
