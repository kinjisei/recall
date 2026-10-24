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
//
// Вид — по месту в каркасе (макеты s4, d0): круглая кнопка в шапке телефона,
// строка «Уведомления» со счётчиком в меню 240, иконка с подписью при
// наведении в рельсе 72. Где стоит — решает каркас.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { notificationCounts } from '../../domains/notifications'
import { plural } from '../../shared/lib/plural'
import { readRaw, writeRaw } from '../../shared/lib/storage'
import { CountBadge } from '../../shared/ui/CountBadge'
import { HoverTip } from '../../shared/ui/HoverTip'
import { IconBell } from '../../shared/ui/icons'
import { NotificationFeed } from './NotificationFeed'
import { ICON_BUTTON } from '../../shared/ui/IconButton'

const REFRESH_MS = 5 * 60 * 1000

export function NotificationBell({ variant = 'icon' }: { variant?: 'icon' | 'row' | 'rail' }) {
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
  const label = unread ? `Уведомления: ${unread} ${plural(unread, 'новое', 'новых', 'новых')}` : 'Уведомления'
  return (
    <>
      {variant === 'row' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className="flex h-11 w-full items-center gap-3 rounded-control-sm px-3 text-body font-semibold text-fg-secondary transition-colors hover:text-fg"
        >
          <IconBell size={22} />
          <span className="flex-1 text-left">Уведомления</span>
          <CountBadge n={unread} inline />
        </button>
      ) : variant === 'rail' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className="group relative flex size-12 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-tint/[0.06] hover:text-fg-secondary"
        >
          <span className="relative flex">
            <IconBell size={22} />
            <CountBadge n={unread} className="-right-2.5 -top-2" />
          </span>
          <HoverTip label="Уведомления" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className={ICON_BUTTON}
        >
          <IconBell size={24} />
          <CountBadge n={unread} className="right-1.25 top-1.5" />
        </button>
      )}
      {open && (
        <NotificationFeed
          onClose={() => setOpen(false)}
          onAllRead={() => setState((s) => ({ ...s, unread: 0 }))}
        />
      )}
    </>
  )
}
