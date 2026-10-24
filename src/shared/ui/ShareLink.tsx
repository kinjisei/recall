// ============================================================================
// Кнопка «WhatsApp» / «Telegram» с готовым текстом (журнал п.23: сообщение
// уходит со своего номера человека по его нажатию). Одна на приложение:
// приглашение ученика (Ф2.5) и общий код (Ф2.11б-2), «Пригласи коллегу»
// (Ф2.3), «Сообщи ученику» и «Напомнить» в расписании (Ф2.7) — до неё у
// каждого экрана был свой класс кнопки, и они уже разошлись по отступам и
// жирности. Ссылку собирает shared/lib/share.
//
// Значок не сжимается (flex-none у любого svg внутри): в строке из трёх
// кнопок на 390 px значок WhatsApp сплющивался до точки, подпись забирала
// место (приёмка Ф2.11, снимок 07). Строка кнопок — контейнер (SHARE_ROW):
// уже 19rem (телефон 360 px в карточке) значок встаёт над подписью, как в
// блоке связи ContactLinks, — подпись не обрезается и не вылезает за кнопку.
// ============================================================================
import { IconDialog, IconSend } from './icons'

/** Строка кнопок «поделиться» — от её ширины зависит, значок слева или сверху. */
export const SHARE_ROW = '@container flex gap-2'

/** Вид кнопки «поделиться» — и для соседних «Скопировать», «Ещё…». Ставится в SHARE_ROW. */
export const SHARE_BUTTON =
  'lift flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-tile bg-accent-soft px-1.5 py-1.5 text-sm font-semibold text-accent-soft-fg @min-[19rem]:flex-row [&>svg]:flex-none'

/**
 * Кнопка-контур в строку: значок цвета акцента слева, подпись, поверхность и
 * черта (`.sh13` макетов d13, d14) — «поделиться» и «напишите нам» на
 * компьютере. Ставится в обычную строку `flex gap-2`.
 */
export const SHARE_OUTLINE =
  'lift inline-flex min-h-11 items-center gap-2 rounded-control-sm bg-surface px-3.5 text-body font-medium text-fg inset-ring inset-ring-line active:bg-row-press [&>svg]:flex-none [&>svg]:text-accent-strong'

export function ShareLink({
  channel,
  href,
  onClick,
  outline = false,
}: {
  channel: 'whatsapp' | 'telegram'
  /** whatsappLink(…) или telegramLink(…). */
  href: string
  onClick?: () => void
  /** Контуром в строку (компьютер, d13) — SHARE_OUTLINE. */
  outline?: boolean
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={outline ? SHARE_OUTLINE : SHARE_BUTTON} data-share={channel} onClick={onClick}>
      {channel === 'whatsapp' ? <IconDialog size={18} aria-hidden /> : <IconSend size={18} aria-hidden />}
      {channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
    </a>
  )
}
