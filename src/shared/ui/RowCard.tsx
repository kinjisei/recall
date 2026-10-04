// ============================================================================
// Карточка-строка — основной паттерн списков в теме «Nocturne»:
// иконка в квадрате 40px, заголовок, подпись и шеврон.
// Используется в хабе «Учёба», плане дня на Главной и других списках.
// Строка общего списка (ученики, макет t6) — flat: без своей рамки, внутри
// одной поверхности с разделителями; вместо иконки — lead (аватар).
// ============================================================================
import type { ReactNode } from 'react'

import { IconArrowRight, type IconLike } from './icons'
import { AppLink } from './AppLink'

export interface RowCardProps {
  /** Иконка в квадрате 40; не нужна, если есть lead. */
  Icon?: IconLike
  /** Свой левый элемент вместо иконки (аватар-инициалы). */
  lead?: ReactNode
  title: ReactNode
  desc?: ReactNode
  /** Ведёт по ссылке (Link) или вызывает обработчик (button). */
  to?: string
  onClick?: () => void
  /** Акцентная подложка иконки — для активных/важных строк. */
  active?: boolean
  /** Пунктирная рамка — для «предложений» вроде «Определи свой уровень». */
  dashed?: boolean
  /** Правый слот: счётчик, галочка, бейдж. */
  trailing?: ReactNode
  /** Приглушить (например, выполненный пункт). */
  muted?: boolean
  /** Строка внутри общего списка: без своей рамки и тени. */
  flat?: boolean
  /** Выбранная строка (список рядом с подробностями, ListDetail). */
  current?: boolean
  className?: string
  style?: React.CSSProperties
}

export function RowCard({
  Icon: IconCmp,
  lead,
  title,
  desc,
  to,
  onClick,
  active = false,
  dashed = false,
  trailing,
  muted = false,
  flat = false,
  current = false,
  className = '',
  style,
}: RowCardProps) {
  const inner = (
    <>
      {lead ??
        (IconCmp && (
          <span
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
              active
                ? 'bg-accent-soft text-accent-soft-fg'
                : 'bg-tint/[0.06] text-fg-secondary'
            }`}
          >
            <IconCmp size={20} />
          </span>
        ))}

      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className={`truncate text-body font-medium ${muted ? 'line-through opacity-70' : ''}`}>
          {title}
        </span>
        {desc && (
          <span className="truncate text-note text-fg-muted">{desc}</span>
        )}
      </span>

      {trailing ?? <IconArrowRight size={16} className="flex-none text-fg-faint" />}
    </>
  )

  // тень — только у сплошной строки и только в светлой теме (shadow-card в
  // тёмной прозрачная); пунктирное «предложение» лежит без подложки
  const look = flat
    ? `${current ? 'bg-accent-soft/60' : 'hover:bg-tint/[0.04]'} transition-colors`
    : `lift rounded-2xl ${dashed ? 'border border-dashed border-accent-line bg-transparent' : 'border border-tint/[0.08] bg-surface shadow-card'} hover:border-tint/[0.14]`
  const cls = `flex w-full items-center gap-3.5 px-4 py-3.5 text-fg ${look} ${muted ? 'opacity-75' : ''} ${className}`

  if (to) {
    return (
      <AppLink to={to} className={cls} style={style}>
        {inner}
      </AppLink>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-current={current || undefined} className={cls} style={style}>
      {inner}
    </button>
  )
}
