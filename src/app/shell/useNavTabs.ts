// Вкладки текущего человека и активная из них — одно место для нижней и
// боковой панели. Набор — по роли (navigation.ts); пока роль неизвестна
// (первый вход на устройстве), вкладок нет, а не чужое меню. Счётчик на
// вкладке «Задания» учителя — «ждут проверки» (features/teacher).
import { useLocation } from 'react-router-dom'
import { useWaitingCount } from '../../features/teacher'
import { activeTabIndex, tabsFor, type NavTab } from '../navigation'
import { useRoleState } from './useMyRole'

export interface NavTabsState {
  tabs: NavTab[]
  /** −1 — ни одна вкладка не подходит (экран вне вкладок). */
  activeIndex: number
  /** Счётчик вкладки: число (0 — без кружка) и подпись для чтения с экрана. */
  badgeOf: (tab: NavTab) => { n: number; label: string | undefined }
  /** Нажатие на вкладку: повторный тап по своей вкладке сбрасывает экран к хабу. */
  onTabClick: (to: string) => void
}

export function useNavTabs(): NavTabsState {
  const { pathname } = useLocation()
  // роль — общим хуком каркаса: тот же ряд профиля, что у меню аватара, и
  // перечитывается после смены роли
  const { role, status } = useRoleState()
  const reviews = useWaitingCount(role === 'teacher')

  const tabs = tabsFor(status === 'unknown' ? undefined : role)
  return {
    tabs,
    activeIndex: activeTabIndex(tabs, pathname),
    badgeOf: ({ badge, label }) => {
      const n = badge === 'reviews' ? reviews : 0
      // кружок скрыт от чтения с экрана — число говорит подпись ссылки
      return { n, label: n > 0 ? `${label}, ждут проверки: ${n}` : undefined }
    },
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
