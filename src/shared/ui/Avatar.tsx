// ============================================================================
// Аватар (лист s3, «Бейджи, счётчик, аватары»; шапка и меню s4): круг с
// инициалами из имени и фамилии на мягкой подложке. Пунктирная рамка —
// «только карточка»: ученик без приложения (макет t6-1). Группа — иконка
// вместо инициалов. Один аватар на всё приложение: меню профиля, список и
// карточка ученика, неделя расписания.
// ============================================================================
import { initials } from '../lib/initials'
import { IconUsers } from './icons'

/** Размер, px → классы (s3: 56/20, 40/15, 32/13; шапка s4 — 36/15). */
const SIZES = {
  28: 'size-7 text-caption',
  32: 'size-8 text-note',
  36: 'size-9 text-body',
  40: 'size-10 text-body',
  56: 'size-14 text-xl',
  64: 'size-16 text-xl',
} as const

export type AvatarSize = keyof typeof SIZES

export function Avatar({
  name,
  size = 40,
  cardOnly = false,
  group = false,
  className = '',
}: {
  name: string
  size?: AvatarSize
  /** Ученик без приложения — пунктирная рамка без заливки. */
  cardOnly?: boolean
  /** Группа — иконка вместо инициалов. */
  group?: boolean
  className?: string
}) {
  const look = cardOnly
    ? 'border-dashed-avatar text-fg-secondary'
    : 'bg-accent-soft text-accent-soft-fg'
  return (
    <span
      aria-hidden
      className={`inline-flex flex-none items-center justify-center rounded-full font-semibold ${SIZES[size]} ${look} ${className}`}
    >
      {group ? <IconUsers size={Math.round(size * 0.55)} /> : initials(name)}
    </span>
  )
}
