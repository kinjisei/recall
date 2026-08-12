// ============================================================================
// «Безопасность» в Настройках: смена пароля тем, кто уже вошёл.
//
// ⚠️ Текущий пароль спрашиваем ПО-НАСТОЯЩЕМУ. Supabase его не требует: любой,
// кто на минуту сел за чужой незаблокированный компьютер, мог бы поменять
// пароль и забрать аккаунт вместе со всей учёбой. Проверка — вход тем же
// адресом и текущим паролем; не сошлось — дальше не идём.
//
// Форма раскрывается по кнопке, а не висит открытой: в настройках человек
// бывает часто, а пароль меняет раз в год.
// ============================================================================
import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Reveal } from '../../components/Reveal'
import { MIN_PASSWORD, changePassword } from '../../lib/passwordReset'
import { PasswordField } from '../auth/authUi'

export function SecuritySection() {
  const { user } = useAuth()
  const email = user?.email ?? ''

  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await changePassword(email, current, next)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    setCurrent('')
    setNext('')
    setDone(true)
    setOpen(false)
  }

  return (
    <section
      id="security"
      className="animate-fade-up rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4"
      style={{ animationDelay: '.23s' }}
    >
      <h2 className="mb-3 font-medium">Безопасность</h2>
      <p className="text-sm text-[var(--night-text-40)]">
        Вход по адресу <span className="break-all text-[var(--night-text-70)]">{email}</span>
      </p>

      {done && !open && (
        <p className="mt-3 text-sm text-emerald-400">
          Пароль изменён. Входы на других устройствах завершены.
        </p>
      )}

      {!open && (
        <button
          onClick={() => {
            setOpen(true)
            setDone(false)
            setError(null)
          }}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-white/[0.10] px-4 text-sm font-medium text-[var(--night-text-70)]"
        >
          Сменить пароль
        </button>
      )}

      <Reveal open={open}>
        <form onSubmit={submit} className="flex flex-col gap-4 pt-3">
          {/* Скрытое поле с адресом — чтобы менеджер паролей понял, к какому
              аккаунту относится новый пароль, и предложил его обновить. */}
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />

          <PasswordField
            id="pw-current"
            label="Текущий пароль"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <PasswordField
            id="pw-next"
            label="Новый пароль"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            hint={`Минимум ${MIN_PASSWORD} символов. Входы на других устройствах после смены завершатся.`}
          />

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || current.length === 0 || next.length < MIN_PASSWORD}
              className="min-h-11 flex-1 rounded-xl bg-[var(--night-accent-900)] px-4 text-sm font-medium text-[var(--night-accent-100)] disabled:opacity-40"
            >
              {busy ? '…' : 'Сохранить пароль'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setCurrent('')
                setNext('')
                setError(null)
              }}
              className="min-h-11 rounded-xl border border-white/[0.10] px-4 text-sm font-medium text-[var(--night-text-40)]"
            >
              Отмена
            </button>
          </div>
        </form>
      </Reveal>
    </section>
  )
}
