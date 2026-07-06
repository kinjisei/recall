import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { FlashcardsPage } from './features/flashcards/FlashcardsPage'
import { ReaderPage } from './features/reader/ReaderPage'
import { PronunciationPage } from './features/pronunciation/PronunciationPage'
import { ConversationPage } from './features/conversation/ConversationPage'
import { TeacherPage } from './features/teacher/TeacherPage'

export default function App() {
  return (
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
              <Route path="/flashcards" element={<FlashcardsPage />} />
              <Route path="/reader" element={<ReaderPage />} />
              <Route path="/pronunciation" element={<PronunciationPage />} />
              <Route path="/conversation" element={<ConversationPage />} />
              <Route path="/teacher" element={<TeacherPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  )
}
