// ============================================================================
// Колокольчик уведомлений в каркасе (PLAN.md Ф1.5; архитектура §17).
//
// Колокольчик ПОЯВЛЯЕТСЯ у человека, только когда у него есть хоть одно
// уведомление (решение владельца 28.09.2026). Пока правил нет (Ф2), его не
// видит никто — «мёртвой» кнопки нет и флага помнить не нужно; пришлёт
// правило что-нибудь — появится сам. Что он есть, помним на устройстве
// (recall.notifications.present.<id>): со второго раза рисуется сразу, и
// шапка не прыгает.
//
// Цифра — непрочитанные. Открыл ленту — всё отмечается прочитанным (новые в
// этот раз ещё выделены). Счёт обновляется при возвращении в приложение и раз
// в 5 минут, пока окно видно.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { notificationCounts } from '../../domains/notifications'
import { plural } from '../../shared/lib/plural'
import { readRaw, writeRaw } from '../../shared/lib/storage'
import { CountBadge } from '../../shared/ui/CountBadge'
import { IconBell } from '../../shared/ui/icons'
import { NotificationFeed } from './NotificationFeed'

const REFRESH_MS = 5 * 60 * 1000

export function NotificationBell() {
  const { user } = useAuth()
  const key = user ? `recall.notifications.present.${user.id}` : null
  // состояние — вместе с ключом: сменился человек на устройстве — начинаем с
  // его отметки, а не с чужой
  const [state, setState] = useState({ key, present: key ? readRaw(key) === '1' : false, unread: 0 })
  const [open, setOpen] = useState(false)
  if (state.key !== key) setState({ key, present: key ? readRaw(key) === '1' : false, unread: 0 })

  // состояние — только в колбэке ответа, не в теле эффекта
  const refresh = useCallback(() => {
    if (!key) return
    notificationCounts()
      .then(({ total, unread }) => {
        writeRaw(key, total > 0 ? '1' : '0')
        setState((s) => (s.key === key ? { key, present: total > 0, unread } : s))
      })
      .catch(() => {
        // колокольчик — второстепенное: сбой сети не должен ничего ломать и
        // ничего показывать; следующее возвращение в приложение спросит снова
      })
  }, [key])

  useEffect(() => {
    if (!key) return
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(onVisible, REFRESH_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [key, refresh])

  if (!state.present) return null
  const { unread } = state
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread ? `Уведомления: ${unread} ${plural(unread, 'новое', 'новых', 'новых')}` : 'Уведомления'}
        className="lift relative flex h-11 w-11 flex-none items-center justify-center rounded-full border border-tint/[0.08] bg-surface text-fg-secondary hover:text-fg"
      >
        <IconBell size={20} />
        <CountBadge n={unread} className="-right-0.5 -top-0.5" />
      </button>
      {open && (
        <NotificationFeed
          onClose={() => setOpen(false)}
          onAllRead={() => setState((s) => ({ ...s, unread: 0 }))}
        />
      )}
    </>
  )
}
