// ============================================================================
// Границы ошибок. Главный сценарий: после деплоя (registerType 'autoUpdate')
// старая открытая вкладка на ленивом роуте не может догрузить старый чанк
// («Failed to fetch dynamically imported module») — раньше это давало белый
// экран. Теперь один раз автоматически перезагружаемся на свежую версию,
// а на прочие ошибки показываем понятный экран с кнопкой.
// ============================================================================
import { Component, type ReactNode } from 'react'
import { IconWarning } from './icons'

const RELOAD_AT = 'recall.chunk_reload_at'
// Между перезагрузками — окно: если чанк снова не грузится СРАЗУ после reload,
// значит дело не в устаревшем кэше, петлю не крутим. Но каждый НОВЫЙ сломанный
// чанк (другая мини-игра, спустя время) снова чинится перезагрузкой.
const RELOAD_COOLDOWN_MS = 12_000

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Failed to fetch/i.test(
    msg,
  )
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // Устаревший ленивый чанк после деплоя (частая причина «ошибки» в мини-играх
    // и placement на установленном PWA). Перезагружаемся на свежую версию, но не
    // чаще раза в COOLDOWN — иначе при реальной ошибке был бы вечный reload.
    if (isChunkLoadError(error)) {
      const last = Number(sessionStorage.getItem(RELOAD_AT) || 0)
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_AT, String(Date.now()))
        window.location.reload()
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--night-bg)] px-6 text-center dark:bg-slate-950">
          <IconWarning size={40} className="text-[var(--night-accent-text)]" />
          <p className="font-semibold text-[var(--night-text-70)]">
            Что-то пошло не так
          </p>
          <p className="max-w-sm text-sm text-[var(--night-text-40)]">
            Попробуй обновить страницу — обычно это помогает.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem(RELOAD_AT)
              window.location.reload()
            }}
            className="rounded-xl bg-[var(--night-accent)] px-5 py-2.5 font-semibold text-white hover:brightness-110"
          >
            Обновить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
