// Вкладки текущего человека и активная из них — одно место для нижней и
// боковой панели. Роль читается, только когда меню по роли включено
// (ROLE_NAV_ENABLED): пока выключено, лишнего запроса профиля нет.
import { useLocation } from 'react-router-dom'
import { ROLE_NAV_ENABLED, activeTabIndex, tabsFor, type NavTab } from '../navigation'
import { useMyRole } from './useMyRole'

export interface NavTabsState {
  tabs: NavTab[]
  /** −1 — ни одна вкладка не подходит (экран вне вкладок). */
  activeIndex: number
  /** Нажатие на вкладку: повторный тап по своей вкладке сбрасывает экран к хабу. */
  onTabClick: (to: string) => void
}

export function useNavTabs(): NavTabsState {
  const { pathname } = useLocation()
  // роль — общим хуком каркаса (useMyRole): тот же ряд профиля, что у меню
  // аватара, и перечитывается после смены роли
  const role = useMyRole(ROLE_NAV_ENABLED)

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
