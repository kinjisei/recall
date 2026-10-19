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
// ⚠️ Свайп берём ТОЛЬКО с «ручки» (touch-none на ней), а не со всей панели:
// внутри у шторок свой скролл, и перехват свайпа с контента сломал бы прокрутку.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { useSidePanel } from '../lib/sidePanel'
import { useIsDesktop } from '../lib/useMediaQuery'

/** Насколько утянуть вниз, чтобы закрылось. Меньше — закрывается случайно. */
const CLOSE_AT = 100

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
  const [dy, setDy] = useState(0)
  // тянут ли сейчас — состоянием, а не ref: от него зависит стиль панели
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
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
      if (e.key === 'Escape' && stack[stack.length - 1] === id) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, id])

  const onDown = (e: React.PointerEvent) => {
    startY.current = e.clientY
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return
    setDy(Math.max(0, e.clientY - startY.current)) // тянем только вниз
  }
  const onUp = () => {
    if (!dragging) return
    setDragging(false)
    if (dy > CLOSE_AT) {
      navigator.vibrate?.(10)
      onClose()
    } else {
      setDy(0) // не дотянул — вернуть на место
    }
  }

  if (desktop) {
    const panel = (
      <div
        role="dialog"
        aria-modal={push ? 'false' : 'true'}
        aria-label={label}
        aria-labelledby={labelledBy}
        data-panel={push ? 'push' : 'over'}
        className={`animate-panel-in flex h-full w-side max-w-full flex-col border-l border-line bg-surface pt-5 ${
          push ? 'fixed inset-y-0 right-0 z-40 shadow-raised' : ''
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    )
    return createPortal(
      push ? (
        panel
      ) : (
        // дымка — справа от меню: меню остаётся ярким (макет d3-4)
        <div
          className="animate-haze-in fixed inset-y-0 right-0 z-50 flex justify-end bg-haze"
          style={{ left: slot?.left ?? '0px' }}
          onClick={onClose}
        >
          {panel}
        </div>
      ),
      document.body,
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-scrim/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        className={`animate-fade-up flex w-full flex-col rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] ${className}`}
        style={{
          maxHeight: maxH,
          transform: dy ? `translateY(${dy}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Область захвата: сама «ручка» плюс поле вокруг неё, чтобы палец
            попадал. touch-none — иначе браузер начнёт свой скролл/refresh. */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-hidden
        >
          <div className="h-1.5 w-10 rounded-full bg-fg-faint" />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
