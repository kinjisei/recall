import type { ReactNode } from 'react'

/**
 * Контейнер-карточка для группировки контента.
 * interactive — добавляет отклик на наведение/нажатие (для кликабельных карточек).
 */
export function Card({
  children,
  className = '',
  interactive = false,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
}) {
  const base =
    'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.04] dark:border-slate-700/70 dark:bg-slate-800'
  const press = interactive
    ? 'transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98]'
    : ''
  return <div className={`${base} ${press} ${className}`}>{children}</div>
}
