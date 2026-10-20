// ============================================================================
// Бейдж (лист s3): статус — цвет + значок + слово, никогда не один цвет.
// Высота 28, радиус полный, текст 13. Тона листа:
//   accent  — мягкая accent-soft («пробный», значок-искра);
//   success — success-soft, текст success-strong и точка («занимается»);
//   neutral — подложка input, текст fg-secondary («пауза», «в приложении»);
//   outline — без подложки, рамка control-line, текст fg-muted («архив»).
// Что значит статус для раздела — у раздела (features/students/CardBits).
// ============================================================================
import type { ReactNode } from 'react'
import type { IconLike } from './icons'

export type BadgeTone = 'accent' | 'success' | 'neutral' | 'outline' | 'warning'

const TONES: Record<BadgeTone, string> = {
  accent: 'bg-accent-soft text-accent-soft-fg',
  success: 'bg-success-soft text-success-strong',
  neutral: 'bg-input text-fg-secondary',
  outline: 'ring-1 ring-inset ring-control-line text-fg-muted',
  warning: 'bg-warning-soft text-warning-soft-fg',
}

export function Badge({
  tone = 'neutral',
  Icon,
  dot = false,
  small = false,
  children,
  className = '',
}: {
  tone?: BadgeTone
  /** Значок слева, 14 px. */
  Icon?: IconLike
  /** Точка цветом текста вместо значка («занимается»). */
  dot?: boolean
  /** Маленький — в строке списка (t6-1, d3): высота 22, текст 12. */
  small?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${small ? 'h-5.5 px-2 text-xs' : 'h-7 px-2.5 text-note'} ${TONES[tone]} ${className}`}
    >
      {dot && <span aria-hidden className="size-2 rounded-full bg-current" />}
      {Icon && <Icon size={14} />}
      {children}
    </span>
  )
}
