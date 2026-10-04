// ============================================================================
// Тост с откатом (макет t6-3: «Тимур Ким — в архиве · Вернуть»; дальше —
// перенос урока, t5): короткое подтверждение действия и одна кнопка, которая
// его отменяет. Сам уходит через несколько секунд — полоска внизу показывает,
// сколько осталось. Стоит над нижней навигацией (shellInsets), не перекрывая её.
// ============================================================================
import { useEffect, useRef } from 'react'
import { useShellInsets } from '../lib/shellInsets'
import { IconCheck } from './icons'

export function UndoToast({
  text,
  actionLabel = 'Вернуть',
  onAction,
  onClose,
  ms = 6000,
}: {
  text: string
  actionLabel?: string
  /** Откатить действие; тост закрывается сам. Нет — кнопки нет. */
  onAction?: () => void
  onClose: () => void
  ms?: number
}) {
  const insets = useShellInsets()
  // onClose экран пересоздаёт на каждую отрисовку — в зависимостях эффекта он
  // перезапускал бы таймер после любого обновления списка
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const t = window.setTimeout(() => close.current(), ms)
    return () => window.clearTimeout(t)
  }, [ms, text])

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 pb-3"
      style={{ bottom: insets.bottom, left: insets.left }}
    >
      <div className="pointer-events-auto relative flex w-full max-w-exercise animate-pop-in items-center gap-3 overflow-hidden rounded-2xl bg-fg py-3 pl-4 pr-2 text-page shadow-card">
        <IconCheck size={18} className="flex-none" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{text}</span>
        {onAction && (
          <button
            type="button"
            onClick={() => {
              onAction()
              onClose()
            }}
            className="min-h-11 flex-none rounded-xl px-3 text-sm font-semibold text-accent-line"
          >
            {actionLabel}
          </button>
        )}
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-accent-line"
          style={{ animation: `shrink-x ${ms}ms linear forwards` }}
        />
      </div>
    </div>
  )
}
