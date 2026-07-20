import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { shouldOnboard } from '../features/onboarding/OnboardingFlow'

/**
 * Пускает дальше только авторизованных; иначе — на страницу входа.
 * Нового пользователя (онбординг не пройден и активности ещё нет) один раз
 * отправляет на /onboarding — существующих не трогает.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  // флаг «уже прошёл» читаем синхронно: иначе после завершения онбординга
  // редирект успевал вернуть пользователя обратно на первый шаг
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(() =>
    localStorage.getItem('recall.onboarded') ? false : null,
  )

  useEffect(() => {
    if (!user) {
      setNeedsOnboarding(false)
      return
    }
    if (localStorage.getItem('recall.onboarded')) {
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

  if (loading || (user && needsOnboarding === null)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--night-bg)] text-[var(--night-text-40)]">
        Загрузка…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Флаг читаем синхронно при каждом рендере: сразу после завершения
  // онбординга состояние ещё «нужен», и редирект возвращал на первый шаг.
  const onboarded = localStorage.getItem('recall.onboarded') !== null
  if (!onboarded && needsOnboarding && pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
