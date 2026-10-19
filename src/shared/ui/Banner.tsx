// ============================================================================
// Плашка (лист s3, «Карточка, статусная карточка, плашка»): на всю ширину
// экрана под шапкой, без радиуса; одна за раз; закрыть нельзя, пока причина
// не ушла. Тон warning — предупреждение (иконка-треугольник всегда: у
// «Заката» жёлтый близок к оранжевому акценту), accent — сведение (кружок
// «i»). Действие — подчёркнутая ссылка справа, высота 44.
// ============================================================================
import type { ReactNode } from 'react'
import { IconInfo, IconWarning } from './icons'

const TONES = {
  warning: 'bg-warning-soft text-warning-strong',
  accent: 'bg-accent-soft text-accent-soft-fg',
} as const

export function Banner({
  tone = 'warning',
  children,
  action,
  className = '',
}: {
  tone?: keyof typeof TONES
  children: ReactNode
  /** Одно действие справа: <AppLink> или <button> — подчёркнётся само. */
  action?: ReactNode
  className?: string
}) {
  const Icon = tone === 'warning' ? IconWarning : IconInfo
  return (
    <div
      role="status"
      className={`flex min-h-13 items-center gap-3 py-2 pl-6 pr-3 text-sm font-medium ${TONES[tone]} ${className}`}
    >
      <Icon size={20} className="flex-none" />
      <span className="min-w-0 flex-1">{children}</span>
      {action && (
        <span className="flex-none *:inline-flex *:min-h-11 *:items-center *:px-3 *:font-semibold *:underline *:underline-offset-3">
          {action}
        </span>
      )}
    </div>
  )
}
