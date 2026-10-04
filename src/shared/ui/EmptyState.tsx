// ============================================================================
// Пустое состояние: иконка, фраза, что сделать (опись интерфейса §6.1; макет
// t2-4 — «Пока нет уроков · Добавить первого ученика · Новый урок»).
// Пусто — это не ошибка и не загрузка: экран говорит, с чего начать.
// ⚠️ Сбой загрузки пустым состоянием не показывать — для него LoadError
// (PLAN.md Ф1.13: «квестов нет» вместо «нет связи» хуже любой ошибки).
// ============================================================================
import type { ReactNode } from 'react'
import type { IconLike } from './icons'

export function EmptyState({
  Icon,
  title,
  children,
  actions,
  className = '',
}: {
  Icon?: IconLike
  title: string
  /** Пояснение под заголовком. */
  children?: ReactNode
  /** Кнопки — во всю ширину, столбиком. */
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center rounded-2xl border border-tint/[0.08] bg-surface px-5 py-8 text-center shadow-card ${className}`}>
      {Icon && (
        <span aria-hidden className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-fg">
          <Icon size={24} />
        </span>
      )}
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {children && <p className="mt-1 max-w-sm text-sm text-fg-secondary">{children}</p>}
      {actions && <div className="mt-5 flex w-full max-w-sm flex-col gap-2">{actions}</div>}
    </div>
  )
}
