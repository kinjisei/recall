// ============================================================================
// Кнопка-иконка 44 × 44 (лист s3, «Иконка 44 × 44»; шапка телефона s4):
// круг без подложки, нажатая — дымка ghost-press, выключенная — fg-faint,
// загрузка — индикатор на месте иконки. Подпись — только aria-label: у
// иконки без слова её некому прочитать вслух.
// Ссылке того же вида (колокольчик, подарок в шапке) — классы ICON_BUTTON.
// ============================================================================
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Button'

/** Вид кнопки-иконки — и для ссылки (`AppLink className={ICON_BUTTON}`). */
export const ICON_BUTTON =
  'relative inline-flex size-11 flex-none items-center justify-center rounded-full text-fg-secondary transition-colors duration-(--dur-1) ease-out ' +
  'hover:text-fg active:bg-ghost-press active:duration-(--dur-press) data-press:bg-ghost-press'

/** Выключенная: без отклика, иконка fg-faint (s3). */
const OFF = 'relative inline-flex size-11 flex-none cursor-not-allowed items-center justify-center rounded-full text-fg-faint'

export function IconButton({
  label,
  children,
  loading = false,
  className = '',
  disabled,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  /** Что делает кнопка — для чтения с экрана («Закрыть», «Ещё»). */
  label: string
  children: ReactNode
  loading?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={loading ? `${label} — загрузка` : label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`${disabled && !loading ? OFF : ICON_BUTTON} ${className}`}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}
