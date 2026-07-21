// ============================================================================
// Карточка-строка — основной паттерн списков в теме «Nocturne»:
// иконка в квадрате 40px, заголовок, подпись и шеврон.
// Используется в хабе «Учёба», плане дня на Главной и других списках.
// ============================================================================
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconArrowRight, type IconLike } from './icons'

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
            ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
            : 'bg-white/[0.06] text-[var(--night-text-70)]'
        }`}
      >
        <IconCmp size={20} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className={`truncate text-[15px] font-medium ${muted ? 'line-through opacity-70' : ''}`}>
          {title}
        </span>
        {desc && (
          <span className="truncate text-[13px] text-[var(--night-text-40)]">{desc}</span>
        )}
      </span>

      {trailing ?? <IconArrowRight size={16} className="flex-none text-[var(--night-text-25)]" />}
    </>
  )

  const cls =
    `lift flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-[var(--night-text)] ` +
    `${dashed ? 'border border-dashed border-[var(--night-accent-45)] bg-transparent' : 'border border-white/[0.08] bg-[var(--night-surface)]'} ` +
    `${muted ? 'opacity-75' : ''} hover:border-white/[0.14] ${className}`

  if (to) {
    return (
      <Link to={to} className={cls} style={style}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {inner}
    </button>
  )
}
