// ============================================================================
// Единственное место, где живут контакты поддержки (журнал п.71).
// Раньше адрес был вписан только в юридические страницы, а из приложения
// написать было некуда: человек, у которого что-то не работает, либо уходил
// молча, либо шёл жаловаться публично. Оба исхода хуже письма владельцу.
// Кнопки — общий блок shared/ui/ContactLinks; в текстах ошибок и документах —
// только почта.
// ============================================================================
// с расширением: файл грузят и чистые тесты в node (через shared/api/errors)
import { whatsappLink } from './share.ts'

/** Уже опубликован в /terms и /privacy — отдельного адреса не заводим. */
export const SUPPORT_EMAIL = 'k.yerbolat.2004@gmail.com'

/**
 * WhatsApp владельца. Только для ссылки: текстом номер на страницах не
 * печатаем — открытые страницы читают боты и собирают номера для спама.
 */
const SUPPORT_WHATSAPP = '77762100221'

/** Telegram владельца — без «@». */
const SUPPORT_TELEGRAM = 'Yerb0lat'

/** Честное обещание по срокам. Не «24/7», а то, что реально выполнимо. */
export const SUPPORT_SLA = 'Отвечаем в течение дня'

/** Первое сообщение в WhatsApp: человеку не нужно придумывать, с чего начать. */
export const SUPPORT_HELLO = 'Здравствуйте! У меня вопрос про Recall: '

/**
 * mailto с темой и заготовкой письма: человеку не приходится объяснять,
 * из какого он приложения, а нам приходит письмо, которое видно в почте.
 */
export function supportMailto(subject = 'Recall — нужна помощь'): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

/** Чат WhatsApp с владельцем и готовым первым сообщением. */
export function supportWhatsapp(text = SUPPORT_HELLO): string {
  return whatsappLink(text, SUPPORT_WHATSAPP)
}

/** Чат Telegram с владельцем. Готовый текст в ссылку на человека не кладётся — Telegram его не подставляет. */
export function supportTelegram(): string {
  return `https://t.me/${SUPPORT_TELEGRAM}`
}
