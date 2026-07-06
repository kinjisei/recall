import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { IconSparkles } from './icons'
import { useLanguage } from '../context/LanguageContext'
import type { AppLang } from '../types'

const langTabs: { id: AppLang; label: string; flag: string }[] = [
  { id: 'en', label: 'EN', flag: '🇬🇧' },
  { id: 'es', label: 'ES', flag: '🇪🇸' },
]

/** Шапка: бренд + глобальный переключатель языка изучения. */
function TopBar() {
  const { lang, setLang } = useLanguage()
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-1.5 font-bold tracking-tight">
          <IconSparkles className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          Recall
        </span>
        <div
          className="flex gap-0.5 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
          role="group"
          aria-label="Язык изучения"
        >
          {langTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setLang(t.id)}
              aria-pressed={lang === t.id}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                lang === t.id
                  ? 'bg-white text-sky-700 shadow-sm dark:bg-slate-700 dark:text-sky-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span aria-hidden="true">{t.flag}</span>
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
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar />
      <main className="mx-auto min-h-[60vh] max-w-screen-sm animate-fade-in px-4 pb-28 pt-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
