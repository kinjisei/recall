// ============================================================================
// Медиа-запрос как состояние React: раскладка по ширине экрана (журнал п.45–46).
//
// Каркас рисует на компьютере боковое меню, а на телефоне — шапку и нижнюю
// панель. Решает это JS, а не CSS-классы `lg:hidden`: иначе в странице жили бы
// обе навигации сразу (два меню профиля, два запроса плана, смоуки находили
// бы скрытую копию). useSyncExternalStore отдаёт верное значение уже в первом
// рендере — мигания «сперва телефонная раскладка» нет.
// ============================================================================
import { useCallback, useSyncExternalStore } from 'react'
import { DESKTOP_QUERY } from '../ui/breakpoints'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** Широкий экран компьютера: меню слева вместо шапки и нижней панели. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
