// ============================================================================
// Тост с откатом (лист s3; макет t6-3: «Тимур Ким — в архиве · Вернуть»;
// перенос урока, t5): короткое подтверждение действия и одна кнопка, которая
// его отменяет целиком. Над панелью вкладок (shellInsets), ~5 секунд;
// выезжает снизу и уходит вниз (s4: 200 / 160 мс, при «уменьшить движение» —
// только прозрачность). Один тост за раз: новый заменяет старый — экран
// держит один тост в состоянии.
// ============================================================================
import { useEffect, useRef } from 'react'
import { LEAVE_MS, useLeave } from '../lib/motion'
import { useShellInsets } from '../lib/shellInsets'
import { IconCheck } from './icons'

export function UndoToast({
  text,
  actionLabel = 'Вернуть',
  onAction,
  onClose,
  ms = 5000,
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
  const { leaving, leave } = useLeave(() => close.current(), LEAVE_MS.toast)
  useEffect(() => {
    const t = window.setTimeout(leave, ms)
    return () => window.clearTimeout(t)
  }, [ms, text, leave])

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 pb-3"
      style={{ bottom: insets.bottom, left: insets.left }}
    >
      <ToastView
        text={text}
        actionLabel={actionLabel}
        leaving={leaving}
        className="pointer-events-auto max-w-exercise"
        onAction={
          onAction &&
          (() => {
            onAction()
            leave()
          })
        }
      />
    </div>
  )
}

/** Сама плашка тоста — и неподвижно на витрине /dev/ui. */
export function ToastView({
  text,
  actionLabel = 'Вернуть',
  onAction,
  leaving = false,
  className = '',
}: {
  text: string
  actionLabel?: string
  onAction?: () => void
  leaving?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex h-14 w-full items-center gap-2.5 rounded-control bg-toast pl-4 pr-1.5 text-body font-medium text-toast-fg shadow-raised ${
        leaving ? 'animate-toast-out' : 'animate-toast-in'
      } ${className}`}
    >
      <IconCheck size={20} className="flex-none" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="min-h-11 flex-none rounded-xl px-3.5 font-semibold text-toast-action active:bg-ghost-press"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
