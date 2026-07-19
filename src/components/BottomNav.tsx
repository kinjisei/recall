import { NavLink, useLocation } from 'react-router-dom'
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
  { to: '/grammar', label: 'Грам.', Icon: IconGrammar, end: false },
  { to: '/conversation', label: 'Диалог', Icon: IconChat, end: false },
]

// Пружинящая кривая для скольжения индикатора (лёгкий overshoot).
const SPRING = '[transition-timing-function:cubic-bezier(0.34,1.4,0.64,1)]'

export function BottomNav() {
  const { lang } = useLanguage()
  const { pathname } = useLocation()
  const visible = tabs.filter((t) => !t.esOnly || lang === 'es')
  const activeIndex = visible.findIndex((t) =>
    t.end ? pathname === t.to : pathname.startsWith(t.to),
  )

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
      <div className="relative mx-auto flex max-w-screen-sm items-stretch justify-around">
        {/* Плавающий индикатор: градиентный кружок скользит к активной вкладке */}
        {activeIndex >= 0 && (
          <div
            className={`pointer-events-none absolute top-0 h-full transition-[left] duration-300 ${SPRING}`}
            style={{
              left: `${(activeIndex * 100) / visible.length}%`,
              width: `${100 / visible.length}%`,
            }}
            aria-hidden="true"
          >
            <div className="bg-brand-gradient absolute left-1/2 top-[-10px] h-11 w-11 -translate-x-1/2 rounded-full shadow-lg shadow-sky-600/40" />
          </div>
        )}
        {visible.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative z-10 flex min-h-[44px] flex-1 flex-col items-center gap-1 pb-1.5 pt-2 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-12 items-center justify-center transition-transform duration-300 ${SPRING} ${
                    isActive ? 'translate-y-[-14px] text-white' : ''
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
