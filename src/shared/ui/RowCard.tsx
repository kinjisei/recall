// ============================================================================
// Карточка-строка — основной паттерн списков в теме «Nocturne»:
// иконка в квадрате 40px, заголовок, подпись и шеврон.
// Используется в хабе «Учёба», плане дня на Главной и других списках.
// ============================================================================
import type { ReactNode } from 'react'

import { IconArrowRight, type IconLike } from './icons'
import { AppLink } from './AppLink'

export interface RowCardProps {
  Icon: IconLike
  title: string
  desc?: string
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
  className?: string
  style?: React.CSSProperties
}

export function RowCard({
  Icon: IconCmp,
  title,
  desc,
  to,
  onClick,
  active = false,
  dashed = false,
  trailing,
  muted = false,
  className = '',
  style,
}: RowCardProps) {
  const inner = (
    <>
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
          active
            ? 'bg-accent-soft text-accent-soft-fg'
            : 'bg-tint/[0.06] text-fg-secondary'
        }`}
      >
        <IconCmp size={20} />
      </span>

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
  const cls =
    `lift flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-fg ` +
    `${dashed ? 'border border-dashed border-accent-line bg-transparent' : 'border border-tint/[0.08] bg-surface shadow-card'} ` +
    `${muted ? 'opacity-75' : ''} hover:border-tint/[0.14] ${className}`

  if (to) {
    return (
      <AppLink to={to} className={cls} style={style}>
        {inner}
      </AppLink>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {inner}
    </button>
  )
}
