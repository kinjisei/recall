// ============================================================================
// Общий заголовок раскрывашки — вместо самодельных ▾/▸ по разделам
// (PLAN.md Ф2.17-3). Содержимое раскрывает Reveal; здесь — то, на что
// нажимают: стрелка-«галочка» вниз, у раскрытого — вверх (как у «Как это
// работает?», HowItWorks), поворот за 200 мс; aria-expanded у кнопки.
//   RevealHeader — строка во всю ширину: заголовок, тихая подпись (число),
//                  стрелка справа; plain — без подложки (заголовок группы);
//   RevealLink   — тихая ссылка в тексте: «Показать текст» / «Скрыть текст»;
//   DisclosureIcon — сама стрелка, где строку рисует экран.
// ============================================================================
import type { ReactNode } from 'react'
import { IconCaretDown } from './icons'

export function DisclosureIcon({ open, size = 20, className = '' }: { open: boolean; size?: number; className?: string }) {
  return (
    <IconCaretDown
      size={size}
      aria-hidden
      className={`flex-none transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''} ${className}`}
    />
  )
}

export function RevealHeader({
  open,
  onToggle,
  title,
  meta,
  trailing,
  plain = false,
  className = '',
}: {
  open: boolean
  onToggle: () => void
  title: ReactNode
  /** Тихая подпись после заголовка: «· 12 тем». */
  meta?: ReactNode
  /** Своё справа перед стрелкой: число, метка. */
  trailing?: ReactNode
  /** Без подложки — заголовок группы в списке. */
  plain?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`flex min-h-12 w-full items-center gap-3 text-left transition-colors duration-(--dur-1) ${
        plain ? 'px-1' : 'rounded-control bg-surface px-4 shadow-card active:bg-row-press'
      } ${className}`}
    >
      <span className="min-w-0 flex-1 text-body font-semibold text-fg">
        {title}
        {meta && <span className="font-normal text-fg-muted"> {meta}</span>}
      </span>
      {trailing}
      <DisclosureIcon open={open} className="text-fg-faint" />
    </button>
  )
}

export function RevealLink({
  open,
  onToggle,
  children,
  className = '',
}: {
  open: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-accent-strong hover:underline ${className}`}
    >
      {children}
      <DisclosureIcon open={open} size={16} />
    </button>
  )
}
