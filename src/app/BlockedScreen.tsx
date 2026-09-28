import { useAuth } from '../context/AuthContext'
import { BrandMark } from '../shared/ui/Brand'

/**
 * Экран для заблокированного аккаунта: показывается вместо всего приложения,
 * когда в profiles.blocked стоит true. Выхода отсюда нет, кроме «Выйти».
 */
export function BlockedScreen() {
  const { signOut } = useAuth()

  return (
    <main className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-page px-6 text-center font-sans text-fg">
      <div className="flex items-center gap-2 opacity-60">
        <BrandMark size={22} />
        <span className="text-lg font-medium tracking-tight">Recall</span>
      </div>

      <div className="flex max-w-sm flex-col gap-3">
        <h1 className="text-2xl font-medium tracking-tight">Доступ приостановлен</h1>
        <p className="text-sm leading-relaxed text-fg-tertiary">
          Этот аккаунт временно закрыт. Если это ошибка — напиши владельцу приложения,
          он вернёт доступ.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="h-12 rounded-xl bg-fg px-8 font-semibold text-page transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
      >
        Выйти
      </button>
    </main>
  )
}
