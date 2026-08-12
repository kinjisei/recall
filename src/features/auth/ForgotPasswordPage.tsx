// ============================================================================
// Шаг 1 восстановления: попросить письмо.
//
// ⚠️ Ответ ОДИН И ТОТ ЖЕ, есть такой адрес или нет. Иначе форма превращается в
// проверялку: перебирая адреса, посторонний узнаёт, кто у нас учится. В базе
// дети, и продаём мы репетиторам — их список клиентов не должен собираться
// чужими руками за десять минут.
// ============================================================================
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLink } from '../../components/AppLink'
import { SUPPORT_EMAIL, supportMailto } from '../../lib/contacts'
import { RESET_SENT_TEXT, requestReset } from '../../lib/passwordReset'
import { AuthCard, InputGroup, PrimaryButton } from './authUi'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Повторная отправка не чаще раза в минуту — тот же порядок, что на экране
  // подтверждения регистрации, чтобы человек не искал разницы.
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await requestReset(email)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    setSent(true)
    setLeft(60)
  }

  if (sent) {
    return (
      <AuthCard title="Проверь почту" subtitle={RESET_SENT_TEXT}>
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.10)] p-4">
            <p className="text-sm text-[var(--night-text-70)]">Письмо отправлено на адрес</p>
            <p className="mt-1 break-all font-medium">{email.trim()}</p>
            <p className="mt-3 text-sm text-[var(--night-text-70)]">
              В письме кнопка и код. Кнопка сразу откроет форму нового пароля; код пригодится,
              если почта на телефоне, а занимаешься за компьютером. И то и другое живёт 30 минут.
              Письма не видно — загляни в «Спам» и «Промоакции».
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <PrimaryButton type="button" onClick={() => navigate('/reset-password')}>
            У меня есть код — ввести
          </PrimaryButton>

          <div className="flex flex-col gap-2 text-center text-sm">
            <button
              type="button"
              disabled={busy || left > 0}
              onClick={submit}
              className="-m-3 p-3 font-medium text-[var(--night-accent-text)] hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {left > 0 ? `Отправить ещё раз через ${left} с` : 'Отправить письмо ещё раз'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false)
                setError(null)
              }}
              className="-m-3 p-3 text-[var(--night-text-40)] hover:text-[var(--night-text-70)] hover:underline"
            >
              Ошибся в адресе — изменить
            </button>
          </div>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Забыли пароль?"
      subtitle="Введи адрес, на который заведён аккаунт, — пришлём письмо со ссылкой и кодом."
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <InputGroup
          label="Email"
          placeholder="you@example.com"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <PrimaryButton disabled={busy}>{busy ? '…' : 'Прислать письмо'}</PrimaryButton>
      </form>

      <div className="flex flex-col gap-2 text-center text-sm">
        <AppLink to="/login" className="-m-3 p-3 font-medium text-[var(--night-accent-text)] hover:underline">
          Вспомнил пароль — войти
        </AppLink>
        {/* Тупик без этой строчки: доступа к почте нет, и человек просто теряет
            всю свою учёбу. Адрес — из lib/contacts, второго заводить не надо. */}
        <p className="text-xs leading-relaxed text-[var(--night-text-40)]">
          Нет доступа к почте?{' '}
          <a
            href={supportMailto('Recall — нет доступа к почте от аккаунта')}
            className="underline hover:text-[var(--night-text-70)]"
          >
            Напиши нам
          </a>{' '}
          — поможем вручную. {SUPPORT_EMAIL}
        </p>
      </div>
    </AuthCard>
  )
}
