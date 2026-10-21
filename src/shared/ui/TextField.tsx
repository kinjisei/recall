// ============================================================================
// Поле ввода (лист s3, «Поле ввода»): подпись над полем — всегда,
// плейсхолдер её не заменяет; текст 16 px; высота 48, радиус 16; рамка
// control-line. Фокус — рамка accent и внешнее кольцо focus через 2 px.
// Ошибка — рамка danger, иконка и фраза, что сделать, — после ухода из поля,
// а не на каждой букве (и сразу, если экран попросил: `showError` после
// «Сохранить»). Для времени и чисел — inputMode="numeric" (цифровая
// клавиатура).
// Многострочному полю и выбору того же вида — классы fieldClass().
// ============================================================================
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { IconInfo } from './icons'

/** Вид поля — и для textarea, и для поля-кнопки. */
export function fieldClass(invalid = false): string {
  return (
    'w-full min-h-12 rounded-control border bg-input px-3.5 text-base text-fg placeholder:text-fg-muted transition-[border-color,box-shadow] duration-(--dur-1) ease-out ' +
    'focus-visible:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-page ' +
    'disabled:cursor-not-allowed disabled:border-line disabled:text-fg-faint ' +
    // вторая линия рамки — inset-ring: 2 px без сдвига содержимого на пиксель
    (invalid
      ? 'border-danger inset-ring-1 inset-ring-danger'
      : 'border-control-line focus:border-accent focus:inset-ring-1 focus:inset-ring-accent')
  )
}

/** Фраза под полем: подсказка или ошибка с иконкой. */
export function FieldNote({ id, error, hint }: { id: string; error?: ReactNode; hint?: ReactNode }) {
  if (error) {
    return (
      <span id={id} className="flex items-center gap-1.5 text-note font-medium text-danger-strong">
        <IconInfo size={16} className="flex-none rotate-180" />
        {error}
      </span>
    )
  }
  return hint ? (
    <span id={id} className="text-note text-fg-muted">
      {hint}
    </span>
  ) : null
}

/**
 * Подпись над выбором, который не поле ввода (полоса вариантов, число недель):
 * тот же вид, что у подписи TextField. Квест (d10-4), программа (d11-2).
 */
export function Field({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-fg-secondary">{label}</span>
      {children}
    </div>
  )
}

export function TextField({
  label,
  hint,
  error,
  showError = false,
  className = '',
  onBlur,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & {
  label: ReactNode
  /** Строка под полем: что это и где появится. */
  hint?: ReactNode
  /** Что не так и что сделать; видна после ухода из поля. */
  error?: ReactNode
  /** Показать ошибку сразу — экран попытался сохранить. */
  showError?: boolean
}) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const shown = error && (touched || showError) ? error : undefined
  const note = shown || hint ? `${id}-note` : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-fg-secondary">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={shown ? true : undefined}
        aria-describedby={note}
        className={fieldClass(!!shown)}
        onBlur={(e) => {
          setTouched(true)
          onBlur?.(e)
        }}
        {...input}
      />
      {note && <FieldNote id={note} error={shown} hint={hint} />}
    </div>
  )
}
