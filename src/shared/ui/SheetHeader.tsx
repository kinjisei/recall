// ============================================================================
// Заголовок шторки (лист s4, «Шторка телефона»): заголовок 20 и «закрыть»
// 44 × 44 справа. Закрывает тем же уходом, что затемнение и Escape
// (useSheetClose); вне шторки — onClose экрана. id — для aria-labelledby
// шторки. В панели компьютера (макет d2-2) — строка 68 под чертой, поля 24 и
// подсказка «Esc» перед «закрыть».
// ============================================================================
import type { ReactNode } from 'react'
import { IconClose } from './icons'
import { IconButton } from './IconButton'
import { useSheetClose } from './sheetClose'

const PANEL =
  'group-data-panel/panel:-mt-5 group-data-panel/panel:mb-4 group-data-panel/panel:h-17 group-data-panel/panel:border-b group-data-panel/panel:border-line group-data-panel/panel:pl-6 group-data-panel/panel:pr-3'

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
    <div className={`flex shrink-0 items-center gap-2 px-5 ${PANEL} ${className}`}>
      <h2 id={id} className="min-w-0 flex-1 text-xl font-semibold text-fg">
        {title}
      </h2>
      {close && (
        <>
          <kbd aria-hidden className="hidden h-5 min-w-5 items-center justify-center rounded-md bg-input px-1.25 font-sans text-caption font-semibold text-fg-muted group-data-panel/panel:inline-flex">
            Esc
          </kbd>
          <IconButton label="Закрыть" onClick={close} className="-mr-2 text-fg-muted group-data-panel/panel:mr-0">
            <IconClose size={22} />
          </IconButton>
        </>
      )}
    </div>
  )
}
