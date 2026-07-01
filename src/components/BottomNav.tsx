import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Главная', icon: '🏠', end: true },
  { to: '/flashcards', label: 'Колода', icon: '🎴', end: false },
  { to: '/reader', label: 'Ввод', icon: '📖', end: false },
  { to: '/pronunciation', label: 'Речь', icon: '🎙', end: false },
  { to: '/conversation', label: 'Диалог', icon: '💬', end: false },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-screen-sm items-stretch justify-around">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
