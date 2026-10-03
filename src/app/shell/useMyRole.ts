// Роль вошедшего для каркаса: меню профиля, подарок-рефералка в шапке, вкладки
// по роли. Одно место на всех: профиль — из общего кэша (lib/profile), один
// запрос на всех, а после смены роли (invalidateProfile) роль перечитывается
// сама — каркас не пересоздаётся при переходах, и иначе показывал бы прежнюю
// роль до перезагрузки.
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getProfile, onProfileChanged } from '../../lib/profile'

/** null — ещё не знаем (грузится, сбой связи) или не вошёл. */
export function useMyRole(enabled = true): string | null {
  const { user } = useAuth()
  const id = user?.id
  // роль — вместе с тем, чья она: сменился человек — чужую не показываем
  const [state, setState] = useState<{ id: string | null; role: string | null }>({ id: null, role: null })

  useEffect(() => {
    if (!enabled || !id) return
    let alive = true
    const read = () => {
      getProfile(id).then((p) => alive && setState({ id, role: p?.role ?? null }))
    }
    read()
    const off = onProfileChanged(read)
    return () => {
      alive = false
      off()
    }
  }, [id, enabled])

  return state.id === id ? state.role : null
}
