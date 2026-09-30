// ============================================================================
// Мессенджер-раскладка чата («Диалог», AI-квесты): СПИСОК сообщений скроллится
// ВНУТРИ себя, а не страницей. Это решает сразу три жалобы:
//   • шапка приложения и заголовок чата всегда видны (страница не скроллится);
//   • при открытии клавиатуры ничего не «уезжает наверх» — сжимается список;
//   • новые сообщения автоматически показывают НИЗ ленты, как в мессенджерах.
// Хук меряет высоту под список: от его верхней кромки до панели ввода
// (учитывая клавиатуру через kb из useKeyboardInset и навигацию каркаса), и
// отдаёт положение самой панели ввода — одно место на оба чата.
// ============================================================================
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useShellInsets } from '../shared/lib/shellInsets'

/** Высота панели, пока её не измерили (или её нет — квест пройден). */
const INPUT_PANEL = 72
/** Зазор между окном ленты и капсулой ввода. */
const GAP = 12

export function useChatList(kb: number, deps: unknown[]) {
  const listRef = useRef<HTMLDivElement | null>(null)
  // панель ввода (shared/ui/Chat → ChatInputBar): её настоящая высота
  const barRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState<number | null>(null)
  // сколько места занимает каркас: снизу навигация (телефон), слева меню
  // (компьютер) — shared/lib/shellInsets
  const insets = useShellInsets()

  // высота списка: от его верха до панели ввода (страница стоит на месте).
  // ⚠️ Панель меряем по-настоящему, а не константой: под полем бывает строка
  // «Новый диалог», и прежние «72 px» пускали ленту под панель — последний
  // ответ срезался о её край.
  useLayoutEffect(() => {
    const measure = () => {
      const top = listRef.current?.getBoundingClientRect().top ?? 0
      const viewport = window.innerHeight - kb
      const bar = barRef.current ? barRef.current.offsetHeight + GAP : INPUT_PANEL
      const bottomSpace = bar + (kb > 0 ? 0 : insets.bottomPx)
      setHeight(Math.max(160, viewport - top - bottomSpace))
    }
    measure()
    window.addEventListener('resize', measure)
    const observer = barRef.current ? new ResizeObserver(measure) : null
    if (barRef.current) observer?.observe(barRef.current)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [kb, insets.bottomPx])

  // автоскролл к последнему сообщению (мгновенно при открытии, плавно дальше)
  const firstRef = useRef(true)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: firstRef.current ? 'auto' : 'smooth' })
    firstRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, height])

  // Панель ввода закреплена у окна: над клавиатурой, если она открыта, иначе
  // над навигацией каркаса; слева — не заходит под меню компьютера.
  const barStyle: CSSProperties = { left: insets.left, bottom: kb > 0 ? kb : insets.bottom }

  return { listRef, barRef, height, barStyle }
}
