// ============================================================================
// Каркас приложения в теме «Nocturne»: шапка (бренд, EN/ES, аватар → прогресс)
// и плавающая нижняя навигация. Контент — Outlet.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { IconChart, IconTeacher, IconGear, IconSignOut, IconCards, IconBadgeCheck } from './icons'
import { getProfile } from '../lib/profile'
import { getMyPlan } from '../lib/billing'
import { BottomNav } from './BottomNav'
import { BrandLogo } from './Brand'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import type { AppLang } from '../types'

const langTabs: { id: AppLang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
]

/**
 * Кружок с инициалом → меню: прогресс, ученицы (у преподавателя), выход.
 * Раньше вёл только на прогресс, а вход в режим преподавателя был лишь
 * карточкой внизу Главной — теперь всё «служебное» собрано в одном месте.
 */
function AvatarMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [isTeacher, setIsTeacher] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const name = (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? '?'
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  useEffect(() => {
    if (!user) return
    // профиль — из общего кэша (lib/profile): Главная запрашивает тот же ряд
    getProfile(user.id).then((p) => setIsTeacher(p?.role === 'teacher'))
    // пункт «Админка» — только владельцу; это лишь видимость ссылки,
    // настоящая защита в БД (is_admin проверяют сами RPC)
    getMyPlan().then((p) => setIsAdmin(!!p?.is_admin))
  }, [user])

  // закрытие по клику мимо меню и по Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemCls =
    'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--night-text-70)] hover:bg-white/[0.06] hover:text-[var(--night-text)]'

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Меню профиля"
        className="lift flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-[var(--night-surface)] text-sm font-medium text-[var(--night-accent-100)]"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl border border-white/[0.10] bg-[rgba(30,32,48,.96)] py-1 backdrop-blur-xl"
        >
          <p className="truncate px-4 pb-2 pt-1.5 text-xs text-[var(--night-text-40)]">{name}</p>
          <Link to="/progress" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <IconChart size={17} /> Мой прогресс
          </Link>
          {isTeacher && (
            <Link to="/teacher" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <IconTeacher size={17} /> Мои ученицы
            </Link>
          )}
          <Link to="/pricing" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <IconCards size={17} /> Тарифы
          </Link>
          <Link to="/settings" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <IconGear size={17} /> Настройки
          </Link>
          {isAdmin && (
            <Link to="/admin" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <IconBadgeCheck size={17} /> Админка
            </Link>
          )}
          <button role="menuitem" onClick={() => void signOut()} className={itemCls}>
            <IconSignOut size={17} /> Выйти
          </button>
        </div>
      )}
    </div>
  )
}

function TopBar() {
  const { lang, setLang } = useLanguage()
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[rgba(22,24,38,.82)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
        {/* полный логотип из макета (слово на флеш-карточке) вместо знака+текста */}
        <Link to="/" className="flex min-h-[44px] items-center" aria-label="На главную">
          <BrandLogo width={96} />
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
                className={`min-h-[44px] min-w-[48px] rounded-full px-4 text-xs font-medium transition-colors ${
                  lang === t.id
                    ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                    : 'text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <AvatarMenu />
        </div>
      </div>
    </header>
  )
}

export function Layout() {
  return (
    <div className="min-h-[100dvh] bg-[var(--night-bg)] text-[var(--night-text)]">
      <TopBar />
      {/* pb — ровно под плавающую навигацию: её высота (~69px) + отступ снизу
          (16px) + safe-area. Больше — и внизу зияет пустота. */}
      <main className="mx-auto min-h-[60vh] max-w-screen-sm animate-fade-in px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
