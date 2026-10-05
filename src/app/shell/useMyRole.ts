// Роль вошедшего для каркаса: меню по роли, стартовый экран, проверка роли
// маршрута, меню профиля, подарок-рефералка. Одно место на всех: профиль —
// из общего кэша (lib/profile), один запрос на всех, а после смены роли
// (invalidateProfile) роль перечитывается сама — каркас не пересоздаётся при
// переходах, и иначе показывал бы прежнюю роль до перезагрузки.
//
// Пока запрос идёт, роль берётся из прошлого ответа на этом устройстве
// (getCachedRole, PLAN.md Ф2.10): иначе учитель при каждом запуске видел бы
// меню ученика, а без сети — всё время.
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getCachedRole, loadProfile, onProfileChanged } from '../../lib/profile'

/**
 * unknown — ещё не знаем (кэша нет, база не ответила);
 * known   — знаем: ответ базы или прошлый ответ на этом устройстве;
 * failed  — база не ответила (нет связи), а прошлого ответа нет.
 */
export type RoleStatus = 'unknown' | 'known' | 'failed'

export interface RoleState {
  /** null — роли нет, не знаем или не вошёл. */
  role: string | null
  status: RoleStatus
  /** Повторить запрос после сбоя. */
  retry: () => void
}

type Answer = { id: string; role: string | null; status: RoleStatus }

function fromCache(id: string): Answer {
  const role = getCachedRole(id)
  return role === undefined ? { id, role: null, status: 'unknown' } : { id, role, status: 'known' }
}

export function useRoleState(): RoleState {
  const { user } = useAuth()
  const id = user?.id ?? null
  // ответ — вместе с тем, чей он: сменился человек — чужую роль не показываем
  const [answer, setAnswer] = useState<Answer | null>(() => (id ? fromCache(id) : null))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!id) return
    let alive = true
    const read = () => {
      loadProfile(id).then(
        (p) => alive && setAnswer({ id, role: p?.role ?? null, status: 'known' }),
        // сбой связи: прошлый ответ лучше, чем никакого
        () => alive && setAnswer((a) => (a?.id === id && a.status === 'known' ? a : { id, role: null, status: 'failed' })),
      )
    }
    read()
    const off = onProfileChanged(read)
    return () => {
      alive = false
      off()
    }
  }, [id, attempt])

  const retry = useCallback(() => {
    // пока повторяем — «ещё не знаем», а не прежний «сбой»
    setAnswer((a) => (a?.status === 'failed' ? { ...a, status: 'unknown' } : a))
    setAttempt((n) => n + 1)
  }, [])
  if (!id) return { role: null, status: 'known', retry }
  const a = answer?.id === id ? answer : fromCache(id)
  return { role: a.role, status: a.status, retry }
}

/** Только роль: null — роли нет, ещё не знаем или не вошёл. */
export function useMyRole(): string | null {
  return useRoleState().role
}
