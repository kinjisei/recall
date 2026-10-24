// ============================================================================
// Клавиши-команды экрана на компьютере: «T» — сегодня, «N» — новый урок
// (макет d1), «/» — к поиску учеников (d3). Общие правила, чтобы клавиша не
// мешала: в поле ввода буква — это текст; с Ctrl/Alt/Cmd и при зажатой
// клавише — ничего; пока открыта шторка, меню или диалог — команда экрана
// молчит. Клавиши упражнений (1–4, Enter, Esc) — свои, в `roundKeys`.
// ============================================================================
import { useEffect, useRef } from 'react'
import { isSheetOpen } from './Sheet'

/** Фокус в поле ввода: буквы и цифры там — текст, а не команда. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

/** Сейчас поверх экрана что-то открыто: шторка, меню или диалог. */
export function overlayOpen(): boolean {
  return isSheetOpen() || !!document.querySelector('[role="menu"], [role="dialog"], [role="alertdialog"]')
}

/**
 * Команды по коду клавиши (`KeyT`, `KeyN`, `Slash`): код не зависит от
 * раскладки — на русской «T» печатает «е», а команда та же. Обработчики
 * берутся свежими, без переподписки на каждый рендер.
 */
export function useHotkeys(keys: Record<string, () => void>, enabled = true): void {
  const latest = useRef(keys)
  useEffect(() => {
    latest.current = keys
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target) || overlayOpen()) return
      const run = latest.current[e.code]
      if (!run) return
      e.preventDefault()
      run()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled])
}
