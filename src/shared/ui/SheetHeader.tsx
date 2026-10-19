// ============================================================================
// Заголовок шторки (лист s4, «Шторка телефона»): заголовок 20 и «закрыть»
// 44 × 44 справа. Закрывает тем же уходом, что затемнение и Escape
// (useSheetClose); вне шторки — onClose экрана. id — для aria-labelledby
// шторки.
// ============================================================================
import type { ReactNode } from 'react'
import { IconClose } from './icons'
import { IconButton } from './IconButton'
import { useSheetClose } from './sheetClose'

export function SheetHeader({
  id,
  title,
  onClose,
  className = '',
}: {
  id?: string
  title: ReactNode
  /** Вне шторки (или своё действие при закрытии); в шторке — её уход. */
  onClose?: () => void
  className?: string
}) {
  const sheetClose = useSheetClose()
  const close = sheetClose ?? onClose
  return (
    <div className={`flex items-center justify-between gap-2 px-5 ${className}`}>
      <h2 id={id} className="min-w-0 text-xl font-semibold text-fg">
        {title}
      </h2>
      {close && (
        <IconButton label="Закрыть" onClick={close} className="-mr-2 text-fg-muted">
          <IconClose size={22} />
        </IconButton>
      )}
    </div>
  )
}
