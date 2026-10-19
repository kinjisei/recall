// ============================================================================
// Медиа-запрос как состояние React: раскладка по ширине окна (журнал п.45–46,
// п.55).
//
// Каркас на телефоне рисует шапку и нижнюю панель, от 720 px — меню слева
// (рельс или 240). Решает это JS, а не CSS-классы `rail:hidden`: иначе в
// странице жили бы обе навигации сразу (два меню профиля, два запроса плана,
// смоуки находили бы скрытую копию). useSyncExternalStore отдаёт верное
// значение уже в первом рендере — мигания «сперва телефонная раскладка» нет.
//
// Раскладкам ВНУТРИ каркаса окно не важно — им нужна ширина содержимого
// (shared/lib/screenWidth, useContentAtLeast).
// ============================================================================
import { useCallback, useSyncExternalStore } from 'react'
import { RAIL_QUERY } from '../ui/breakpoints'

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

/**
 * Окно компьютера — от 720 px (d0): меню слева вместо шапки и нижней панели,
 * шторка открывается правой панелью, а не снизу.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(RAIL_QUERY)
}
