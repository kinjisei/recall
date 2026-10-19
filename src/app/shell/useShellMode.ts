// Какое меню у окна (правила d0, журнал п.55): уже 720 — телефонное (шапка и
// нижняя панель), 720–1279 — рельс 72 из иконок, от 1280 — меню 240 с
// подписями. От 1280 меню можно свернуть до рельса руками; выбор хранится на
// устройстве (`recall.menu`) и переживает выход из аккаунта.
import { useCallback, useState } from 'react'
import { shellMode, type ShellMode } from '../../shared/lib/shellGeometry'
import { readRaw, writeRaw } from '../../shared/lib/storage'
import { useMediaQuery } from '../../shared/lib/useMediaQuery'
import { MENU_QUERY, RAIL_QUERY } from '../../shared/ui/breakpoints'

const KEY = 'recall.menu'

export interface ShellModeState {
  mode: ShellMode
  /** Окно ≥ 1280: меню можно свернуть и развернуть. */
  collapsible: boolean
  toggle: () => void
}

export function useShellMode(): ShellModeState {
  const railWide = useMediaQuery(RAIL_QUERY)
  const menuWide = useMediaQuery(MENU_QUERY)
  const [collapsed, setCollapsed] = useState(() => readRaw(KEY) === 'rail')
  const toggle = useCallback(() => {
    writeRaw(KEY, collapsed ? 'full' : 'rail')
    setCollapsed(!collapsed)
  }, [collapsed])
  return { mode: shellMode(railWide, menuWide, collapsed), collapsible: menuWide, toggle }
}
