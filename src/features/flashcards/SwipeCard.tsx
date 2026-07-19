// ============================================================================
// Свайп-карточка колоды: тап — переворот (появляется перевод и пример),
// свайп вправо — «знаю» (good), влево — «не знаю» (again).
// Анимация на pointer-событиях: карточка тянется за пальцем/мышью,
// наклоняется, подсвечивает направление и улетает за порогом.
// ============================================================================
import { useRef, useState } from 'react'
import { speak } from '../../lib/speech'
import type { AppLang, Card as CardType } from '../../types'

const SWIPE_THRESHOLD = 90 // px до «улёта»

export function SwipeCard({
  card,
  lang,
  flipped,
  onFlip,
  onSwipe,
}: {
  card: CardType
  lang: AppLang
  flipped: boolean
  onFlip: () => void
  onSwipe: (dir: 'left' | 'right') => void
}) {
  const [dx, setDx] = useState(0)
  const [flying, setFlying] = useState<'left' | 'right' | null>(null)
  const drag = useRef<{ startX: number; moved: boolean; active: boolean }>({
    startX: 0,
    moved: false,
    active: false,
  })

  const onPointerDown = (e: React.PointerEvent) => {
    if (flying) return
    drag.current = { startX: e.clientX, moved: false, active: true }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active || flying) return
    const delta = e.clientX - drag.current.startX
    if (Math.abs(delta) > 6) drag.current.moved = true
    // свайпать можно только после переворота — сначала проверь себя
    if (flipped) setDx(delta)
  }

  const onPointerUp = () => {
    if (!drag.current.active || flying) return
    const wasDrag = drag.current.moved
    drag.current.active = false

    if (!wasDrag) {
      // это был тап
      if (!flipped) onFlip()
      setDx(0)
      return
    }
    if (!flipped) {
      setDx(0)
      return
    }
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      const dir = dx > 0 ? 'right' : 'left'
      setFlying(dir)
      // даём карточке улететь, потом сообщаем родителю
      setTimeout(() => onSwipe(dir), 220)
    } else {
      setDx(0) // возврат на место
    }
  }

  const fly = flying === 'right' ? 480 : flying === 'left' ? -480 : 0
  const x = flying ? fly : dx
  const rotate = x / 18
  const knowOpacity = Math.min(1, Math.max(0, x) / SWIPE_THRESHOLD)
  const dontOpacity = Math.min(1, Math.max(0, -x) / SWIPE_THRESHOLD)

  return (
    <div
      className="relative touch-pan-y select-none"
      style={{
        transform: `translateX(${x}px) rotate(${rotate}deg)`,
        transition:
          drag.current.active && !flying ? 'none' : 'transform 0.25s ease-out',
        opacity: flying ? 0 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="flex min-h-[55vh] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg dark:border-slate-700 dark:bg-slate-800">
        {/* индикаторы направления */}
        <span
          className="absolute left-4 top-4 rounded-xl border-2 border-emerald-500 px-3 py-1 text-lg font-bold text-emerald-500"
          style={{ opacity: knowOpacity, transform: 'rotate(-12deg)' }}
        >
          ЗНАЮ ✓
        </span>
        <span
          className="absolute right-4 top-4 rounded-xl border-2 border-red-500 px-3 py-1 text-lg font-bold text-red-500"
          style={{ opacity: dontOpacity, transform: 'rotate(12deg)' }}
        >
          ✗ НЕ ЗНАЮ
        </span>

        <div className="flex items-center gap-2">
          <p className="text-3xl font-bold">{card.front}</p>
          <button
            onClick={(e) => {
              e.stopPropagation()
              speak(card.front, { lang })
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-lg dark:bg-slate-700"
            aria-label="Озвучить"
          >
            🔊
          </button>
        </div>
        {card.ipa && <p className="text-slate-400">/{card.ipa}/</p>}

        {flipped ? (
          <div className="mt-3 w-full border-t border-slate-200 pt-4 dark:border-slate-700">
            {card.back && (
              <p className="text-xl text-slate-700 dark:text-slate-200">{card.back}</p>
            )}
            {card.example && (
              <p className="mt-3 text-sm italic text-slate-500">«{card.example}»</p>
            )}
            <p className="mt-5 text-xs text-slate-400">
              ⇦ не знаю&nbsp;&nbsp;·&nbsp;&nbsp;знаю ⇨
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-400">тапни — увидишь перевод</p>
        )}
      </div>
    </div>
  )
}

/**
 * Обучающая подсказка для нового пользователя: полупрозрачный оверлей
 * со стрелками и покачивающейся рукой. Показывается один раз.
 */
export function SwipeTutorial({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/60 px-8 backdrop-blur-[2px]"
      onClick={onDismiss}
    >
      <p className="animate-pulse text-6xl">👆</p>
      <p className="text-center text-lg font-semibold text-white">
        Тапни по карточке — увидишь перевод
      </p>
      <div className="flex w-full max-w-xs items-center justify-between text-white/90">
        <div className="flex flex-col items-center gap-1">
          <span className="animate-pulse text-4xl">⇦</span>
          <span className="text-sm">свайп влево
            <br />
            <span className="font-bold text-red-300">не знаю</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-right">
          <span className="animate-pulse text-4xl">⇨</span>
          <span className="text-sm">свайп вправо
            <br />
            <span className="font-bold text-emerald-300">знаю</span>
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-white/60">
        «Не знаю» — слово скоро вернётся. Нажми, чтобы начать.
      </p>
    </div>
  )
}
