// ============================================================================
// Границы ошибок. Главный сценарий: после деплоя (registerType 'autoUpdate')
// старая открытая вкладка на ленивом роуте не может догрузить старый чанк
// («Failed to fetch dynamically imported module») — раньше это давало белый
// экран. Теперь один раз автоматически перезагружаемся на свежую версию,
// а на прочие ошибки показываем понятный экран с кнопкой.
// Без сети тот же сбой — не поломка: раздел просто ещё не скачан, и
// перезагрузка его не достанет. Говорим это прямо (PLAN.md Ф1.13).
// ============================================================================
import { Component, type ReactNode } from 'react'
import { supportMailto } from '../shared/lib/contacts'
import { IconWarning } from '../shared/ui/icons'
import { CHUNK_OFFLINE_TEXT, isChunkLoadError } from '../shared/api/connection'
import { logError } from '../lib/errorLog'

const RELOAD_AT = 'recall.chunk_reload_at'
// Между перезагрузками — окно: если чанк снова не грузится СРАЗУ после reload,
// значит дело не в устаревшем кэше, петлю не крутим. Но каждый НОВЫЙ сломанный
// чанк (другая мини-игра, спустя время) снова чинится перезагрузкой.
const RELOAD_COOLDOWN_MS = 12_000

interface State {
  hasError: boolean
  /** Раздел не скачан, а сети нет — не поломка. */
  offline: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, offline: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, offline: isChunkLoadError(error) && !navigator.onLine }
  }

  componentDidCatch(error: unknown) {
    // Сбой рендера — самый заметный для человека (белый экран вместо приложения),
    // и до сих пор он никуда не записывался: мы узнавали о нём, только если
    // пользователь напишет.
    logError('render', error)
    // Устаревший ленивый чанк после деплоя (частая причина «ошибки» в мини-играх
    // и placement на установленном PWA). Перезагружаемся на свежую версию, но не
    // чаще раза в COOLDOWN — иначе при реальной ошибке был бы вечный reload.
    if (isChunkLoadError(error) && navigator.onLine) {
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
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page px-6 text-center">
          <IconWarning size={40} className="text-accent-strong" />
          <p className="font-semibold text-fg-secondary">
            {this.state.offline ? 'Нет интернета' : 'Что-то пошло не так'}
          </p>
          <p className="max-w-sm text-sm text-fg-muted">
            {this.state.offline ? CHUNK_OFFLINE_TEXT : 'Попробуй обновить страницу — обычно это помогает.'}
          </p>
          {/* Экран поломки — самое место для контакта: если обновление не
              спасло, человеку больше некуда идти */}
          {!this.state.offline && <p className="max-w-sm text-sm text-fg-muted">
            Не помогло?{' '}
            <a
              href={supportMailto('Recall — ошибка в приложении')}
              className="text-accent-strong underline"
            >
              Напиши мне
            </a>
            , починю.
          </p>}
          {/* ⚠️ Раньше здесь была только «Обновить», а она перезагружает ТОТ ЖЕ
              адрес — то есть возвращает ровно в ту поломку, из которой человек
              пытается выбраться. Экран ошибок стоит снаружи роутера, уйти с
              него навигацией нельзя, поэтому нужен явный выход на Главную. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => {
                sessionStorage.removeItem(RELOAD_AT)
                window.location.reload()
              }}
              className="min-h-11 rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:brightness-110"
            >
              Обновить
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem(RELOAD_AT)
                window.location.assign('/')
              }}
              className="min-h-11 rounded-xl border border-tint/[0.12] px-5 py-2.5 font-medium text-fg-secondary"
            >
              На главную
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
