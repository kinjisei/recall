// ============================================================================
// Выпадающее меню (лист s4, «Меню»; макеты d3-5, t6-1, t6-3): кнопка
// открывает панель под собой, закрывает — клик мимо, Escape, выбор пункта.
// Уход — анимацией обратно к кнопке (меню 180 / 140 мс, `useLeave`), при
// «уменьшить движение» — только прозрачность.
//
// Было три копии одного поведения: меню профиля (каркас), «⋯» карточки
// ученика и сортировка «Учеников». Каждая сама слушала клик мимо и Escape —
// одна по mousedown, другая по pointerdown, и уход анимацией был только у
// первой.
//
//   const { open, leaving, close, trigger, box } = useMenu()
//   <div ref={box} className="relative">
//     <button {...trigger}>…</button>
//     {open && <MenuPanel leaving={leaving} className="right-0 top-full mt-1">…</MenuPanel>}
//   </div>
//
// ⚠️ Разбирать на части, а не держать объект `menu`: в нём ref (`box`), и
// линтер React запрещает читать что-либо из такого объекта при отрисовке.
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LEAVE_MS, useLeave } from '../lib/motion'
import { IconCheck, type IconLike } from './icons'

export function useMenu() {
  const [open, setOpen] = useState(false)
  // уход — анимацией к кнопке, потом снять (лист s4)
  const { leaving, leave } = useLeave(() => setOpen(false), LEAVE_MS.menu)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) leave()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, leave])

  const toggle = () => (open ? leave() : setOpen(true))
  return {
    open,
    leaving,
    /** Закрыть анимацией (выбор пункта). */
    close: leave,
    toggle,
    box,
    /** Свойства кнопки, открывающей меню. */
    trigger: { 'aria-haspopup': 'menu' as const, 'aria-expanded': open, onClick: toggle },
  }
}

/** Панель меню: поверхность, рамка line, тень raised, радиус 16 (s4). Положение — className. */
export function MenuPanel({
  leaving,
  label,
  title,
  className = '',
  children,
}: {
  leaving: boolean
  label?: string
  /** Тихий заголовок сверху: «Сортировать». */
  title?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="menu"
      aria-label={label ?? title}
      className={`${leaving ? 'animate-menu-out' : 'animate-menu-in'} absolute z-30 flex flex-col rounded-2xl border border-line bg-surface p-1.5 shadow-raised ${className}`}
    >
      {title && <p className="px-2.5 pb-1.5 pt-2 text-xs font-semibold text-fg-muted">{title}</p>}
      {children}
    </div>
  )
}

/** Пункт-действие: значок и подпись. */
export function MenuItem({ Icon, onSelect, children, tone = 'default' }: { Icon?: IconLike; onSelect: () => void; children: ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-base transition-colors duration-(--dur-1) hover:bg-row-press active:bg-row-press ${tone === 'danger' ? 'text-danger-strong' : 'text-fg'}`}
    >
      {Icon && <Icon size={20} aria-hidden className={tone === 'danger' ? '' : 'text-fg-muted'} />}
      {children}
    </button>
  )
}

/** Пункт-выбор (сортировка, d3-5): галочка у выбранного, подпись и пояснение, выбранный — на accent-soft. */
export function MenuRadio({ checked, label, hint, onSelect }: { checked: boolean; label: string; hint?: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex min-h-13 w-full items-center gap-2.5 rounded-control-sm px-2.5 py-1.5 text-left transition-colors duration-(--dur-1) ${
        checked ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg hover:bg-row-press active:bg-row-press'
      }`}
    >
      <span className="flex w-4.5 flex-none text-accent-strong">{checked && <IconCheck size={18} aria-hidden />}</span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="text-body font-medium">{label}</span>
        {hint && <span className={`text-xs ${checked ? 'text-accent-soft-fg' : 'text-fg-secondary'}`}>{hint}</span>}
      </span>
    </button>
  )
}
