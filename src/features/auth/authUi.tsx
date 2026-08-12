// ============================================================================
// Общий низ экранов входа: фон-«аврора», поля, поле пароля с глазком, карточка.
//
// Экранов теперь три (вход, запрос письма, новый пароль). Разметка «авроры» —
// четыре слоя градиентов с точными процентами; скопированная во второй файл,
// она разъедется при первой же правке фона, и человек увидит два разных
// приложения по дороге к одному действию.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { BrandMark } from '../../components/Brand'
import { IconEye } from '../../components/icons'

export const inputClass =
  'h-11 w-full rounded-xl border-none bg-[var(--night-input)] px-4 text-sm text-[var(--night-text)] placeholder:text-[var(--night-text-40)] outline-none focus:ring-2 focus:ring-[var(--night-accent-45)]'

/** Переливающийся фон: глубокий индиго-градиент + 3 дрейфующих blur-пятна + блик. */
export function AuroraBg() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(130%_110%_at_25%_0%,#232449_0%,#14152a_58%,#0f1020_100%)]" />
      <div className="absolute -left-[18%] -top-[12%] aspect-square w-[75%] animate-blob-a rounded-full bg-[radial-gradient(circle,rgba(145,132,217,.5),transparent_65%)] blur-[70px]" />
      <div className="absolute -bottom-[15%] -right-[20%] aspect-square w-[70%] animate-blob-b rounded-full bg-[radial-gradient(circle,rgba(76,70,160,.65),transparent_62%)] blur-[80px]" />
      <div className="absolute left-[20%] top-[30%] aspect-square w-[55%] animate-blob-c rounded-full bg-[radial-gradient(circle,rgba(120,105,205,.35),transparent_60%)] blur-[60px]" />
      <div className="absolute -inset-[20%] animate-sheen bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(145,132,217,.08)_90deg,transparent_180deg,rgba(145,132,217,.06)_270deg,transparent_360deg)]" />
    </div>
  )
}

/**
 * Одноколоночный экран для коротких шагов входа: заголовок, пояснение, форма.
 * Hero-панель со ступеньками остаётся только на самом входе — здесь человек
 * решает одну задачу и уходит.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center bg-[var(--night-bg)] p-4 font-[family-name:var(--night-font)] text-[var(--night-text)] selection:bg-[var(--night-accent-45)]">
      <div className="fixed inset-0" aria-hidden="true">
        <AuroraBg />
      </div>
      <div className="relative z-10 flex w-full max-w-md animate-fade-in flex-col gap-7 rounded-3xl border border-[var(--night-text-10)] bg-[var(--night-glass)] p-6 backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <BrandMark size={22} />
          <span className="text-lg font-medium tracking-tight">Recall</span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
          <p className="text-sm leading-relaxed text-[var(--night-text-40)]">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  )
}

export function InputGroup({
  id,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required = false,
  inputMode,
  hint,
}: {
  /** Явный id. Без него он собирается из подписи — а у русской подписи выходит
   *  кириллический идентификатор, с которым спотыкаются инструменты проверки. */
  id?: string
  label: string
  placeholder: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
  inputMode?: 'text' | 'numeric' | 'email'
  hint?: string
}) {
  const fieldId = id ?? 'f-' + label.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={fieldId}
        className={inputClass}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {hint && <p className="text-xs text-[var(--night-text-40)]">{hint}</p>}
    </div>
  )
}

/** Поле пароля с глазком. autoComplete обязателен: от него зависит, предложит ли менеджер паролей сохранить новый. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  minLength,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  hint?: string
  minLength?: number
}) {
  const [shown, setShown] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`${inputClass} pr-12`}
          type={shown ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
        />
        <button
          type="button"
          aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
          onClick={() => setShown(!shown)}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--night-text-40)] hover:text-[var(--night-text)]"
        >
          <EyeIcon off={shown} />
        </button>
      </div>
      {hint && <p className="text-xs text-[var(--night-text-40)]">{hint}</p>}
    </div>
  )
}

/** Фирменный IconEye; в состоянии «скрыть» поверх — диагональная черта. */
export function EyeIcon({ off }: { off: boolean }) {
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <IconEye size={18} />
      {off && (
        <span className="absolute left-1/2 top-1/2 h-[1.75px] w-[20px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current" />
      )}
    </span>
  )
}

/** Главная кнопка шага — одна на все экраны входа. */
export function PrimaryButton({
  children,
  disabled,
  type = 'submit',
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="h-14 w-full rounded-xl bg-[var(--night-text)] font-semibold text-[var(--night-bg)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
    >
      {children}
    </button>
  )
}
