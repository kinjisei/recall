// ============================================================================
// Заголовок шторки (лист s4, «Шторка телефона»): заголовок 20 и «закрыть»
// 44 × 44 справа. Закрывает тем же уходом, что затемнение и Escape
// (useSheetClose); вне шторки — onClose экрана. id — для aria-labelledby
// шторки. В панели компьютера (макет d2-2) — строка не ниже 68 под чертой,
// поля 24 и подсказка «Esc» перед «закрыть».
//
// Слоты (4д-2: заголовок один на все шторки, своих шапок больше нет):
// `note` — строка под заголовком («Айгерим · уроки и оплаты»), `lead` —
// слева (аватар урока, «‹» к прошлому шагу), `trailing` — действие перед
// «закрыть» («Озвучить» у карточки слова).
// ============================================================================
import type { ReactNode } from 'react'
import { IconClose } from './icons'
import { IconButton } from './IconButton'
import { useSheetClose } from './sheetClose'

const PANEL =
  'group-data-panel/panel:-mt-5 group-data-panel/panel:mb-4 group-data-panel/panel:min-h-17 group-data-panel/panel:border-b group-data-panel/panel:border-line group-data-panel/panel:py-2 group-data-panel/panel:pl-6 group-data-panel/panel:pr-3'

export function SheetHeader({
  id,
  title,
  note,
  lead,
  trailing,
  onClose,
  className = '',
}: {
  id?: string
  title: ReactNode
  /** Строка под заголовком: о ком или о чём шторка. */
  note?: ReactNode
  /** Слева от заголовка: аватар, «‹» к прошлому шагу. */
  lead?: ReactNode
  /** Действие перед «закрыть»: «Озвучить». */
  trailing?: ReactNode
  /** Вне шторки (или своё действие при закрытии); в шторке — её уход. */
  onClose?: () => void
  className?: string
}) {
  const sheetClose = useSheetClose()
  const close = sheetClose ?? onClose
  return (
    <div className={`flex shrink-0 items-center gap-2 px-5 ${PANEL} ${className}`}>
      {lead}
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-xl font-semibold text-fg">
          {title}
        </h2>
        {note && <p className="text-sm text-fg-secondary">{note}</p>}
      </div>
      {trailing}
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
