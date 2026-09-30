import type { ReactNode } from 'react'

/** Статус карточки: обычная, предупреждение (жёлтая), ошибка (красная). */
export type CardTone = 'default' | 'warning' | 'danger'

// Фон и рамка по статусу. В тёмной теме статусная карточка — та же обычная
// поверхность (токены *-surface/*-line там равны surface и рамке карточки,
// статус говорит цветом текста); в светлой — тёплый или розовый фон с
// цветной рамкой. Цвет текста внутри задаёт экран (text-warning-soft-fg…).
//
// ⚠️ Фон и рамку статуса — только через tone, не className: два класса фона
// на одном элементе решает порядок в CSS (по алфавиту), а не порядок в
// строке. Так янтарные bg-/border- у плашек преподавателя годами не
// показывались: их перебивали bg-surface и border-tint карточки.
const TONES: Record<CardTone, string> = {
  default: 'border-tint/[0.08] bg-surface',
  warning: 'border-warning-line bg-warning-surface',
  danger: 'border-danger-line bg-danger-surface',
}

/**
 * Контейнер-карточка для группировки контента.
 * interactive — добавляет отклик на наведение/нажатие (для кликабельных карточек).
 */
export function Card({
  children,
  className = '',
  interactive = false,
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
  tone?: CardTone
}) {
  // Тема «Nocturne»: поверхность + тонкая рамка; тень — только в светлой
  // теме (shadow-card: в тёмной её цвет прозрачный).
  const base = `rounded-2xl border ${TONES[tone]} p-5 text-fg shadow-card`
  const press = interactive ? 'lift hover:border-tint/[0.14]' : ''
  return <div className={`${base} ${press} ${className}`}>{children}</div>
}
