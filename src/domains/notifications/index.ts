// Парадная дверь домена уведомлений (архитектура §2): экраны берут отсюда.
export { loadNotifications, markNotificationsRead, notificationCounts } from './api'
export {
  renderNotification,
  safeHref,
  unreadCount,
  whenLabel,
  type AppNotification,
  type NotificationView,
} from './model'
