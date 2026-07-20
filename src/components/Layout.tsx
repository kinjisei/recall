// ============================================================================
// Каркас приложения в теме «Nocturne»: шапка (бренд, EN/ES, аватар → прогресс)
// и плавающая нижняя навигация. Контент — Outlet.
// ============================================================================
import { Link, Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { BrandMark } from './Brand'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import type { AppLang } from '../types'

const langTabs: { id: AppLang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
]

/** Кружок с инициалом — вход на экран прогресса. */
function Avatar() {
  const { user } = useAuth()
  const name = (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? '?'
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <Link
      to="/progress"
      aria-label="Мой прогресс"
      className="lift flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[var(--night-surface)] text-sm font-medium text-[var(--night-accent-100)]"
    >
      {initial}
    </Link>
  )
}

function TopBar() {
  const { lang, setLang } = useLanguage()
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[rgba(22,24,38,.82)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark size={26} />
          <span className="text-lg font-medium tracking-tight">Recall</span>
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="flex gap-0.5 rounded-full border border-white/[0.08] bg-[var(--night-surface)] p-1"
            role="group"
            aria-label="Язык изучения"
          >
            {langTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setLang(t.id)}
                aria-pressed={lang === t.id}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  lang === t.id
                    ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                    : 'text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Avatar />
        </div>
      </div>
    </header>
  )
}

export function Layout() {
  return (
    <div className="min-h-[100dvh] bg-[var(--night-bg)] text-[var(--night-text)]">
      <TopBar />
      {/* pb — место под плавающую навигацию (её высота + отступ + safe-area) */}
      <main className="mx-auto min-h-[60vh] max-w-screen-sm animate-fade-in px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
