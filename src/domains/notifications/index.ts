// Парадная дверь домена уведомлений (архитектура §2): экраны берут отсюда.
export {
  loadLessonReminders,
  loadNotifications,
  loadStudentsPush,
  markNotificationsRead,
  notificationCounts,
  setLessonReminders,
} from './api'
export {
  renderNotification,
  safeHref,
  unreadCount,
  whenLabel,
  type AppNotification,
  type NotificationView,
} from './model'
export { pushAsk, type PushAsk } from './ask'
export {
  askMemory,
  devicePush,
  disablePush,
  enablePush,
  forgetPushOnThisDevice,
  rememberPostponed,
  syncPush,
  type DevicePush,
} from './push'
