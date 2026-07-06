import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { IconSparkles } from '../../components/icons'

export function LoginPage() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error)
      } else {
        const { error } = await signUp(email, password, displayName)
        if (error) setError(error)
        else
          setInfo(
            'Аккаунт создан. Если включено подтверждение почты — проверь email, иначе просто войди.',
          )
      }
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900'

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-sky-600/30">
            <IconSparkles className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Recall
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Английский и испанский — каждый день
          </p>
        </div>

        <Card>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <input
                className={inputClass}
                type="text"
                placeholder="Имя"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            )}
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className={inputClass}
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="Пароль (минимум 6 символов)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            {info && <p className="text-sm text-emerald-600">{info}</p>}

            <Button type="submit" loading={busy} className="mt-1">
              {mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setInfo(null)
            }}
            className="mt-4 w-full text-center text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            {mode === 'signin'
              ? 'Нет аккаунта? Зарегистрироваться'
              : 'Уже есть аккаунт? Войти'}
          </button>
        </Card>
      </div>
    </div>
  )
}
