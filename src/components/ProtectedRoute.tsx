import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isOnboarded, shouldOnboard } from '../lib/onboarding'
import { isBlocked } from '../lib/access'
import { hasPendingTeacherRole, clearPendingRole } from '../lib/pendingRole'
import { becomeTeacher } from '../lib/teacher'
import { BlockedScreen } from './BlockedScreen'
import { Loading } from './Loading'

/**
 * Пускает дальше только авторизованных; иначе — на страницу входа.
 * Заблокированному аккаунту вместо приложения показывает BlockedScreen.
 * Нового пользователя (онбординг не пройден и активности ещё нет) один раз
 * отправляет на /onboarding — существующих не трогает.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname, search } = useLocation()
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

  // Пришёл по ссылке для преподавателей (/login?role=teacher) — включаем режим
  // сам, как только он вошёл. Метка переживает поход в почту (localStorage),
  // потому что подтверждение открывает страницу заново.
  // Ошибку глотаем намеренно: не пустить человека в приложение из-за того, что
  // не включился режим, — хуже, чем один раз нажать переключатель вручную.
  useEffect(() => {
    if (!user || !hasPendingTeacherRole()) return
    let alive = true
    becomeTeacher()
      .then(() => alive && clearPendingRole())
      .catch(() => alive && clearPendingRole())
  }, [user?.id])

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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--night-bg)]">
        <Loading label="Проверяем вход" />
      </div>
    )
  }

  // Куда человек шёл, туда и вернём после входа. Раньше ссылка, открытая без
  // входа (например, «прочитай вот этот текст» от преподавателя), после логина
  // забывалась — человек оказывался на Главной и искал заново (ревью 1Г).
  if (!user) {
    return <Navigate to="/login" replace state={{ from: pathname + search }} />
  }

  if (blocked) return <BlockedScreen />

  // Флаг читаем синхронно при каждом рендере: сразу после завершения
  // онбординга состояние ещё «нужен», и редирект возвращал на первый шаг.
  // /placement исключён наравне с /onboarding: онбординг (шаг «уровень») сам
  // уводит новичка на тест, а гвард бэунсил его обратно, не дав пройти —
  // тест уровня становился недостижим для нового пользователя. По окончании
  // теста PlacementTest ставит markOnboarded, поэтому цикла нет.
  const onboarded = isOnboarded()
  const exempt = pathname === '/onboarding' || pathname === '/placement'
  if (!onboarded && needsOnboarding && !exempt) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
