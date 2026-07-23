// ============================================================================
// Мессенджер-раскладка чата («Диалог», AI-квесты): СПИСОК сообщений скроллится
// ВНУТРИ себя, а не страницей. Это решает сразу три жалобы:
//   • шапка приложения и заголовок чата всегда видны (страница не скроллится);
//   • при открытии клавиатуры ничего не «уезжает наверх» — сжимается список;
//   • новые сообщения автоматически показывают НИЗ ленты, как в мессенджерах.
// Хук меряет высоту под список: от его верхней кромки до панели ввода
// (учитывая клавиатуру через kb из useKeyboardInset и плавающую навигацию).
// ============================================================================
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Высота панели ввода + отступ (h-12 поле + p-2 рамки ≈ 64px + зазор). */
const INPUT_PANEL = 72
/** Блок плавающей навигации под панелью, когда клавиатура закрыта. */
const NAV_BLOCK = 88

export function useChatList(kb: number, deps: unknown[]) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState<number | null>(null)

  // высота списка: от его верха до панели ввода (страница стоит на месте)
  useLayoutEffect(() => {
    const measure = () => {
      const top = listRef.current?.getBoundingClientRect().top ?? 0
      const viewport = window.innerHeight - kb
      const bottomSpace = INPUT_PANEL + (kb > 0 ? 0 : NAV_BLOCK)
      setHeight(Math.max(160, viewport - top - bottomSpace))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [kb])

  // автоскролл к последнему сообщению (мгновенно при открытии, плавно дальше)
  const firstRef = useRef(true)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: firstRef.current ? 'auto' : 'smooth' })
    firstRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, height])

  return { listRef, height }
}
