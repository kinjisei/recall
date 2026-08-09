// ============================================================================
// Каркас приложения в теме «Nocturne»: шапка (бренд, EN/ES, аватар → прогресс)
// и плавающая нижняя навигация. Контент — Outlet.
// ============================================================================
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { IconChart, IconTeacher, IconGear, IconSignOut, IconCards, IconBadgeCheck } from './icons'
import { getProfile } from '../lib/profile'
import { getMyPlan } from '../lib/billing'
import { BottomNav } from './BottomNav'
import { BrandLogo } from './Brand'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import type { AppLang } from '../types'
import { AppLink } from './AppLink'

const langTabs: { id: AppLang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
]

/**
 * Кружок с инициалом → меню: прогресс, ученики (у преподавателя), выход.
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

  // при открытии меню перепроверяем план: если запрос при старте не прошёл
  // (сеть моргнула), «Админка» иначе не появится до перезагрузки
  useEffect(() => {
    if (!open || isAdmin) return
    getMyPlan().then((p) => setIsAdmin(!!p?.is_admin))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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
          <AppLink to="/progress" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <IconChart size={17} /> Мой прогресс
          </AppLink>
          {/* не-преподавателю показываем вход в режим: до A1 попасть в студию
              самостоятельно было нельзя вообще, роль выдавалась вручную SQL-ом */}
          <AppLink to="/teacher" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            {/* Экран /teacher зовётся «Преподаватель» и в заголовке, и на
                Главной: раньше меню обещало «Мои ученики», а открывался экран
                с другим названием и четырьмя вкладками (ревью 1Г). Для НЕ
                преподавателя это по-прежнему приглашение, а не название. */}
            <IconTeacher size={17} /> {isTeacher ? 'Преподаватель' : 'Я веду учеников'}
          </AppLink>
          <AppLink to="/pricing" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <IconCards size={17} /> Тарифы
          </AppLink>
          <AppLink to="/settings" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
            <IconGear size={17} /> Настройки
          </AppLink>
          {isAdmin && (
            <AppLink to="/admin" role="menuitem" className={itemCls} onClick={() => setOpen(false)}>
              <IconBadgeCheck size={17} /> Админка
            </AppLink>
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
    // vt-topbar — шапка не участвует в переходе между экранами и стоит
    // неподвижно, пока содержимое под ней меняется (см. index.css)
    <header className="vt-topbar sticky top-0 z-20 border-b border-white/[0.06] bg-[rgba(22,24,38,.82)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
        {/* полный логотип из макета (слово на флеш-карточке) вместо знака+текста */}
        <AppLink to="/" className="flex min-h-[44px] items-center" aria-label="На главную">
          <BrandLogo width={96} />
        </AppLink>

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

// ---------------------------------------------------------------------------
// Режим раунда: на время мини-игры шапка и нижняя навигация убираются.
//
// Зачем: шапка (79px) + отступ сверху (20px) + отступ снизу под плавающую
// навигацию (88px) съедали 187px ещё до содержимого. Играм оставалось 450-670px,
// и они не влезали — но всего на 11-38px (замер scripts/measure-scroll.mjs на
// экранах 640-844). Это худший случай: прокрутка есть, но короткая, поэтому на
// каждом тапе экран подпрыгивал. Правим не отступы (любое слово подлиннее — и
// снова вылезет), а убираем лишнее на время раунда: выход всё равно есть
// кнопкой «назад» внутри самой игры.
// ---------------------------------------------------------------------------
const FocusCtx = createContext<(on: boolean) => void>(() => {})

/** Включает режим раунда на время жизни компонента. */
export function useFocusMode(on = true): void {
  const set = useContext(FocusCtx)
  useEffect(() => {
    set(on)
    return () => set(false)
  }, [on, set])
}

export function Layout() {
  const [focus, setFocus] = useState(false)
  return (
    <FocusCtx.Provider value={setFocus}>
    <div className="min-h-[100dvh] bg-[var(--night-bg)] text-[var(--night-text)]">
      {!focus && <TopBar />}
      {/* pb — ровно под плавающую навигацию: её высота (~69px) + отступ снизу
          (16px) + safe-area. Больше — и внизу зияет пустота.
          В режиме раунда навигации нет — хватает safe-area. */}
      <main
        className={`mx-auto min-h-[60vh] max-w-screen-sm animate-fade-in px-4 pt-5 ${
          focus
            ? 'pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.75rem)]'
            : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
        }`}
      >
        <Outlet />
      </main>
      {!focus && <BottomNav />}
    </div>
    </FocusCtx.Provider>
  )
}
