// ============================================================================
// Поле-кнопка: выглядит как поле ввода, а открывает выбор — календарь месяца,
// колёса времени (макет t3: «📅 пн, 19 окт» · «🕒 18:00–19:00»). Открытый выбор
// обводит поле акцентом (`open`), как в макете.
// ============================================================================
import type { ReactNode } from 'react'
import type { IconLike } from './icons'

export function FieldButton({
  Icon,
  children,
  open = false,
  onClick,
  disabled = false,
  label,
  className = '',
}: {
  Icon?: IconLike
  children: ReactNode
  /** Выбор под полем раскрыт. */
  open?: boolean
  onClick: () => void
  disabled?: boolean
  /** Что это за поле — для скринридера, перед значением (видимой подписи у поля нет). */
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      className={`flex min-h-12 min-w-0 items-center gap-2 rounded-xl bg-input px-3 text-left text-sm font-semibold text-fg transition-shadow disabled:opacity-50 ${
        open ? 'ring-2 ring-accent-line' : 'ring-1 ring-control-line'
      } ${className}`}
    >
      {Icon && <Icon size={18} className="flex-none text-fg-muted" />}
      <span className="min-w-0 flex-1 truncate">
        {label && <span className="sr-only">{label}: </span>}
        {children}
      </span>
    </button>
  )
}
