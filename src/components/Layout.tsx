import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useLanguage } from '../context/LanguageContext'
import type { AppLang } from '../types'

const langTabs: { id: AppLang; label: string }[] = [
  { id: 'en', label: '🇬🇧 EN' },
  { id: 'es', label: '🇪🇸 ES' },
]

/** Шапка: название + глобальный переключатель языка изучения. */
function TopBar() {
  const { lang, setLang } = useLanguage()
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-2">
        <span className="font-bold">Recall</span>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          {langTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setLang(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                lang === t.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar />
      <main className="mx-auto min-h-screen max-w-screen-sm px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
