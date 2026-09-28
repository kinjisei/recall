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
  // Тема «Nocturne»: поверхность surface + тонкая светлая рамка, без теней.
  const base =
    'rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-5 text-[var(--night-text)]'
  const press = interactive ? 'lift hover:border-white/[0.14]' : ''
  return <div className={`${base} ${press} ${className}`}>{children}</div>
}
