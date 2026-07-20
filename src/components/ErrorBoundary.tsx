// ============================================================================
// Границы ошибок. Главный сценарий: после деплоя (registerType 'autoUpdate')
// старая открытая вкладка на ленивом роуте не может догрузить старый чанк
// («Failed to fetch dynamically imported module») — раньше это давало белый
// экран. Теперь один раз автоматически перезагружаемся на свежую версию,
// а на прочие ошибки показываем понятный экран с кнопкой.
// ============================================================================
import { Component, type ReactNode } from 'react'

const RELOAD_FLAG = 'recall.chunk_reload'

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
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
    // устаревший чанк после деплоя — один раз перезагружаемся на новую версию
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--night-bg)] px-6 text-center dark:bg-slate-950">
          <p className="text-4xl">😕</p>
          <p className="font-semibold text-[var(--night-text-70)]">
            Что-то пошло не так
          </p>
          <p className="max-w-sm text-sm text-[var(--night-text-40)]">
            Попробуй обновить страницу — обычно это помогает.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem(RELOAD_FLAG)
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
