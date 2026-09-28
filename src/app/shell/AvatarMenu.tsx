// ============================================================================
// Кружок с инициалом → меню: прогресс, ученики (у преподавателя), выход.
// Раньше вёл только на прогресс, а вход в режим преподавателя был лишь
// карточкой внизу Главной — теперь всё «служебное» собрано в одном месте.
//
// Стоит в шапке телефона (меню раскрывается вниз) и внизу боковой панели
// компьютера (раскрывается вверх — `opensUp`).
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { IconChart, IconTeacher, IconGear, IconSignOut, IconCards, IconBadgeCheck, IconThumbsUp } from '../../shared/ui/icons'
import { FeedbackSheet } from '../../components/FeedbackSheet'
import { AppLink } from '../../shared/ui/AppLink'
import { getProfile } from '../../lib/profile'
import { getMyPlan } from '../../lib/billing'
import { useAuth } from '../../context/AuthContext'

export function AvatarMenu({ opensUp = false }: { opensUp?: boolean }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState(false)
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
    'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-fg-secondary hover:bg-tint/[0.06] hover:text-fg'

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Меню профиля"
        className="lift flex h-11 w-11 items-center justify-center rounded-full border border-tint/[0.08] bg-surface text-sm font-medium text-accent-soft-fg"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className={`animate-fade-up absolute z-30 w-56 overflow-hidden rounded-2xl border border-tint/[0.10] bg-surface/96 py-1 backdrop-blur-xl ${
            opensUp ? 'bottom-full left-0 mb-2' : 'right-0 top-11'
          }`}
        >
          <p className="truncate px-4 pb-2 pt-1.5 text-xs text-fg-muted">{name}</p>
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
          {/* Отзыв — прямо в меню: до этого сообщить нам что-либо было НЕЧЕМ,
              и человек, которому что-то мешало, просто уходил молча. */}
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setFeedback(true)
            }}
            className={itemCls}
          >
            <IconThumbsUp size={17} /> Оставить отзыв
          </button>
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
      {feedback && <FeedbackSheet where="menu" onClose={() => setFeedback(false)} />}
    </div>
  )
}
