// ============================================================================
// Push и каркас (PLAN.md Ф2.9):
//   • вошёл — подтвердить подписку этого устройства (syncPush): тот же адрес
//     обновляет «когда видели», другой аккаунт на этом телефоне забирает
//     подписку себе. Новую подписку сами не создаём — только по «Включить»;
//   • нажали на уведомление, а приложение уже открыто — service worker
//     присылает адрес (public/push-sw.js), переходим без перезагрузки:
//     набранный текст не пропадает. Только адреса внутри приложения.
// ============================================================================
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { syncPush } from '../../domains/notifications'

export function usePushBridge() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id

  useEffect(() => {
    if (userId) void syncPush()
  }, [userId])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: unknown; href?: unknown } | null
      if (d?.type !== 'recall:open' || typeof d.href !== 'string') return
      if (d.href.startsWith('/') && !d.href.startsWith('//') && !d.href.includes('\\')) navigate(d.href)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])
}
