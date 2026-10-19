// ============================================================================
// Общая шторка: фон, «ручка», свайп-вниз-закрывает, safe-area, Escape.
//
// Зачем одна на всех. Каждая шторка (WordSheet, WordPicker, композер домашки и
// прочие) копировала один каркас: портал в body, полупрозрачный фон, панель
// rounded-t-3xl, декоративная «ручка». Ручка при этом НИ К ЧЕМУ не подключена —
// свайп вниз по ней шторку не закрывал, а долетал до браузера как
// pull-to-refresh, и PWA перезагружалась. Здесь жест реальный: панель тянется
// за пальцем и закрывается за порогом. Плюс глобально погашен pull-to-refresh
// (index.css, overscroll-behavior), поэтому перезагрузка невозможна ни в одной
// шторке — даже ещё не мигрированной.
//
// На компьютере (окно от 720 px) шторка — ПРАВАЯ ПАНЕЛЬ 440 на всю высоту, а
// не окно по центру (журнал п.46, п.55; макеты d0 — правило 8, d2, d3-4):
// рядом остаётся видно экран, из которого её открыли. Если содержимому после
// сдвига хватает места его раскладки, панель СДВИГАЕТ его без затемнения —
// можно сверяться с экраном, страница работает, закрывает Escape. Не хватает
// — ложится ПОВЕРХ с лёгкой дымкой справа от меню; закрывают Escape и клик по
// дымке. Решает геометрия каркаса (shared/lib/sidePanel); вторая шторка
// поверх первой — всегда поверх. Ручки на компьютере нет — тянуть мышью
// некуда. Шторки ничего не знают о ширине: раскладку выбирает этот компонент.
//
// Движение (лист s4): шторка выезжает снизу за 320 мс и уходит вниз за 240
// — от того места, куда её дотянули; панель — справа за 280 и вправо за 220;
// затемнение и дымка — параллельно. При «уменьшить движение» — только
// прозрачность. Уход играет сама шторка и зовёт onClose по его концу
// (shared/lib/motion): Escape, затемнение, свайп и закрытие изнутри
// (useSheetClose — «закрыть» в SheetHeader). Закрытие, которое начал сам
// экран (сохранил и снял шторку), — мгновенное.
//
// ⚠️ Свайп берём ТОЛЬКО с «ручки» (touch-none на ней), а не со всей панели:
// внутри у шторок свой скролл, и перехват свайпа с контента сломал бы прокрутку.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { LEAVE_MS, useLeave } from '../lib/motion'
import { useSidePanel } from '../lib/sidePanel'
import { useIsDesktop } from '../lib/useMediaQuery'
import { SheetCloseContext } from './sheetClose'

/** Отпустил ниже трети высоты — закрывается (s4); меньше — вернётся на место. */
const CLOSE_SHARE = 1 / 3
/** Быстрый жест вниз закрывает и с короткого хода (s4): скорость, px/мс, и
 *  ход не меньше FLICK_MIN — случайное касание с дрожью не закроет. */
const FLICK_SPEED = 0.6
const FLICK_MIN = 64

/**
 * Тело шторки с прокруткой — одно на все: колонка с отступами, а дети не
 * сжимаются (*:shrink-0). Без этого длинное содержимое не прокручивалось, а
 * сплющивало кнопки и строки: «Готово» в «Напомнить об уроке» при трёх
 * учениках — 24 px в высоту (нашлось UX-аудитом в Ф2.9; класс был скопирован
 * в девять шторок расписания).
 */
export const SHEET_BODY = 'flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-1 *:shrink-0'

// Стек открытых шторок. Нужен, когда одна поверх другой (Picker внутри
// композера): Escape и системная «назад» должны закрывать ТОЛЬКО верхнюю, иначе
// одно нажатие схлопывает обе. Верхняя — последняя в стеке.
const stack: symbol[] = []

/** Открыта ли сейчас хоть одна шторка — Escape тогда её, а не экрана. */
export function isSheetOpen(): boolean {
  return stack.length > 0
}

export function Sheet({
  onClose,
  children,
  maxH = '85dvh',
  className = '',
  label,
  labelledBy,
}: {
  onClose: () => void
  children: React.ReactNode
  /** Потолок высоты панели на телефоне. Большинство шторок — 85dvh, длинные
   *  формы — 88dvh. На компьютере панель во всю высоту окна. */
  maxH?: string
  /** Доп. классы панели — редко: своя ширина или паддинги. */
  className?: string
  /** Заголовок для скринридера, если у шторки нет своего видимого заголовка. */
  label?: string
  /** id видимого заголовка внутри — предпочтительнее label. */
  labelledBy?: string
}) {
  const desktop = useIsDesktop()
  const slot = useSidePanel()
  // сдвигает содержимое только первая шторка: вторая (Picker внутри формы)
  // ложится поверх первой
  const [first] = useState(() => stack.length === 0)
  const push = desktop && first && !!slot?.fits
  const setPushed = slot?.setPushed
  const { leaving, leave } = useLeave(onClose, desktop ? LEAVE_MS.panel : LEAVE_MS.sheet)
  const [dy, setDy] = useState(0)
  // тянут ли сейчас — состоянием, а не ref: от него зависит стиль панели
  const [dragging, setDragging] = useState(false)
  const drag = useRef({ y: 0, t: 0, speed: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const [id] = useState(() => Symbol('sheet'))

  // Регистрируемся в стеке на монтировании — так Escape знает, кто наверху.
  useEffect(() => {
    stack.push(id)
    return () => {
      const i = stack.lastIndexOf(id)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [id])

  // Панель со сдвигом — каркас отодвигает содержимое, пока она открыта.
  useEffect(() => {
    if (!push || !setPushed) return
    setPushed(true)
    return () => setPushed(false)
  }, [push, setPushed])

  // Escape закрывает ТОЛЬКО верхнюю шторку — иначе Picker внутри композера
  // закрыл бы заодно и композер.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) leave()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [leave, id])

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, t: e.timeStamp, speed: 0 }
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const next = Math.max(0, e.clientY - drag.current.y) // тянем только вниз
    const dt = e.timeStamp - drag.current.t
    if (dt > 0) drag.current.speed = (next - dy) / dt
    drag.current.t = e.timeStamp
    setDy(next)
  }
  const onUp = () => {
    if (!dragging) return
    setDragging(false)
    const height = panelRef.current?.offsetHeight ?? 300
    if (dy > height * CLOSE_SHARE || (dy >= FLICK_MIN && drag.current.speed > FLICK_SPEED)) {
      navigator.vibrate?.(10)
      leave()
    } else {
      setDy(0) // не дотянул — вернуть на место
    }
  }

  const content = <SheetCloseContext.Provider value={leave}>{children}</SheetCloseContext.Provider>

  if (desktop) {
    const panel = (
      <div
        role="dialog"
        aria-modal={push ? 'false' : 'true'}
        aria-label={label}
        aria-labelledby={labelledBy}
        data-panel={push ? 'push' : 'over'}
        className={`${leaving ? 'animate-panel-out' : 'animate-panel-in'} flex h-full w-side max-w-full flex-col border-l border-line bg-surface pt-5 ${
          push ? 'fixed inset-y-0 right-0 z-40 shadow-raised' : ''
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    )
    return createPortal(
      push ? (
        panel
      ) : (
        // дымка — справа от меню: меню остаётся ярким (макет d3-4)
        <div
          className={`${leaving ? 'animate-haze-out' : 'animate-haze-in'} fixed inset-y-0 right-0 z-50 flex justify-end bg-haze`}
          style={{ left: slot?.left ?? '0px' }}
          onClick={leave}
        >
          {panel}
        </div>
      ),
      document.body,
    )
  }

  // уход — анимацией от места, куда дотянули (index.css, sheet-out читает --drag)
  const panelStyle = {
    maxHeight: maxH,
    '--drag': `${dy}px`,
    transform: dy && !leaving ? `translateY(${dy}px)` : undefined,
    transition: dragging ? 'none' : 'transform 0.24s var(--ease-out)',
  } as React.CSSProperties

  return createPortal(
    // затемнение — сила своя у темы: 55 % в тёмной, 40 % в светлой (s2)
    <div className="fixed inset-0 z-50 flex items-end" onClick={leave}>
      <div aria-hidden className={`${leaving ? 'animate-scrim-out' : 'animate-scrim-in'} absolute inset-0 bg-scrim/(--scrim-sheet)`} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        className={`${leaving ? 'animate-sheet-out' : 'animate-sheet-in'} relative flex w-full flex-col rounded-t-sheet bg-surface pb-[env(safe-area-inset-bottom)] shadow-sheet ${className}`}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Область захвата: сама «ручка» 36 × 5 плюс поле вокруг неё, чтобы
            палец попадал. touch-none — иначе браузер начнёт свой
            скролл/refresh. */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-hidden
        >
          <div className="h-1.25 w-9 rounded-full bg-fg-faint" />
        </div>
        {content}
      </div>
    </div>,
    document.body,
  )
}
