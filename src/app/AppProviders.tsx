// ============================================================================
// Провайдеры приложения — в одном месте и в одном порядке.
//
// ErrorBoundary снаружи всего: сбой в любом провайдере тоже должен показать
// экран «что-то пошло не так», а не белую страницу. Новый провайдер (тема,
// уведомления) добавляется сюда, а не в App и не в экран.
// ============================================================================
import type { ReactNode } from 'react'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { ConfettiLayer } from '../shared/ui/Confetti'
import { ErrorBoundary } from './ErrorBoundary'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          {/* слой празднования: слушает celebrate() из любого экрана */}
          <ConfettiLayer />
          {children}
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
