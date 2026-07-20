import { useAuth } from '../context/AuthContext'
import { BrandMark } from './Brand'

/**
 * Экран для заблокированного аккаунта: показывается вместо всего приложения,
 * когда в profiles.blocked стоит true. Выхода отсюда нет, кроме «Выйти».
 */
export function BlockedScreen() {
  const { signOut } = useAuth()

  return (
    <main className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-[var(--night-bg)] px-6 text-center font-[family-name:var(--night-font)] text-[var(--night-text)]">
      <div className="flex items-center gap-2 opacity-60">
        <BrandMark size={22} />
        <span className="text-lg font-medium tracking-tight">Recall</span>
      </div>

      <div className="flex max-w-sm flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">Доступ приостановлен</h1>
        <p className="text-sm leading-relaxed text-[var(--night-text-60)]">
          Этот аккаунт временно закрыт. Если это ошибка — напиши владельцу приложения,
          он вернёт доступ.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="h-12 rounded-xl bg-[var(--night-text)] px-8 font-semibold text-[var(--night-bg)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
      >
        Выйти
      </button>
    </main>
  )
}
