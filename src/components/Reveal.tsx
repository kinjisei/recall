// ============================================================================
// Раскрывашка, которая разворачивается, а не прыгает.
//
// Идея из ActivitiesCard / DisclosureCard (подборка владельца). Там высоту
// меряют через ResizeObserver и анимируют её; здесь то же делает CSS-грид
// (0fr → 1fr, см. .reveal в index.css) — без измерений и без библиотеки.
//
// ⚠️ Содержимое монтируется ТОЛЬКО пока раскрыто. Иначе «Фразовые глаголы»
// держали бы в дереве все 476 строк сразу, а «Неправильные» — пять таблиц:
// ради анимации платить постоянной работой на телефоне нельзя.
// ============================================================================
import { useEffect, useState, type ReactNode } from 'react'

export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Разворачиваем СЛЕДУЮЩИМ кадром: если поставить открытое состояние в том
      // же кадре, что и монтирование, браузеру не с чего анимировать.
      // Таймер-дублёр — на случай фоновой вкладки, где кадры не выдаются вовсе.
      const raf = requestAnimationFrame(() => setShown(true))
      const fallback = window.setTimeout(() => setShown(true), 60)
      return () => {
        cancelAnimationFrame(raf)
        window.clearTimeout(fallback)
      }
    }
    setShown(false)
    // размонтируем после анимации закрытия (0.32s в .reveal + запас)
    const t = window.setTimeout(() => setMounted(false), 360)
    return () => window.clearTimeout(t)
  }, [open])

  if (!mounted) return null
  return (
    <div className="reveal" data-open={shown}>
      <div>{children}</div>
    </div>
  )
}
