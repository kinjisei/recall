// Вкладки текущего человека и активная из них — одно место для нижней и
// боковой панели. Роль читается, только когда меню по роли включено
// (ROLE_NAV_ENABLED): пока выключено, лишнего запроса профиля нет.
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getProfile } from '../../lib/profile'
import { ROLE_NAV_ENABLED, activeTabIndex, tabsFor, type NavTab } from '../navigation'

export interface NavTabsState {
  tabs: NavTab[]
  /** −1 — ни одна вкладка не подходит (экран вне вкладок). */
  activeIndex: number
  /** Нажатие на вкладку: повторный тап по своей вкладке сбрасывает экран к хабу. */
  onTabClick: (to: string) => void
}

export function useNavTabs(): NavTabsState {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    if (!ROLE_NAV_ENABLED || !user) return
    let alive = true
    // профиль — из общего кэша (lib/profile): меню аватара запрашивает тот же ряд
    getProfile(user.id).then((p) => alive && setRole(p?.role ?? null))
    return () => {
      alive = false
    }
  }, [user])

  const tabs = tabsFor(role)
  return {
    tabs,
    activeIndex: activeTabIndex(tabs, pathname),
    onTabClick: (to) => {
      // повторный тап по активной вкладке, когда мы уже на её роуте
      // (напр. /study с внутренним экраном «Мои слова»): ссылка ведёт
      // «в никуда», поэтому шлём событие — экран сам сбросится к хабу.
      if (pathname === to) {
        window.dispatchEvent(new CustomEvent('recall:reset-tab', { detail: to }))
      }
    },
  }
}
