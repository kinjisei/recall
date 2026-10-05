// ============================================================================
// Корень приложения: провайдеры, роутер и маршруты из таблицы app/routes.ts.
//
// Экраны — лениво: каждая страница (и её данные) грузится при переходе, а не
// в стартовом бандле. Определения живут в app/routeChunks: там же лежит
// предзагрузка, которой пользуются ссылки (shared/ui/AppLink). Уже
// подгруженный экран показывается БЕЗ Suspense — иначе переход между
// вкладками снимал бы кадр с «Загрузка…».
// ============================================================================
import { Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loading } from '../shared/ui/Loading'
import { AppProviders } from './AppProviders'
import { ScrollToTop } from './ScrollToTop'
import { PageTracker } from './PageTracker'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGate, StartGate } from './RoleGate'
import { Layout } from './shell/Layout'
import { ROUTES, isLazyScreen, opensForGuests, type AppRoute } from './routes'

function PageFallback() {
  return <Loading label="Открываем экран" />
}

/** Элемент маршрута: экран (с заглушкой, проверкой роли, стартом роли и входа) или переадресация. */
function routeElement(route: AppRoute): ReactNode {
  if ('redirect' in route) return <Navigate to={route.redirect} replace />
  const Screen = route.screen
  let element: ReactNode = <Screen />
  if (route.role) element = <RoleGate role={route.role} othersTo={route.othersTo}>{element}</RoleGate>
  if (route.start) element = <StartGate>{element}</StartGate>
  if (isLazyScreen(Screen)) element = <Suspense fallback={<PageFallback />}>{element}</Suspense>
  // экран «на весь экран» пускается по входу сам; экраны в рамке — через рамку
  if (route.place === 'fullscreen') element = <ProtectedRoute>{element}</ProtectedRoute>
  return element
}

/**
 * Общая рамка. Открытая страница (тарифы, оферта, лендинг) у гостя — без
 * рамки, на весь экран, как раньше; у вошедшего — в рамке с меню. Открытые
 * адреса живут под этой же рамкой, а не отдельным деревом: иначе переход
 * «Учёба → Тарифы» пересоздавал бы меню и шапку.
 */
function Frame() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (opensForGuests(pathname)) {
    if (loading) return <PageFallback />
    if (!user) return <Outlet />
  }
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  )
}

const outsideFrame = ROUTES.filter((r) => r.place === 'public' || r.place === 'fullscreen')
const insideFrame = ROUTES.filter((r) => r.place === 'app' || r.place === 'open')

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <ScrollToTop />
        <PageTracker />
        <Routes>
          {outsideFrame.map((r) => (
            <Route key={r.path} path={r.path} element={routeElement(r)} />
          ))}
          <Route element={<Frame />}>
            {insideFrame.map((r) => (
              <Route key={r.path} path={r.path} element={routeElement(r)} />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  )
}
