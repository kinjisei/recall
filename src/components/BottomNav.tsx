// ============================================================================
// Нижняя навигация «Nocturne»: плавающая glass-капсула с пятью постоянными
// вкладками. Активная — мягкая акцентная подсветка и залитая (fill) иконка.
//
// Пять вкладок вместо шести: «Грамматика» и «Тексты» переехали в хаб «Учёба»,
// поэтому состав больше не прыгает при переключении EN/ES.
// ============================================================================
import { NavLink } from 'react-router-dom'
import type { Icon } from '@phosphor-icons/react'
import {
  HouseIcon,
  CardsThreeIcon,
  BooksIcon,
  MicrophoneIcon,
  ChatCircleDotsIcon,
} from '@phosphor-icons/react'

interface Tab {
  to: string
  label: string
  Icon: Icon
  end: boolean
}

const tabs: Tab[] = [
  { to: '/', label: 'Главная', Icon: HouseIcon, end: true },
  { to: '/flashcards', label: 'Слова', Icon: CardsThreeIcon, end: false },
  { to: '/study', label: 'Учёба', Icon: BooksIcon, end: false },
  { to: '/pronunciation', label: 'Речь', Icon: MicrophoneIcon, end: false },
  { to: '/conversation', label: 'Диалог', Icon: ChatCircleDotsIcon, end: false },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-screen-sm rounded-3xl border border-white/10 bg-[rgba(22,24,38,.78)] backdrop-blur-xl mb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around px-1.5 py-1.5">
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-medium transition-[background-color,color] duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${
                isActive
                  ? 'bg-[rgba(145,132,217,.16)] text-[var(--night-accent-100)]'
                  : 'text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
