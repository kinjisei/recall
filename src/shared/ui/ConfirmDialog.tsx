// ============================================================================
// Подтверждение необратимого действия — диалог по центру, а не панель
// (d0, правило 8; лист s3: «необратимое ещё и подтверждается»): отмена урока,
// удаление. Затемнение, заголовок, что случится, и две кнопки: «Отмена» и
// само действие (опасное — сплошной красный, как в t5-2). Фокус — на
// «Отмене»: Enter по привычке не должен удалять. Escape и клик по
// затемнению — отмена. Появляется из центра (scale .96 → 1, как меню s4),
// при «уменьшить движение» — только прозрачность.
//
// Экрану удобнее спросить и дождаться ответа, как с window.confirm:
//   const { confirm, dialog } = useConfirm()
//   if (!(await confirm({ title: 'Удалить материал?', action: 'Удалить' }))) return
//   … return <>{…}{dialog}</>
// ============================================================================
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LEAVE_MS, useLeave } from '../lib/motion'
import { Button } from './Button'

export interface ConfirmOptions {
  title: string
  /** Что случится — одна-две фразы. */
  body?: ReactNode
  /** Подпись действия: «Удалить», «Отменить урок». */
  action: string
  /** Подпись отказа. */
  cancel?: string
  /** Действие что-то уничтожает — сплошной красный. */
  danger?: boolean
}

export function ConfirmDialog({
  title,
  body,
  action,
  cancel = 'Отмена',
  danger = true,
  onAnswer,
}: ConfirmOptions & { onAnswer: (ok: boolean) => void }) {
  const id = useId()
  const answer = useRef(false)
  const { leaving, leave } = useLeave(() => onAnswer(answer.current), LEAVE_MS.menu)
  const reply = useCallback(
    (ok: boolean) => {
      answer.current = ok
      leave()
    },
    [leave],
  )
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && reply(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [reply])

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onClick={() => reply(false)}>
      <div aria-hidden className={`${leaving ? 'animate-scrim-out' : 'animate-scrim-in'} absolute inset-0 bg-scrim/(--scrim-sheet)`} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={body ? `${id}-b` : undefined}
        className={`${leaving ? 'animate-menu-out' : 'animate-menu-in'} relative w-full max-w-100 rounded-card bg-surface p-6 shadow-raised`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`} className="text-xl font-semibold text-fg">
          {title}
        </h2>
        {body && (
          <div id={`${id}-b`} className="mt-2 text-body text-fg-secondary">
            {body}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={() => reply(false)}>
            {cancel}
          </Button>
          <Button variant={danger ? 'danger-solid' : 'primary'} onClick={() => reply(true)}>
            {action}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Спросить подтверждение и дождаться ответа; `dialog` — отрисовать на экране. */
export function useConfirm(): { confirm: (o: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [ask, setAsk] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })),
    [],
  )
  const dialog = ask ? (
    <ConfirmDialog
      {...ask}
      onAnswer={(ok) => {
        ask.resolve(ok)
        setAsk(null)
      }}
    />
  ) : null
  return { confirm, dialog }
}
