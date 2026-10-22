// ============================================================================
// Подтверждение необратимого действия — диалог по центру, а не панель
// (d0, правило 8; лист s3: «необратимое ещё и подтверждается»): отмена серии
// уроков, удаление. Затемнение, заголовок, что пропадёт, и две кнопки:
// «Отмена» и само действие (опасное — сплошной красный, как в t5-2). Фокус —
// на «Отмене»: Enter по привычке не должен удалять. Escape и клик по
// затемнению — отмена (Escape не доходит до шторки под диалогом). Появляется из центра (scale .96 → 1, как меню s4),
// при «уменьшить движение» — только прозрачность.
//
// Он же — вместо window.confirm / window.prompt во всём приложении (Ф2.17-4б-3;
// их не пропускает линтер, правило no-alert): системное окно браузера не
// знает темы, у PWA выглядит чужим, а prompt путал «Отмену» с пустым ответом.
// Поле (`field`) — для короткого текста к действию: фокус в поле, Enter —
// действие; ответ — ask(): текст или null, если отказались. Поле пароля —
// `type: 'password'`. `check` — проверка до закрытия («Удалить аккаунт»:
// пароль и само удаление): пока идёт — кнопка с загрузкой, отменить нельзя;
// вернула текст — окно остаётся, текст под полем; null — закрываемся с «да».
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
import { TextField } from './TextField'

export interface ConfirmOptions {
  title: string
  /** Что пропадёт или случится — одна-две фразы. */
  body?: ReactNode
  /** Подпись действия: «Удалить», «Отменить уроки». */
  action: string
  /** Подпись отказа; «Оставить» — когда сам вопрос задан на «Отмену» формы. */
  cancel?: string
  /** Действие что-то уничтожает — сплошной красный. */
  danger?: boolean
  /** Проверка перед «да»: текст ошибки — окно остаётся и показывает его; null — готово. */
  check?: (text: string) => Promise<string | null>
}

/** Поле под текстом диалога: подпись над ним всегда, подсказка — в плейсхолдере. */
export interface ConfirmField {
  label: string
  placeholder?: string
  maxLength?: number
  type?: 'text' | 'password'
  autoComplete?: string
}

export function ConfirmDialog({
  title,
  body,
  action,
  cancel = 'Отмена',
  danger = true,
  field,
  check,
  onAnswer,
}: ConfirmOptions & { field?: ConfirmField; onAnswer: (ok: boolean, text: string) => void }) {
  const id = useId()
  const answer = useRef(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // пока идёт проверка, отказаться нельзя: удаление уже в пути
  const busyRef = useRef(false)
  // ответ читается по концу ухода — из ref, а не из замыкания с прошлым текстом
  const typed = useRef('')
  const { leaving, leave } = useLeave(() => onAnswer(answer.current, typed.current.trim()), LEAVE_MS.menu)
  const reply = useCallback(
    (ok: boolean) => {
      if (busyRef.current) return
      answer.current = ok
      leave()
    },
    [leave],
  )
  const submit = async () => {
    if (!check) return reply(true)
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    const problem = await check(typed.current).catch((e: unknown) => (e instanceof Error ? e.message : 'Не получилось — попробуй ещё раз.'))
    busyRef.current = false
    setBusy(false)
    if (problem) setError(problem)
    else reply(true)
  }
  const cancelRef = useRef<HTMLButtonElement>(null)
  const withField = !!field
  useEffect(() => {
    // с полем фокус — в поле (autoFocus), иначе — на «Отмене»
    if (!withField) cancelRef.current?.focus()
    // Escape — только диалогу: ловим первыми (capture) и дальше не пускаем,
    // иначе тот же Escape закрыл бы и шторку под диалогом (отмена серии)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      reply(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [reply, withField])

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onClick={() => reply(false)}>
      <div aria-hidden className={`${leaving ? 'animate-scrim-out' : 'animate-scrim-in'} absolute inset-0 bg-scrim/(--scrim-sheet)`} />
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={body ? `${id}-b` : undefined}
        className={`${leaving ? 'animate-menu-out' : 'animate-menu-in'} relative w-full max-w-100 rounded-card bg-surface p-6 shadow-raised`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          // портал: в дереве React submit всплыл бы к форме экрана под диалогом
          e.preventDefault()
          e.stopPropagation()
          void submit()
        }}
      >
        <h2 id={`${id}-t`} className="text-xl font-semibold text-fg">
          {title}
        </h2>
        {body && (
          <div id={`${id}-b`} className="mt-2 text-body text-fg-secondary">
            {body}
          </div>
        )}
        {field && (
          <TextField
            autoFocus
            label={field.label}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            type={field.type ?? 'text'}
            autoComplete={field.autoComplete}
            value={text}
            error={error ?? undefined}
            showError
            onChange={(e) => {
              setText(e.target.value)
              typed.current = e.target.value
              setError(null)
            }}
            className="mt-4"
          />
        )}
        {error && !field && (
          <p role="alert" className="mt-3 text-sm text-danger-strong">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} type="button" variant="secondary" disabled={busy} onClick={() => reply(false)}>
            {cancel}
          </Button>
          <Button type="submit" loading={busy} variant={danger ? 'danger-solid' : 'primary'}>
            {action}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

type Ask = ConfirmOptions & { field?: ConfirmField; resolve: (ok: boolean, text: string) => void }

/**
 * Спросить и дождаться ответа; `dialog` — отрисовать на экране.
 * confirm — да или нет; ask — с полем: текст (может быть пустым) или null, если отказались.
 */
export function useConfirm(): {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  ask: (o: ConfirmOptions & { field: ConfirmField }) => Promise<string | null>
  dialog: ReactNode
} {
  const [q, setQ] = useState<Ask | null>(null)
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setQ({ ...o, resolve: (ok) => resolve(ok) })), [])
  const ask = useCallback(
    (o: ConfirmOptions & { field: ConfirmField }) => new Promise<string | null>((resolve) => setQ({ ...o, resolve: (ok, text) => resolve(ok ? text : null) })),
    [],
  )
  const dialog = q ? (
    <ConfirmDialog
      {...q}
      onAnswer={(ok, text) => {
        q.resolve(ok, text)
        setQ(null)
      }}
    />
  ) : null
  return { confirm, ask, dialog }
}
