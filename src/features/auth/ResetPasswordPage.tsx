// ============================================================================
// Шаг 2 восстановления: новый пароль.
//
// Экран принимает два входа: ссылку из письма (token_hash в адресе) и код,
// набранный руками. Второй нужен не для красоты — почта часто на телефоне, а
// занимаются за компьютером, и переписать восемь цифр проще, чем пересылать
// себе письмо.
//
// ⚠️ Токен НЕ проверяется при открытии страницы — только при отправке формы.
// Ссылку открывают за человека антивирусы и превью в мессенджерах; проверка на
// входе сожгла бы одноразовый токен до того, как человек до него дошёл.
//
// ⚠️ token_hash вычищается из адреса сразу после чтения: иначе он остаётся в
// истории браузера и уезжает в заголовке Referer на любой внешней ссылке.
// ============================================================================
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppLink } from '../../components/AppLink'
import { supportMailto } from '../../lib/contacts'
import {
  MIN_PASSWORD,
  completeReset,
  forgetRecoveryToken,
  isCodeLike,
  recoveryToken,
  rememberRecoveryToken,
} from '../../lib/passwordReset'
import { AuthCard, InputGroup, PasswordField, PrimaryButton } from './authUi'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  // Токен из адреса ГЛАВНЕЕ сохранённого и используется сразу, ещё до того как
  // эффект перепишет хранилище.
  //
  // ⚠️ Иначе гонка: человек открывает вторую ссылку (первую бросил полчаса
  // назад), экран мгновенно готов к отправке — но с прежним, уже негодным
  // токеном из sessionStorage. Успел нажать раньше эффекта — получил
  // «ссылка недействительна» по свежей ссылке.
  //
  // В sessionStorage кладём в эффекте, чтобы пережить перезагрузку: из адреса
  // токен мы убираем (история браузера, заголовок Referer), и другой копии
  // после F5 не остаётся.
  const urlToken = params.get('token_hash')
  const [stored, setStored] = useState<string | null>(() => recoveryToken())
  useEffect(() => {
    if (!urlToken) return
    rememberRecoveryToken(urlToken)
    setStored(urlToken)
    const next = new URLSearchParams(params)
    next.delete('token_hash')
    next.delete('type')
    setParams(next, { replace: true })
  }, [urlToken, params, setParams])

  const token = urlToken ?? stored
  const fromLink = !!token

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  /** Токен уже принят — он одноразовый, второй раз показывать его нельзя. */
  const [verified, setVerified] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await completeReset({
      password,
      tokenHash: token ?? undefined,
      code: verified ? undefined : code,
      email: verified ? undefined : email,
      alreadyVerified: verified,
    })
    setBusy(false)
    if (res.verified) setVerified(true)
    if (res.error) {
      // ⚠️ Ссылка не подошла — забываем её и показываем поля кода. Без этого
      // экран остаётся в режиме «пришёл по ссылке» и кода ввести НЕГДЕ: человек
      // с новым письмом в руках упирается в тупик. А протухает ссылка легко —
      // полчаса на размышления или повторный запрос письма гасит прежнюю.
      if (!res.verified && token) {
        forgetRecoveryToken()
        setStored(null)
      }
      setError(res.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <AuthCard
        title="Пароль изменён"
        subtitle="Входы на других устройствах мы на всякий случай завершили — там нужно будет войти заново."
      >
        <PrimaryButton type="button" onClick={() => navigate('/')}>
          Продолжить занятия
        </PrimaryButton>
      </AuthCard>
    )
  }

  const canSubmit =
    password.length >= MIN_PASSWORD &&
    (verified || fromLink || (isCodeLike(code) && email.trim().includes('@')))

  return (
    <AuthCard
      title="Новый пароль"
      subtitle={
        fromLink
          ? 'Ссылка из письма подошла. Придумай пароль, с которым будешь входить.'
          : 'Введи адрес и код из письма, а затем новый пароль.'
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        {/* Пришёл по ссылке — адрес и код не спрашиваем: это лишние два поля
            там, где человек уже всё подтвердил. */}
        {!fromLink && !verified && (
          <>
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
            <InputGroup
              id="f-code"
              label="Код из письма"
              placeholder="12345678"
              inputMode="numeric"
              value={code}
              onChange={setCode}
              autoComplete="one-time-code"
              required
              hint="Цифры из последнего письма. Код живёт 30 минут."
            />
          </>
        )}

        <PasswordField
          id="f-new-password"
          label="Новый пароль"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          hint={`Минимум ${MIN_PASSWORD} символов.`}
        />

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <PrimaryButton disabled={busy || !canSubmit}>
          {busy ? '…' : 'Сохранить пароль и войти'}
        </PrimaryButton>
      </form>

      <div className="flex flex-col gap-2 text-center text-sm">
        <AppLink
          to="/forgot"
          className="-m-3 p-3 font-medium text-[var(--night-accent-text)] hover:underline"
        >
          Код не подошёл — прислать новое письмо
        </AppLink>
        <p className="text-xs leading-relaxed text-[var(--night-text-40)]">
          Совсем ничего не выходит?{' '}
          <a
            href={supportMailto('Recall — не удаётся сменить пароль')}
            className="underline hover:text-[var(--night-text-70)]"
          >
            Напиши нам
          </a>
        </p>
      </div>
    </AuthCard>
  )
}
