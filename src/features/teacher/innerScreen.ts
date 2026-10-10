// ============================================================================
// Внутренний экран студии со своей шапкой «назад» прячет шапку страницы над
// собой (PLAN.md Ф2.11): шаг мастера материала, карточка материала и
// письменное задание — шапку раздела «Заданий» (TasksPage); карточка ученика
// на телефоне и экран её раздела — шапку «Ученики (?) ↻ + Ученик»
// (TeacherPage, макет t6-2). Раньше они стояли друг под другом —
// «‹ Материалы» и «‹ План материала от AI»: две стрелки, и непонятно, какая
// куда ведёт.
// ============================================================================
import { createContext, useContext, useLayoutEffect } from 'react'

/** Сеттер дают TasksPage и TeacherPage; вне них вызов ничего не делает. */
export const InnerScreenContext = createContext<(inner: boolean) => void>(() => {})

/** Вызывать вверху экрана, у которого своя BackHeader; active — сейчас ли он открыт. */
export function useInnerScreen(active = true): void {
  const set = useContext(InnerScreenContext)
  // до отрисовки: иначе шапка раздела мелькала бы на кадр и экран прыгал
  useLayoutEffect(() => {
    if (!active) return
    set(true)
    return () => set(false)
  }, [set, active])
}
