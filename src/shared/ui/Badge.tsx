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

export type BadgeTone = 'accent' | 'success' | 'neutral' | 'outline'

const TONES: Record<BadgeTone, string> = {
  accent: 'bg-accent-soft text-accent-soft-fg',
  success: 'bg-success-soft text-success-strong',
  neutral: 'bg-input text-fg-secondary',
  outline: 'ring-1 ring-inset ring-control-line text-fg-muted',
}

export function Badge({
  tone = 'neutral',
  Icon,
  dot = false,
  children,
  className = '',
}: {
  tone?: BadgeTone
  /** Значок слева, 14 px. */
  Icon?: IconLike
  /** Точка цветом текста вместо значка («занимается»). */
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex h-7 flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-note font-medium ${TONES[tone]} ${className}`}
    >
      {dot && <span aria-hidden className="size-2 rounded-full bg-current" />}
      {Icon && <Icon size={14} />}
      {children}
    </span>
  )
}
