// Лента уведомлений — шторка (на компьютере — панель справа, shared/ui/Sheet).
// Показали — отметили прочитанным; выделение «новое» держится до закрытия.
import { useEffect } from 'react'
import {
  loadNotifications,
  markNotificationsRead,
  renderNotification,
  unreadCount,
  whenLabel,
  type AppNotification,
} from '../../domains/notifications'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { AppLink } from '../../shared/ui/AppLink'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { Sheet } from '../../shared/ui/Sheet'

export function NotificationFeed({ onClose, onAllRead }: { onClose: () => void; onAllRead: () => void }) {
  const { data, error, loading, reload } = useAsyncData(() => loadNotifications(), [], 'Не удалось загрузить уведомления')

  useEffect(() => {
    if (data && unreadCount(data) > 0) {
      markNotificationsRead()
        .then(onAllRead)
        .catch(() => {}) // не отметилось — отметится при следующем открытии
    }
    // onAllRead пересоздаётся у родителя на каждый рендер: отмечаем по данным
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return (
    <Sheet onClose={onClose} labelledBy="notifications-title">
      <div className="min-h-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1">
        <h2 id="notifications-title" className="text-lg font-medium">
          Уведомления
        </h2>
        <div className="mt-3">
          {loading && <RowsSkeleton count={3} height={64} />}
          {error && <LoadError message={error} onRetry={reload} />}
          {data && data.length === 0 && <p className="text-sm text-fg-muted">Пока пусто.</p>}
          {data && data.length > 0 && (
            <ul className="flex flex-col gap-2">
              {data.map((n) => (
                <FeedItem key={n.id} n={n} onOpen={onClose} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function FeedItem({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  const view = renderNotification(n)
  const fresh = !n.read_at
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-medium">{view.title}</span>
        <span className="flex-none text-caption text-fg-muted">{whenLabel(n.created_at)}</span>
      </span>
      {view.body && <span className="mt-0.5 block text-sm text-fg-secondary">{view.body}</span>}
    </>
  )
  const cls = `block rounded-2xl border px-4 py-3 text-left ${
    fresh ? 'border-accent-line bg-accent-soft/40' : 'border-tint/[0.08] bg-surface'
  }`
  return (
    <li data-notification={n.id} data-fresh={fresh || undefined}>
      {view.href ? (
        <AppLink to={view.href} onClick={onOpen} className={`${cls} lift`}>
          {body}
        </AppLink>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}
