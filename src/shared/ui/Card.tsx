import type { ReactNode } from 'react'

/** Статус карточки: обычная, предупреждение (жёлтая), ошибка (красная). */
export type CardTone = 'default' | 'warning' | 'danger'

// Лист s3: карточка — surface, радиус 24, отступ 16, тень только в светлой
// (в тёмной уровни держит тон). Статусная — фон и рамка статуса (-surface и
// -line, с оттенком в обеих темах), радиус 20; внутри — иконка, текст
// -strong и одно действие (цвет текста задаёт экран). Рамка у обычной —
// прозрачная: размер тот же, что у статусной, а цвет рамки экран может
// поставить сам (border-accent-line!).
//
// ⚠️ Фон и рамку статуса — только через tone, не className: два класса фона
// на одном элементе решает порядок в CSS (по алфавиту), а не порядок в
// строке. Так янтарные bg-/border- у плашек преподавателя годами не
// показывались: их перебивали bg-surface и border-tint карточки.
const TONES: Record<CardTone, string> = {
  default: 'rounded-card border-transparent bg-surface p-4',
  warning: 'rounded-row border-warning-line bg-warning-surface px-4 py-3.5',
  danger: 'rounded-row border-danger-line bg-danger-surface px-4 py-3.5',
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
  const base = `border ${TONES[tone]} text-fg shadow-card`
  const press = interactive ? 'lift' : ''
  return <div className={`${base} ${press} ${className}`}>{children}</div>
}

/**
 * Карточка шага (`.c13` макетов d13): номер в кружке и заголовок, поля 20 / 22,
 * радиус 24 — «1 Твоя ссылка», «2 Перевод на Kaspi Gold»; без номера — просто
 * заголовок («Как это работает»).
 */
export function StepCard({ n, title, label, children }: { n?: number; title: string; label?: string; children: ReactNode }) {
  return (
    <section aria-label={label ?? title} className="flex flex-col gap-3.5 rounded-card bg-surface px-5.5 py-5 shadow-card">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold text-fg">
        {n !== undefined && (
          <span aria-hidden className="flex size-6.5 flex-none items-center justify-center rounded-full bg-accent-soft text-note font-bold text-accent-soft-fg">
            {n}
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  )
}
