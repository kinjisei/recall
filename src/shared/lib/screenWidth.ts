// ---------------------------------------------------------------------------
// Ширина экрана внутри каркаса (журнал п.45–46, п.55; правила d0).
//
// 1. Сколько места просит экран. Старые экраны — колонка 640 px, пока не
//    переедут (Ф3). Общим раскладкам из shared/ui («список + подробности»,
//    «колонка чтения», неделя расписания) колонки мало: они просят ширину
//    страницы — обычную (предел 1200) или широкую (1600, неделя и таблицы).
//    Раскладка просит сама, экран об этом не думает: взял раскладку — получил
//    место. Вместе с шириной раскладка говорит, сколько ей нужно как минимум
//    (`need`): по этому числу правая панель решает, сдвинуть содержимое или
//    лечь поверх (d0, правило 8).
// 2. Сколько места досталось. Каркас меряет содержимое (область справа от
//    меню минус поля) и отдаёт ширину в px: раскладки переключаются по ней, а
//    не по окну (d0, правило 6) — одинаково при меню 240, рельсе 72 и окне в
//    пол-экрана.
//
// Договор между каркасом и экраном (как focusMode): значения даёт каркас
// (app/shell/Layout), раскладка зовёт хуки. Вне каркаса (вход, онбординг)
// ширина содержимого — ширина окна.
// ---------------------------------------------------------------------------
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'
import { COLUMN_NEED } from '../ui/breakpoints'

export type PageWidth = 'page' | 'wide'
export interface PageWant {
  width: PageWidth
  /** Сколько содержимого нужно раскладке, px (колонка 600, неделя 700…). */
  need: number
}

/** Значение даёт каркас: «экрану нужна ширина страницы — какая; null — колонка». */
export const PageWidthContext = createContext<(want: PageWant | null) => void>(() => {})

/**
 * Просит у каркаса ширину страницы на время жизни компонента. `null` —
 * колонка (так можно переключаться, не нарушая порядок хуков); `undefined` —
 * ничего не просить (раскладке ширина не нужна, а чужой запрос не трогать).
 */
export function usePageWidth(width: PageWidth | null | undefined, need: number = COLUMN_NEED): void {
  const set = useContext(PageWidthContext)
  useEffect(() => {
    if (width === undefined) return
    set(width ? { width, need } : null)
    return () => set(null)
  }, [width, need, set])
}

/** Ширина содержимого в px; null — вне каркаса. */
export const ContentWidthContext = createContext<number | null>(null)

function subscribeResize(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

/** Сколько места у содержимого, px: в каркасе — от каркаса, вне — ширина окна. */
export function useContentWidth(): number {
  const inShell = useContext(ContentWidthContext)
  const windowWidth = useSyncExternalStore(
    subscribeResize,
    useCallback(() => window.innerWidth, []),
  )
  return inShell ?? windowWidth
}

/** Хватает ли содержимому `px` (порог раскладки из AREA, shared/ui/breakpoints). */
export function useContentAtLeast(px: number): boolean {
  return useContentWidth() >= px
}
