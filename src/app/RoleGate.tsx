// ============================================================================
// Проверка роли на уровне маршрута (архитектура §16): кому показан экран,
// решает таблица маршрутов (app/routes.ts), а не сам экран. Раньше админка
// проверяла владельца внутри себя, а роль учителя — сами студия и расписание.
//
// ⚠️ Это только видимость: не показывать экран тому, кому он не нужен.
// Защищает сервер — RPC admin_* сами проверяют is_admin, запись студии —
// teacher_can_write.
// ============================================================================
import { lazy, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getMyPlan } from '../lib/billing'
import { Button } from '../shared/ui/Button'
import { AppLink } from '../shared/ui/AppLink'
import { LoadError } from '../shared/ui/LoadError'
import { IconHome, IconSpinner, IconWarning } from '../shared/ui/icons'
import { startPath } from './navigation'
import type { RouteRole } from './routes'
import { useRoleState } from './shell/useMyRole'

type GateState = 'checking' | 'allowed' | 'denied'

// Приглашение нужно только не-репетитору на экране студии — в стартовый код
// каждого ученика его не тянем; заглушку на время загрузки даёт Suspense
// ленивого экрана, внутри которого стоит проверка (App.tsx).
const BecomeTeacher = lazy(() => import('../features/teacher/BecomeTeacher').then((m) => ({ default: m.BecomeTeacher })))

function Checking() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-fg-muted">
      <IconSpinner size={24} className="animate-spin" />
    </div>
  )
}

export function RoleGate({ role, othersTo, children }: { role: RouteRole; othersTo?: string; children: ReactNode }) {
  return role === 'teacher' ? (
    <TeacherGate othersTo={othersTo}>{children}</TeacherGate>
  ) : (
    <AdminGate>{children}</AdminGate>
  )
}

/**
 * Экраны студии (PLAN.md Ф2.10). Не-репетитору — приглашение «Ведёшь
 * учеников?»: это продукт, а не запрет; включил режим — роль перечитывается
 * сама (invalidateProfile), и экран открывается без перезагрузки. Без связи —
 * «Повторить», а не приглашение настоящему учителю (Ф1.13).
 */
function TeacherGate({ othersTo, children }: { othersTo?: string; children: ReactNode }) {
  const { role, status, retry } = useRoleState()
  const navigate = useNavigate()
  if (status === 'unknown') return <Checking />
  if (status === 'failed') return <LoadError message="Не удалось открыть студию" onRetry={retry} />
  if (role === 'teacher') return <>{children}</>
  if (othersTo) return <Navigate to={othersTo} replace />
  return <BecomeTeacher onBack={() => navigate('/')} />
}

/**
 * Стартовый экран («/»): у роли со своим стартом — туда (учитель —
 * расписание, архитектура §16). Пока роль неизвестна (первый вход на
 * устройстве) — ждём, а не показываем учителю Главную ученика на миг. Нет
 * связи и роли не знаем — Главная: она сама скажет о связи.
 */
export function StartGate({ children }: { children: ReactNode }) {
  const { role, status } = useRoleState()
  const { pathname } = useLocation()
  if (status === 'unknown') return <Checking />
  const start = startPath(role)
  if (status === 'known' && start !== pathname) return <Navigate to={start} replace />
  return <>{children}</>
}

function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('checking')

  useEffect(() => {
    let cancelled = false
    // любая ошибка (нет сети, нет функции) — «нет доступа»: getMyPlan отдаёт null
    getMyPlan().then((plan) => {
      if (cancelled) return
      setState(plan?.is_admin ? 'allowed' : 'denied')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'checking') return <Checking />

  if (state === 'denied') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tint/[0.06] text-fg-muted">
          <IconWarning size={26} />
        </span>
        <h1 className="text-xl font-medium">Доступно только владельцу</h1>
        <p className="max-w-xs text-sm text-fg-muted">
          У этого аккаунта нет прав администратора.
        </p>
        <AppLink to="/">
          <Button variant="secondary" className="mt-2">
            <IconHome size={18} /> На главную
          </Button>
        </AppLink>
      </div>
    )
  }

  return <>{children}</>
}
