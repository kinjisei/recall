// ============================================================================
// Свайп-карточка колоды: тап — 3D-переворот (обратная грань с переводом и
// примером), свайп вправо — «Помню» (good), влево — «Ещё раз» (again).
// Анимация на pointer-событиях: карточка тянется за пальцем/мышью,
// наклоняется, показывает штамп направления и улетает за порогом.
// ============================================================================
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  HandTapIcon,
  SpeakerHighIcon,
} from '@phosphor-icons/react'
import { speak } from '../../lib/speech'
import type { AppLang, Card as CardType } from '../../types'

const SWIPE_THRESHOLD = 90 // px до «улёта»

function SpeakButton({ text, lang }: { text: string; lang: AppLang }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        speak(text, { lang })
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.08] text-[var(--night-text-70)]"
      aria-label="Озвучить"
    >
      <SpeakerHighIcon size={18} />
    </button>
  )
}

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
      navigator.vibrate?.(10)
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
  const rememberOpacity = Math.min(1, Math.max(0, x) / SWIPE_THRESHOLD)
  const againOpacity = Math.min(1, Math.max(0, -x) / SWIPE_THRESHOLD)

  const faceCls =
    'absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.08] p-6 text-center [backface-visibility:hidden]'

  return (
    <div
      className="relative touch-pan-y select-none [perspective:1200px]"
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
      {/* переворачивающаяся плоскость: две грани спина к спине */}
      <div
        className="relative min-h-[55vh] transition-transform duration-[650ms] [transform-style:preserve-3d] [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* лицевая грань — слово */}
        <div className={faceCls} style={{ background: 'var(--night-surface)' }}>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold">{card.front}</p>
            <SpeakButton text={card.front} lang={lang} />
          </div>
          {card.ipa && <p className="text-[var(--night-text-40)]">/{card.ipa}/</p>}
          <p className="mt-6 flex items-center gap-1.5 text-sm text-[var(--night-text-40)]">
            <HandTapIcon size={16} /> тапни — увидишь перевод
          </p>
        </div>

        {/* обратная грань — перевод и пример (заранее повёрнута на 180°) */}
        <div
          className={faceCls}
          style={{
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(150% 120% at 20% 0%, #262845, #1e2030 60%)',
            boxShadow: '0 18px 40px -24px rgba(145,132,217,.5)',
          }}
        >
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">{card.front}</p>
            <SpeakButton text={card.front} lang={lang} />
          </div>
          {card.back && (
            <p className="text-xl text-[var(--night-text-70)]">{card.back}</p>
          )}
          {card.example && (
            <p className="mt-2 text-sm italic text-[var(--night-text-40)]">«{card.example}»</p>
          )}
          <p className="mt-5 flex items-center gap-2 text-xs text-[var(--night-text-40)]">
            <ArrowLeftIcon size={14} /> ещё раз&nbsp;·&nbsp;помню <ArrowRightIcon size={14} />
          </p>
        </div>
      </div>

      {/* штампы направления — поверх, не участвуют во вращении */}
      <span
        className="absolute left-4 top-4 z-10 rounded-xl border-2 border-[var(--night-accent)] px-3 py-1 text-lg font-bold text-[var(--night-accent-text)]"
        style={{ opacity: rememberOpacity, transform: 'rotate(-12deg)' }}
      >
        Помню
      </span>
      <span
        className="absolute right-4 top-4 z-10 rounded-xl border-2 border-white/40 px-3 py-1 text-lg font-bold text-white/70"
        style={{ opacity: againOpacity, transform: 'rotate(12deg)' }}
      >
        Ещё раз
      </span>
    </div>
  )
}

/**
 * Обучающая подсказка для нового пользователя: полупрозрачный оверлей
 * со стрелками и «тапающей» рукой. Показывается один раз.
 */
export function SwipeTutorial({ onDismiss }: { onDismiss: () => void }) {
  // Портал в body — fixed-оверлей не должен зависеть от предков внутри <main>.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/60 px-8 backdrop-blur-[2px]"
      onClick={onDismiss}
    >
      <HandTapIcon size={56} className="animate-pulse text-white" />
      <p className="text-center text-lg font-semibold text-white">
        Тапни по карточке — увидишь перевод
      </p>
      <div className="flex w-full max-w-xs items-center justify-between text-white/90">
        <div className="flex flex-col items-center gap-1">
          <ArrowLeftIcon size={36} className="animate-pulse" />
          <span className="text-center text-sm">свайп влево
            <br />
            <span className="font-bold text-white/80">ещё раз</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ArrowRightIcon size={36} className="animate-pulse" />
          <span className="text-center text-sm">свайп вправо
            <br />
            <span className="font-bold text-[var(--night-accent-text)]">помню</span>
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-white/60">
        «Ещё раз» — слово скоро вернётся. Нажми, чтобы начать.
      </p>
    </div>,
    document.body,
  )
}
