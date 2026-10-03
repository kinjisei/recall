// ============================================================================
// Ожидание входа и «нет связи» вместо формы входа (PLAN.md Ф1.13).
//
// Утром после ночи без сети сохранённый вход истёк, а обновить его нечем:
// клиент Supabase ~30 с повторяет попытки. Раньше всё это время висело
// «Проверяем вход», а потом открывалась форма регистрации — человек решал,
// что его выкинуло из аккаунта. Вход при этом цел: связь вернулась — клиент
// обновляет его сам, и приложение открывается без «Повторить».
// ============================================================================
import { useEffect, useState } from 'react'
import { Loading } from '../shared/ui/Loading'
import { LoadError } from '../shared/ui/LoadError'

/** Через сколько ожидания входа подсказать, что дело, похоже, в связи. */
const SLOW_MS = 6000

/** «Проверяем вход» — а если долго, ещё и почему. */
export function CheckingLogin() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), SLOW_MS)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-page px-6 text-center">
      <Loading label="Проверяем вход" />
      {slow && (
        <p className="-mt-10 max-w-xs text-sm text-fg-muted">
          Долго — похоже, плохая связь. Ждём сеть, вход и данные на месте.
        </p>
      )}
    </div>
  )
}

/** Вход не проверить без сети: не форма входа, а честное «нет связи». */
export function OfflineGate() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-page px-6">
      <div className="w-full max-w-sm">
        <LoadError
          message="Нет связи — не получилось проверить вход. Как только появится интернет, Recall откроется сам."
          onRetry={() => window.location.reload()}
        />
      </div>
    </div>
  )
}
