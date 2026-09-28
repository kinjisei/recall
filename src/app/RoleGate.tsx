// ============================================================================
// Проверка роли на уровне маршрута (архитектура §16): кому показан экран,
// решает таблица маршрутов (app/routes.ts), а не сам экран. Раньше админка
// проверяла владельца внутри себя, а роль учителя — сам TeacherPage.
//
// ⚠️ Это только видимость: не показывать экран тому, кому он не нужен.
// Защищает сервер — RPC admin_* сами проверяют is_admin.
// ============================================================================
import { useEffect, useState, type ReactNode } from 'react'
import { getMyPlan } from '../lib/billing'
import { Button } from '../components/Button'
import { AppLink } from '../components/AppLink'
import { IconHome, IconSpinner, IconWarning } from '../components/icons'
import type { RouteRole } from './routes'

type GateState = 'checking' | 'allowed' | 'denied'

export function RoleGate({ role, children }: { role: RouteRole; children: ReactNode }) {
  const [state, setState] = useState<GateState>('checking')

  useEffect(() => {
    let cancelled = false
    // любая ошибка (нет сети, нет функции) — «нет доступа»: getMyPlan отдаёт null
    getMyPlan().then((plan) => {
      if (cancelled) return
      const allowed = role === 'admin' && !!plan?.is_admin
      setState(allowed ? 'allowed' : 'denied')
    })
    return () => {
      cancelled = true
    }
  }, [role])

  if (state === 'checking') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--night-text-40)]">
        <IconSpinner size={24} className="animate-spin" />
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-[var(--night-text-40)]">
          <IconWarning size={26} />
        </span>
        <h1 className="text-xl font-medium">Доступно только владельцу</h1>
        <p className="max-w-xs text-sm text-[var(--night-text-40)]">
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
