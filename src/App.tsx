import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { DashboardPage } from './features/dashboard/DashboardPage'

// Роуты — лениво: каждая страница (и её данные) грузится при переходе, а не
// в стартовом бандле. Особенно важно для «Ввода» и грамматики — они тянут
// сотни КБ контента, который не нужен на старте.
const WordsPage = lazy(() =>
  import('./features/words/WordsPage').then((m) => ({ default: m.WordsPage })),
)
const ReaderPage = lazy(() =>
  import('./features/reader/ReaderPage').then((m) => ({ default: m.ReaderPage })),
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
const PlacementTest = lazy(() =>
  import('./features/onboarding/PlacementTest').then((m) => ({ default: m.PlacementTest })),
)
const TeacherPage = lazy(() =>
  import('./features/teacher/TeacherPage').then((m) => ({ default: m.TeacherPage })),
)
const AssignmentsPage = lazy(() =>
  import('./features/teacher/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })),
)

function PageFallback() {
  return <p className="p-6 text-center text-slate-400">Загрузка…</p>
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route
                path="/flashcards"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <WordsPage />
                  </Suspense>
                }
              />
              <Route
                path="/reader"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ReaderPage />
                  </Suspense>
                }
              />
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
                path="/grammar"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <GrammarPage />
                  </Suspense>
                }
              />
              {/* «Практика» переехала в хаб «Слова» — старые ссылки не ломаем */}
              <Route path="/practice" element={<Navigate to="/flashcards" replace />} />
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
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
