// ============================================================================
// Строка списка (лист s3, «Строка списка») — основа всех списков: иконка в
// квадрате 40 (или аватар 40) + заголовок 16 + подпись 13 + справа шеврон
// (переход) или значение (trailing; число — моноширинными цифрами). Высота
// ≥ 64; нажатая — подложка row-press на всю строку (отклик на касание, без
// «подпрыгивания»). Сама по себе — строка-карточка (радиус 20, тень только в
// светлой); flat — строка общего списка (ученики, макет t6): без своей
// подложки, внутри одной поверхности с разделителями.
// ============================================================================
import type { ReactNode } from 'react'

import { IconChevronRight, type IconLike } from './icons'
import { AppLink } from './AppLink'

export interface RowCardProps {
  /** Иконка в квадрате 40; не нужна, если есть lead. */
  Icon?: IconLike
  /** Свой левый элемент вместо иконки (аватар-инициалы). */
  lead?: ReactNode
  title: ReactNode
  desc?: ReactNode
  /** Значение справа в строке заголовка: «3 из 5» (домашка, макет u1-1). */
  value?: ReactNode
  /** Полоса прогресса под заголовком, 0–1 (домашка, макет u1-1). */
  progress?: number
  /** Ведёт по ссылке (Link) или вызывает обработчик (button). */
  to?: string
  onClick?: () => void
  /** Акцентная подложка иконки — для активных/важных строк. */
  active?: boolean
  /** Пунктирная рамка — для «предложений» вроде «Определи свой уровень». */
  dashed?: boolean
  /** Тонкая рамка без подложки — тихое предложение («Занимаешься с
   *  преподавателем?» на телефоне, макет u1-3). */
  outline?: boolean
  /** Правый слот: счётчик, галочка, бейдж. */
  trailing?: ReactNode
  /** Приглушить (например, выполненный пункт). */
  muted?: boolean
  /** Строка внутри общего списка: без своей рамки и тени. */
  flat?: boolean
  /** Выбранная строка (список рядом с подробностями, ListDetail). */
  current?: boolean
  /** Действие недоступно (без тарифа — расписание только для просмотра): видно, но не нажимается. */
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

export function RowCard({
  Icon: IconCmp,
  lead,
  title,
  desc,
  value,
  progress,
  to,
  onClick,
  active = false,
  dashed = false,
  outline = false,
  trailing,
  muted = false,
  flat = false,
  current = false,
  disabled = false,
  className = '',
  style,
}: RowCardProps) {
  const inner = (
    <>
      {lead ??
        (IconCmp && (
          <span
            className={`flex size-10 flex-none items-center justify-center rounded-xl ${
              active
                ? 'bg-accent-soft text-accent-soft-fg'
                : 'bg-tint/[0.06] text-fg-secondary'
            }`}
          >
            <IconCmp size={22} />
          </span>
        ))}

      <span className={`flex min-w-0 flex-1 flex-col text-left ${progress === undefined ? '' : 'gap-1.5'}`}>
        <span className={`flex items-baseline justify-between gap-2 text-base font-medium ${muted ? 'line-through opacity-70' : ''}`}>
          <span className="truncate">{title}</span>
          {value !== undefined && <span className="flex-none text-body font-semibold tabular-nums">{value}</span>}
        </span>
        {progress !== undefined && (
          <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-input">
            <span
              className="block h-full w-full origin-left rounded-full bg-accent transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${Math.min(Math.max(progress, 0), 1)})` }}
            />
          </span>
        )}
        {desc && (
          <span className={`truncate text-note tabular-nums ${current ? 'text-accent-soft-fg' : 'text-fg-muted'}`}>{desc}</span>
        )}
      </span>

      {trailing ?? <IconChevronRight size={20} className="flex-none text-fg-faint" />}
    </>
  )

  // тень — только у сплошной строки и только в светлой теме (shadow-card в
  // тёмной нулевая); пунктирное «предложение» лежит без подложки. Рамка
  // прозрачная у сплошной — чтобы строки с пунктиром и без стояли ровно.
  // выбранная рядом с подробностями (d3-1): заливка accent-soft и полоска акцента 3 px слева
  const look = flat
    ? `${current ? 'relative bg-accent-soft before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-accent' : 'hover:bg-row-press active:bg-row-press data-press:bg-row-press'} transition-colors duration-(--dur-1)`
    : `rounded-row border transition-colors duration-(--dur-1) ${
        dashed
          ? 'border-dashed border-accent-line bg-transparent active:bg-ghost-press'
          : outline
            ? 'border-line bg-transparent active:bg-ghost-press'
            : 'border-transparent bg-surface shadow-card hover:bg-row-press active:bg-row-press'
      }`
  const cls = `flex min-h-16 w-full items-center gap-3 py-2.5 pl-4 pr-3.5 ${current ? 'text-accent-soft-fg' : 'text-fg'} disabled:cursor-not-allowed disabled:opacity-50 ${look} ${muted ? 'opacity-75' : ''} ${className}`

  if (to) {
    return (
      <AppLink to={to} className={cls} style={style} data-row>
        {inner}
      </AppLink>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-current={current || undefined} className={cls} style={style} data-row>
      {inner}
    </button>
  )
}
