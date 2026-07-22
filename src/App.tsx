import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ConfettiLayer } from './components/Confetti'
import { ScrollToTop } from './components/ScrollToTop'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { DashboardPage } from './features/dashboard/DashboardPage'

// Роуты — лениво: каждая страница (и её данные) грузится при переходе, а не
// в стартовом бандле. Особенно важно для «Ввода» и грамматики — они тянут
// сотни КБ контента, который не нужен на старте.
const PracticePage = lazy(() =>
  import('./features/practice/PracticePage').then((m) => ({ default: m.PracticePage })),
)
const PronunciationPage = lazy(() =>
  import('./features/pronunciation/PronunciationPage').then((m) => ({ default: m.PronunciationPage })),
)
const ConversationPage = lazy(() =>
  import('./features/conversation/ConversationPage').then((m) => ({ default: m.ConversationPage })),
)
const GrammarPage = lazy(() =>
  import('./features/grammar/GrammarPage').then((m) => ({ default: m.GrammarPage })),
)
const StudyPage = lazy(() =>
  import('./features/study/StudyPage').then((m) => ({ default: m.StudyPage })),
)
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const ProgressPage = lazy(() =>
  import('./features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })),
)
const PlacementTest = lazy(() =>
  import('./features/onboarding/PlacementTest').then((m) => ({ default: m.PlacementTest })),
)
const OnboardingFlow = lazy(() =>
  import('./features/onboarding/OnboardingFlow').then((m) => ({ default: m.OnboardingFlow })),
)
const TeacherPage = lazy(() =>
  import('./features/teacher/TeacherPage').then((m) => ({ default: m.TeacherPage })),
)
const AssignmentsPage = lazy(() =>
  import('./features/teacher/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })),
)
const QuestsPage = lazy(() =>
  import('./features/quests/QuestsPage').then((m) => ({ default: m.QuestsPage })),
)
const PrivacyPage = lazy(() =>
  import('./features/legal/LegalPage').then((m) => ({ default: m.PrivacyPage })),
)
const TermsPage = lazy(() =>
  import('./features/legal/LegalPage').then((m) => ({ default: m.TermsPage })),
)
const PricingPage = lazy(() =>
  import('./features/billing/PricingPage').then((m) => ({ default: m.PricingPage })),
)
// Экран администратора: сам файл делает другой агент — тут только роут.
const AdminPage = lazy(() =>
  import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
)

function PageFallback() {
  return <p className="p-6 text-center text-[var(--night-text-40)]">Загрузка…</p>
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
      <LanguageProvider>
        {/* слой празднования: слушает celebrate() из любого экрана */}
        <ConfettiLayer />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* юридические страницы — публичные (ссылки со входа) */}
            <Route
              path="/privacy"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PrivacyPage />
                </Suspense>
              }
            />
            <Route
              path="/terms"
              element={
                <Suspense fallback={<PageFallback />}>
                  <TermsPage />
                </Suspense>
              }
            />
            {/* тарифы — публичные, работают и без входа */}
            <Route
              path="/pricing"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PricingPage />
                </Suspense>
              }
            />
            {/* онбординг — без Layout: свои шаги на весь экран */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageFallback />}>
                    <OnboardingFlow />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              {/* хаб «Слова» вырос в «Практику» — старые ссылки не ломаем */}
              <Route path="/flashcards" element={<Navigate to="/practice" replace />} />
              {/* «Ввод» слился с «Учёбой»: один экран, старая ссылка ведёт туда же */}
              <Route path="/reader" element={<Navigate to="/study" replace />} />
              <Route
                path="/pronunciation"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <PronunciationPage />
                  </Suspense>
                }
              />
              <Route
                path="/conversation"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ConversationPage />
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
              <Route
                path="/progress"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ProgressPage />
                  </Suspense>
                }
              />
              <Route
                path="/study"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <StudyPage />
                  </Suspense>
                }
              />
              <Route
                path="/grammar"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <GrammarPage />
                  </Suspense>
                }
              />
              <Route
                path="/practice"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <PracticePage />
                  </Suspense>
                }
              />
              <Route
                path="/placement"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <PlacementTest />
                  </Suspense>
                }
              />
              <Route
                path="/teacher"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <TeacherPage />
                  </Suspense>
                }
              />
              <Route
                path="/assignments"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <AssignmentsPage />
                  </Suspense>
                }
              />
              <Route
                path="/quests"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <QuestsPage />
                  </Suspense>
                }
              />
              <Route
                path="/admin"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <AdminPage />
                  </Suspense>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
