// ============================================================================
// Единая кнопка «Назад» (по макету «Nocturne»): компактный квадрат с тонкой
// рамкой и стрелкой-кареткой, стоит СЛЕВА от заголовка в одной строке.
// Заменяет разнобой из «← Назад» / «← Главная» / ghost-кнопок, из-за которого
// заголовки съезжали, а сама кнопка терялась.
// ============================================================================
import { CaretLeftIcon } from '@phosphor-icons/react'

export function BackButton({
  onClick,
  label = 'Назад',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/[0.12] text-[var(--night-text-70)] transition-colors hover:border-white/[0.25] hover:text-[var(--night-text)] active:scale-95"
    >
      <CaretLeftIcon size={18} />
    </button>
  )
}

/** Строка «назад + заголовок» — самый частый случай использования. */
export function BackHeader({
  onBack,
  title,
  label,
  trailing,
}: {
  onBack: () => void
  title: string
  label?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <BackButton onClick={onBack} label={label} />
      <h1 className="min-w-0 flex-1 truncate text-xl font-medium tracking-tight">{title}</h1>
      {trailing}
    </div>
  )
}
