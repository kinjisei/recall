import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { BrandLogo, BrandMark } from '../../components/Brand'

/**
 * Экран входа/регистрации Recall — тёмная версия «Nocturne».
 * Desktop (lg+): слева hero-панель с «авророй» (переливающийся фон) и 3 шагами.
 * Mobile: аврора — фон всего экрана, форма на полупрозрачной glass-панели.
 * Токены --night-* и keyframes — в index.css (см. index.css.additions.css).
 */

const inputClass =
  'h-11 w-full rounded-xl border-none bg-[var(--night-input)] px-4 text-sm text-[var(--night-text)] placeholder:text-[var(--night-text-25)] outline-none focus:ring-2 focus:ring-[var(--night-accent-45)]'

export function LoginPage() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const signup = mode === 'signup'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (signup) {
        const displayName = `${firstName} ${lastName}`.trim()
        const { error } = await signUp(email, password, displayName)
        if (error) setError(error)
        else
          setInfo(
            'Аккаунт создан. Если включено подтверждение почты — проверь email, иначе просто войди.',
          )
      } else {
        const { error } = await signIn(email, password)
        if (error) setError(error)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh w-full bg-[var(--night-bg)] p-2 font-[family-name:var(--night-font)] text-[var(--night-text)] selection:bg-[var(--night-accent-45)] lg:h-dvh lg:gap-4 lg:overflow-hidden lg:p-4">
      {/* Аврора как фон всего экрана — только на мобильных */}
      <div className="fixed inset-0 lg:hidden" aria-hidden="true">
        <AuroraBg />
      </div>

      {/* ===== Левая колонка: hero + аврора (только lg+) ===== */}
      <div className="relative hidden h-full w-[52%] flex-col items-center justify-end overflow-hidden rounded-3xl px-12 pb-24 shadow-2xl lg:flex">
        <AuroraBg />
        <div className="relative z-10 flex w-full max-w-[340px] animate-fade-in flex-col gap-8">
          <div className="flex animate-fade-up items-center justify-center [animation-delay:.2s]">
            <BrandLogo width={210} />
          </div>
          <div className="flex animate-fade-up flex-col gap-3 text-center [animation-delay:.35s]">
            <h1 className="whitespace-nowrap text-4xl font-medium tracking-tight">
              Присоединяйся к Recall
            </h1>
            <p className="px-4 text-sm leading-relaxed text-[var(--night-text-60)]">
              Три быстрых шага — и можно заниматься каждый день.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <StepItem number={1} text="Создай аккаунт" active delay=".5s" />
            <StepItem number={2} text="Выбери язык — EN или ES" delay=".65s" />
            <StepItem number={3} text="Определи свой уровень" delay=".8s" />
          </div>
        </div>
      </div>

      {/* ===== Правая колонка: форма ===== */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-2 py-8 sm:px-12 lg:overflow-hidden lg:px-16 lg:py-6 xl:px-24">
        <div className="flex w-full max-w-xl animate-fade-in flex-col gap-7 rounded-3xl border border-[var(--night-text-10)] bg-[var(--night-glass)] p-6 backdrop-blur-2xl lg:border-none lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          {/* Бренд над формой — только на мобильных (hero скрыт) */}
          <div className="-mb-2 flex items-center gap-2 lg:hidden">
            <BrandMark size={22} />
            <span className="text-lg font-medium tracking-tight">Recall</span>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-medium tracking-tight">
              {signup ? 'Создать новый профиль' : 'С возвращением'}
            </h2>
            <p className="text-sm text-[var(--night-text-40)]">
              {signup
                ? 'Введи основные данные, чтобы начать путь.'
                : 'Войди, чтобы продолжить занятия.'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            {signup && (
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Имя" placeholder="Аня" value={firstName} onChange={setFirstName} autoComplete="given-name" />
                <InputGroup label="Фамилия" placeholder="Иванова" value={lastName} onChange={setLastName} autoComplete="family-name" />
              </div>
            )}
            <InputGroup
              label="Email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <div className="flex flex-col gap-2">
              <label htmlFor="f-password" className="text-sm font-medium">
                Пароль
              </label>
              <div className="relative">
                <input
                  id="f-password"
                  className={`${inputClass} pr-12`}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  aria-label={showPw ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--night-text-40)] hover:text-[var(--night-text)]"
                >
                  <EyeIcon off={showPw} />
                </button>
              </div>
              {signup && (
                <p className="text-xs text-[var(--night-text-40)]">Минимум 6 символов.</p>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            {info && <p className="text-sm text-emerald-400">{info}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 h-14 w-full rounded-xl bg-[var(--night-text)] font-semibold text-[var(--night-bg)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? '…' : signup ? 'Создать аккаунт' : 'Войти'}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--night-text-40)]">
            {signup ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(signup ? 'signin' : 'signup')
                setError(null)
                setInfo(null)
              }}
              className="font-medium text-[var(--night-accent-text)] hover:underline"
            >
              {signup ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}

/* ===== Переиспользуемые компоненты ===== */

/** Переливающийся фон: глубокий индиго-градиент + 3 дрейфующих blur-пятна + блик. */
function AuroraBg() {
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

function StepItem({
  number,
  text,
  active = false,
  delay = '0s',
}: {
  number: number
  text: string
  active?: boolean
  delay?: string
}) {
  return (
    <div
      style={{ animationDelay: delay }}
      className={`flex animate-fade-up items-center gap-3.5 rounded-2xl px-4.5 py-3.5 ${
        active
          ? 'border border-[var(--night-accent-30)] bg-[var(--night-text)] text-[var(--night-bg)]'
          : 'bg-[var(--night-step)] text-[var(--night-text-70)] backdrop-blur-sm'
      }`}
    >
      <span
        className={`flex h-6.5 w-6.5 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${
          active
            ? 'bg-[var(--night-accent)] text-white'
            : 'bg-[var(--night-text-10)] text-[var(--night-text-40)]'
        }`}
      >
        {number}
      </span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}

function InputGroup({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required = false,
}: {
  label: string
  placeholder: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
}) {
  const fieldId = 'f-' + label.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  )
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 10 8 10 8a17.6 17.6 0 0 1-3.2 4.3M6.1 6.1A17.4 17.4 0 0 0 2 12s3 8 10 8a10.6 10.6 0 0 0 5.9-1.9" />
      ) : (
        <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      )}
    </svg>
  )
}
