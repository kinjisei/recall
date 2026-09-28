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
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loading } from '../shared/ui/Loading'
import { AppProviders } from './AppProviders'
import { ScrollToTop } from './ScrollToTop'
import { PageTracker } from './PageTracker'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGate } from './RoleGate'
import { Layout } from './shell/Layout'
import { ROUTES, isLazyScreen, type AppRoute } from './routes'

function PageFallback() {
  return <Loading label="Открываем экран" />
}

/** Элемент маршрута: экран (с заглушкой, проверкой роли и входа) или переадресация. */
function routeElement(route: AppRoute): ReactNode {
  if ('redirect' in route) return <Navigate to={route.redirect} replace />
  const Screen = route.screen
  let element: ReactNode = <Screen />
  if (route.role) element = <RoleGate role={route.role}>{element}</RoleGate>
  if (isLazyScreen(Screen)) element = <Suspense fallback={<PageFallback />}>{element}</Suspense>
  // экран «на весь экран» пускается по входу сам; экраны в рамке — через рамку
  if (route.place === 'fullscreen') element = <ProtectedRoute>{element}</ProtectedRoute>
  return element
}

const outsideFrame = ROUTES.filter((r) => r.place !== 'app')
const insideFrame = ROUTES.filter((r) => r.place === 'app')

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
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
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
