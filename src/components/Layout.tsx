import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto min-h-screen max-w-screen-sm px-4 pb-24 pt-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
