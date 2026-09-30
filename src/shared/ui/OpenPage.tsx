// ============================================================================
// Рамка открытой страницы — тарифы, оферта, политика (правка владельца
// 30.09.2026).
//
// Гость видит такую страницу на весь экран: своя колонка, отступ под «чёлку»
// телефона, фон страницы. Вошедший — внутри общей рамки приложения, с меню
// и нижними вкладками, как любой экран: раньше тарифы открывались отдельным
// окном без меню, и уйти можно было только кнопкой «Назад». Колонку, отступы
// и фон тогда даёт каркас, и своя рамка задвоила бы их.
//
// Кто куда пускается — таблица app/routes.ts (place: 'open'); здесь — только
// вид.
// ============================================================================
import type { ReactNode } from 'react'
import { useInShell } from '../lib/shellInsets'

export function OpenPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  if (useInShell()) return <div className={className}>{children}</div>
  return (
    <main
      className={`mx-auto min-h-[100dvh] max-w-screen-sm bg-page px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-fg ${className}`}
    >
      {children}
    </main>
  )
}
