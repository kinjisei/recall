// ============================================================================
// Сброс прокрутки наверх при смене маршрута. React Router не делает этого сам:
// без него, открыв вкладку, попадаешь на прежнюю прокрутку — заголовок экрана
// («Речь», «Диалог») уезжает под шапку. Внутренние переключения экранов через
// состояние (mode в хабах, BackButton) маршрут НЕ меняют, поэтому их прокрутку
// это не трогает.
//
// Исключение — возврат вкладкой (лист s4): экран вкладки встаёт туда, где его
// оставили (shell/tabScroll). Содержимое может дорисоваться позже (список
// грузится) — тогда пробуем ещё несколько раз, пока страница не дорастёт.
// ============================================================================
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { tabScrollFor } from './shell/tabScroll'

export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    const y = tabScrollFor(pathname)
    if (!y) {
      window.scrollTo(0, 0)
      return
    }
    let tries = 0
    const timer = window.setInterval(() => {
      window.scrollTo(0, y)
      if (Math.abs(window.scrollY - y) < 2 || ++tries > 12) window.clearInterval(timer)
    }, 50)
    window.scrollTo(0, y)
    return () => window.clearInterval(timer)
  }, [pathname])
  return null
}
