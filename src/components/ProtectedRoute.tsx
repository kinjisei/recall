import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isOnboarded, shouldOnboard } from '../lib/onboarding'
import { isBlocked } from '../lib/access'
import { BlockedScreen } from './BlockedScreen'

/**
 * Пускает дальше только авторизованных; иначе — на страницу входа.
 * Заблокированному аккаунту вместо приложения показывает BlockedScreen.
 * Нового пользователя (онбординг не пройден и активности ещё нет) один раз
 * отправляет на /onboarding — существующих не трогает.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const [blocked, setBlocked] = useState<boolean | null>(null)
  // флаг «уже прошёл» читаем синхронно: иначе после завершения онбординга
  // редирект успевал вернуть пользователя обратно на первый шаг
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(() =>
    isOnboarded() ? false : null,
  )

  useEffect(() => {
    if (!user) {
      setNeedsOnboarding(false)
      return
    }
    if (isOnboarded()) {
      setNeedsOnboarding(false)
      return
    }
    let alive = true
    shouldOnboard()
      .then((v) => alive && setNeedsOnboarding(v))
      .catch(() => alive && setNeedsOnboarding(false))
    return () => {
      alive = false
    }
    // pathname в зависимостях — чтобы перепроверить после перехода с /onboarding
  }, [user, pathname])

  // Флаг блокировки перечитываем только при смене пользователя: зависимость на
  // user?.id, а не на объект user, иначе рефреш токена дёргал бы запрос заново.
  useEffect(() => {
    if (!user) {
      setBlocked(false)
      return
    }
    let alive = true
    isBlocked()
      .then((v) => alive && setBlocked(v))
      .catch(() => alive && setBlocked(false))
    return () => {
      alive = false
    }
  }, [user?.id])

  if (loading || (user && (needsOnboarding === null || blocked === null))) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--night-bg)] text-[var(--night-text-40)]">
        Загрузка…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (blocked) return <BlockedScreen />

  // Флаг читаем синхронно при каждом рендере: сразу после завершения
  // онбординга состояние ещё «нужен», и редирект возвращал на первый шаг.
  const onboarded = isOnboarded()
  if (!onboarded && needsOnboarding && pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
