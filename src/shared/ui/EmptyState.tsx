// ============================================================================
// Пустое состояние (лист s3; макет t2-4 — «Пока нет уроков»): иконка в круге
// 64, одна фраза, что здесь будет, и одно действие. Пусто — это не ошибка и
// не загрузка: экран говорит, с чего начать.
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
  /** Действие (по листу — одно), по центру; несколько — столбиком одной ширины, по самой длинной. */
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-2.5 rounded-card bg-surface px-5 py-7 text-center shadow-card ${className}`}>
      {Icon && (
        <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
          <Icon size={30} />
        </span>
      )}
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {children && <p className="max-w-sm text-body text-balance text-fg-secondary">{children}</p>}
      {/* сетка в одну колонку: кнопки тянутся до самой длинной («Новый урок» — шириной «Добавить первого ученика») */}
      {actions && <div className="mt-1.5 grid gap-2">{actions}</div>}
    </div>
  )
}
