// ============================================================================
// Push в service worker'е Recall (PLAN.md Ф2.9; макет u3-1). Подключается в
// sw.js сборки через workbox importScripts (vite.config.ts) — с отпечатком
// содержимого в адресе: правка этого файла даёт новый sw.js, и телефоны
// получают её с обновлением приложения.
//
//   push              — показать уведомление. Показываем ВСЕГДА: iPhone
//                       отзывает подписку у приложения, которое получает push
//                       молча. Одно на урок: tag заменяет прежнее о том же.
//   notificationclick — открыть экран из уведомления. Приложение уже открыто —
//                       перейти в нём без перезагрузки (набранный текст цел),
//                       иначе — открыть. Только адреса внутри Recall.
// ============================================================================
self.addEventListener('push', (event) => {
  let d
  try {
    d = (event.data && event.data.json()) || {}
  } catch {
    d = {}
  }
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '')
  event.waitUntil(
    self.registration.showNotification(text(d.title) || 'Recall', {
      body: text(d.body),
      tag: text(d.tag) || undefined,
      icon: '/pwa-192x192.png',
      badge: '/badge-96.png',
      lang: 'ru',
      data: { href: text(d.href) },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data && event.notification.data.href
  const inside = typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')
  const url = new URL(inside ? href : '/', self.location.origin)
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const win = wins.find((w) => new URL(w.url).origin === url.origin)
      if (win) {
        // приложение слушает это сообщение и переходит без перезагрузки (app/shell/usePushBridge)
        win.postMessage({ type: 'recall:open', href: url.pathname + url.search })
        await win.focus().catch(() => undefined)
        return
      }
      await self.clients.openWindow(url.href)
    })(),
  )
})
