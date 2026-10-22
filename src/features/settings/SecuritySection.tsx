// ============================================================================
// Описание: src/features/auth/CLAUDE.md
// «Безопасность» в Настройках: смена пароля тем, кто уже вошёл.
//
// ⚠️ Текущий пароль спрашиваем ПО-НАСТОЯЩЕМУ. Supabase его не требует: любой,
// кто на минуту сел за чужой незаблокированный компьютер, мог бы поменять
// пароль и забрать аккаунт вместе со всей учёбой. Проверка — вход тем же
// адресом и текущим паролем; не сошлось — дальше не идём.
//
// Форма раскрывается по кнопке, а не висит открытой: в настройках человек
// бывает часто, а пароль меняет раз в год. Вид — карточка раздела (d14):
// «Адрес входа» и «Сменить пароль» одной строкой.
// ============================================================================
import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Reveal } from '../../shared/ui/Reveal'
import { MIN_PASSWORD, changePassword } from '../../lib/passwordReset'
import { PasswordField } from '../auth/authUi'
import { Button } from '../../shared/ui/Button'
import { SettingsCard, ValueRow } from './settingsBits'

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
    <SettingsCard id="security" title="Безопасность">
      {/* «Адрес входа» и «Сменить пароль» — одной строкой (d14) */}
      <ValueRow
        action={
          !open && (
            <Button
              variant="outline"
              onClick={() => {
                setOpen(true)
                setDone(false)
                setError(null)
              }}
            >
              Сменить пароль
            </Button>
          )
        }
      >
        <span className="flex min-w-0 flex-col leading-snug">
          <small className="text-note text-fg-muted">Адрес входа</small>
          <span className="truncate text-fg">{email}</span>
        </span>
      </ValueRow>

      {done && !open && <p className="text-sm text-success-strong">Пароль изменён. Входы на других устройствах завершены.</p>}

      <Reveal open={open}>
        <form onSubmit={submit} className="flex flex-col gap-4 pt-1">
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
            <p role="alert" className="text-sm text-danger-strong">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" variant="secondary" className="flex-1" loading={busy} disabled={current.length === 0 || next.length < MIN_PASSWORD}>
              Сохранить пароль
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false)
                setCurrent('')
                setNext('')
                setError(null)
              }}
            >
              Отмена
            </Button>
          </div>
        </form>
      </Reveal>
    </SettingsCard>
  )
}
