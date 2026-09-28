// ============================================================================
// Общая нижняя шторка: фон, «ручка», свайп-вниз-закрывает, safe-area, Escape.
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
// ⚠️ Свайп берём ТОЛЬКО с «ручки» (touch-none на ней), а не со всей панели:
// внутри у шторок свой скролл, и перехват свайпа с контента сломал бы прокрутку.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'

/** Насколько утянуть вниз, чтобы закрылось. Меньше — закрывается случайно. */
const CLOSE_AT = 100

// Стек открытых шторок. Нужен, когда одна поверх другой (Picker внутри
// композера): Escape и системная «назад» должны закрывать ТОЛЬКО верхнюю, иначе
// одно нажатие схлопывает обе. Верхняя — последняя в стеке.
const stack: symbol[] = []

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
  /** Потолок высоты панели. Большинство шторок — 85dvh, длинные формы — 88dvh. */
  maxH?: string
  /** Доп. классы панели — редко: своя ширина или паддинги. */
  className?: string
  /** Заголовок для скринридера, если у шторки нет своего видимого заголовка. */
  label?: string
  /** id видимого заголовка внутри — предпочтительнее label. */
  labelledBy?: string
}) {
  const [dy, setDy] = useState(0)
  const drag = useRef({ startY: 0, active: false })
  const idRef = useRef<symbol>(undefined)
  if (!idRef.current) idRef.current = Symbol('sheet')

  // Регистрируемся в стеке на монтировании — так Escape знает, кто наверху.
  useEffect(() => {
    const id = idRef.current!
    stack.push(id)
    return () => {
      const i = stack.lastIndexOf(id)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [])

  // Escape закрывает ТОЛЬКО верхнюю шторку — иначе Picker внутри композера
  // закрыл бы заодно и композер.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === idRef.current) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const onDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, active: true }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    setDy(Math.max(0, e.clientY - drag.current.startY)) // тянем только вниз
  }
  const onUp = () => {
    if (!drag.current.active) return
    drag.current.active = false
    if (dy > CLOSE_AT) {
      navigator.vibrate?.(10)
      onClose()
    } else {
      setDy(0) // не дотянул — вернуть на место
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        className={`animate-fade-up flex w-full flex-col rounded-t-3xl bg-[var(--night-surface)] pb-[env(safe-area-inset-bottom)] ${className}`}
        style={{
          maxHeight: maxH,
          transform: dy ? `translateY(${dy}px)` : undefined,
          transition: drag.current.active ? 'none' : 'transform 0.25s ease-out',
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
          <div className="h-1.5 w-10 rounded-full bg-slate-600" />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
