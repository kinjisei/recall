import type { ReactNode } from 'react'

const SHOW = {
  always: 'inline-flex',
  // только с мышью или тачпадом: на телефоне клавиатуры нет
  pointer: 'hidden pointer-fine:inline-flex',
  // только в панели шторки на компьютере (SheetHeader, d2-2)
  panel: 'hidden group-data-panel/panel:inline-flex',
}

/**
 * Подсказка клавиши на кнопке: «Esc» у шторки (d2-2), «T» у «Сегодня» и «N»
 * у «Новый урок» (d1). 20 × 20, радиус mark, подложка поля; на главной кнопке
 * (`onPrimary`) — дымка цветом её текста. Для читалки не нужна: у кнопки своя
 * подпись, клавиша — подсказка для мыши.
 */
export function Kbd({
  children,
  onPrimary = false,
  show = 'always',
  className = '',
}: {
  children: ReactNode
  onPrimary?: boolean
  show?: keyof typeof SHOW
  className?: string
}) {
  return (
    <kbd
      aria-hidden
      className={`${SHOW[show]} h-5 min-w-5 flex-none items-center justify-center rounded-mark px-1.25 font-sans text-caption font-semibold ${
        onPrimary ? 'bg-primary-fg/20 text-primary-fg' : 'bg-input text-fg-muted'
      } ${className}`}
    >
      {children}
    </kbd>
  )
}
