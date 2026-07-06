import { NavLink } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import { useLanguage } from '../context/LanguageContext'
import {
  IconHome,
  IconDeck,
  IconBook,
  IconMic,
  IconGrammar,
  IconChat,
} from './icons'

interface Tab {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  end: boolean
  esOnly?: boolean
}

const tabs: Tab[] = [
  { to: '/', label: 'Главная', Icon: IconHome, end: true },
  { to: '/flashcards', label: 'Колода', Icon: IconDeck, end: false },
  { to: '/reader', label: 'Ввод', Icon: IconBook, end: false },
  { to: '/pronunciation', label: 'Речь', Icon: IconMic, end: false },
  { to: '/grammar', label: 'Грам.', Icon: IconGrammar, end: false, esOnly: true },
  { to: '/conversation', label: 'Диалог', Icon: IconChat, end: false },
]

export function BottomNav() {
  const { lang } = useLanguage()
  const visible = tabs.filter((t) => !t.esOnly || lang === 'es')

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto flex max-w-screen-sm items-stretch justify-around">
        {visible.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex min-h-[44px] flex-1 flex-col items-center gap-1 pb-1.5 pt-2 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? 'bg-sky-100 dark:bg-sky-950/60' : 'bg-transparent'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
