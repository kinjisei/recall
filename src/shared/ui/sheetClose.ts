// Закрыть шторку изнутри тем же уходом, что по затемнению и Escape (s4:
// вниз за 240 мс, панель — вправо за 220): кнопка «закрыть» в заголовке,
// «Готово», «Отмена». Даёт Sheet, читает SheetHeader и любое тело шторки.
// Вне шторки — undefined: тогда экран закрывает сам, без анимации.
import { createContext, useContext } from 'react'

export const SheetCloseContext = createContext<(() => void) | undefined>(undefined)

export function useSheetClose(): (() => void) | undefined {
  return useContext(SheetCloseContext)
}
