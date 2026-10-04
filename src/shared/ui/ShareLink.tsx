// ============================================================================
// Кнопка «WhatsApp» / «Telegram» с готовым текстом (журнал п.23: сообщение
// уходит со своего номера человека по его нажатию). Одна на приложение:
// приглашение ученика (Ф2.5), «Пригласи коллегу» (Ф2.3), «Сообщи ученику» в
// расписании (Ф2.7) — до неё у каждого экрана был свой класс кнопки, и они
// уже разошлись по отступам и жирности. Ссылку собирает shared/lib/share.
// ============================================================================
import { IconDialog, IconSend } from './icons'

/** Вид кнопки «поделиться» — и для соседних «Скопировать», «Ещё…». */
export const SHARE_BUTTON =
  'lift flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent-soft px-2 text-sm font-semibold text-accent-soft-fg'

export function ShareLink({
  channel,
  href,
  onClick,
}: {
  channel: 'whatsapp' | 'telegram'
  /** whatsappLink(…) или telegramLink(…). */
  href: string
  onClick?: () => void
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={SHARE_BUTTON} data-share={channel} onClick={onClick}>
      {channel === 'whatsapp' ? <IconDialog size={18} aria-hidden /> : <IconSend size={18} aria-hidden />}
      {channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
    </a>
  )
}
