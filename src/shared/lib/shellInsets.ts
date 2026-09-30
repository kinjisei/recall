// ============================================================================
// Геометрия каркаса для закреплённых (fixed) элементов экранов — сейчас это
// панель ввода чата в «Диалоге» и AI-квестах.
//
// Такой элемент стоит относительно ОКНА, а не колонки экрана, поэтому должен
// знать, что вокруг занимает каркас: на телефоне снизу плавающая навигация, на
// компьютере слева меню, а снизу ничего. Раньше чат держал «88 px под
// навигацию» у себя — на компьютере без нижней панели это дало бы пустую
// полосу снизу и панель ввода мимо колонки (центр по окну, а не по месту
// рядом с меню).
//
// Договор между каркасом и экраном (как focusMode): значение даёт каркас
// (app/shell/Layout), экран читает хуком. Экран не импортирует каркас (§2).
// ============================================================================
import { createContext, useContext } from 'react'

export interface ShellInsets {
  /** Сколько слева занимает меню: CSS-значение для `left`. */
  left: string
  /** Сколько снизу занимает навигация: CSS-значение для `bottom`. */
  bottom: string
  /** То же в пикселях — для расчёта высоты (safe-area сюда не входит). */
  bottomPx: number
}

/** Телефон и планшет: меню слева нет, снизу — плавающая капсула навигации. */
export const PHONE_INSETS: ShellInsets = {
  left: '0px',
  // высота капсулы (~69px) + отступ снизу (16px) ≈ 5.5rem, плюс safe-area
  bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
  bottomPx: 88,
}

export const ShellInsetsContext = createContext<ShellInsets>(PHONE_INSETS)

export function useShellInsets(): ShellInsets {
  return useContext(ShellInsetsContext)
}

/** Экран внутри общей рамки приложения. Открытые страницы (тарифы, оферта,
 *  лендинг) гостю рисуют свою рамку на весь экран, а вошедшему живут внутри
 *  общей — им нужно знать, какая сейчас (shared/ui/OpenPage). */
export const InShellContext = createContext(false)

export function useInShell(): boolean {
  return useContext(InShellContext)
}
