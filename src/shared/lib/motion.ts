// ============================================================================
// Уход с экрана по листу s4: шторка уходит вниз, панель — вправо, тост — вниз,
// меню — обратно к аватару. Сама анимация — классы в src/index.css
// (animate-*-out); здесь — сколько её ждать, прежде чем снять элемент.
//
// Зачем ждать. Шторку, тост и меню рисует экран по своему состоянию
// (`{open && <Sheet …/>}`): снял — исчезло мгновенно, уходить нечему.
// Поэтому компонент сначала играет уход, а `onClose` экрана зовёт по его
// концу. Закрытие, которое начал сам экран (сохранил и закрыл), остаётся
// мгновенным — у него нет времени на анимацию до перерисовки.
//
// Числа — пара с index.css, сверяет scripts/test-tokens.mjs. При «уменьшить
// движение» уход — только прозрачность за 150 мс (тоже index.css).
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react'

/** Длительность ухода, мс (s4, «Движение»). */
export const LEAVE_MS = {
  sheet: 240,
  panel: 220,
  toast: 160,
  menu: 140,
} as const

/** Уход при «уменьшить движение»: прозрачность за 150 мс. */
export const REDUCED_LEAVE_MS = 150

/** Настройка «уменьшить движение» — читаем на каждый уход: её меняют на ходу. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Уход с анимацией: `leave()` ставит `leaving`, а `done` зовёт по концу
 * анимации и снова готов к уходу. Повторный `leave()` во время ухода ничего
 * не делает (Escape и клик по затемнению не закроют дважды).
 */
export function useLeave(done: () => void, ms: number): { leaving: boolean; leave: () => void } {
  const [leaving, setLeaving] = useState(false)
  const doneRef = useRef(done)
  const timer = useRef(0)
  useEffect(() => {
    doneRef.current = done
  })
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const leave = useCallback(() => {
    if (timer.current) return
    setLeaving(true)
    timer.current = window.setTimeout(
      () => {
        // снова готов к уходу: меню профиля живёт дальше и откроется ещё раз
        timer.current = 0
        setLeaving(false)
        doneRef.current()
      },
      prefersReducedMotion() ? REDUCED_LEAVE_MS : ms,
    )
  }, [ms])
  return { leaving, leave }
}
