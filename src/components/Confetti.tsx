// ============================================================================
// Празднование: короткая вибрация + падающие частицы поверх экрана.
// Вызов — celebrate() из любого места; оверлей рисуется порталом в body и
// сам исчезает через ~2.2с. Ничего не блокирует (pointer-events: none).
//
// Триггеры: финал онбординга, весь дневной план выполнен, новый рекорд серии,
// сданное задание преподавателю.
// ============================================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const COLORS = ['#9184d9', '#b9b0e8', '#cfc8f0', '#6f63b8']
const COUNT = 12
const LIFETIME = 2200

/** Внутреннее событие — чтобы celebrate() можно было звать откуда угодно. */
const EVENT = 'recall:celebrate'

/** Запустить празднование: вибрация (если поддерживается) + конфетти. */
export function celebrate(): void {
  try {
    navigator.vibrate?.([20, 40, 20])
  } catch {
    // вибрация не обязательна
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

interface Piece {
  id: number
  left: number
  color: string
  delay: number
  duration: number
  round: boolean
  size: number
}

function makePieces(seed: number): Piece[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    id: seed * COUNT + i,
    left: (i / COUNT) * 100 + Math.random() * 6,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.5,
    duration: 1.4 + Math.random() * 0.5,
    round: i % 3 === 0,
    size: 7 + Math.round(Math.random() * 5),
  }))
}

/**
 * Слой конфетти. Монтируется один раз (в App) и ждёт события celebrate().
 * При prefers-reduced-motion ничего не рисует — остаётся только вибрация.
 */
export function ConfettiLayer() {
  const [bursts, setBursts] = useState<{ id: number; pieces: Piece[] }[]>([])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let seed = 0
    const onCelebrate = () => {
      const id = ++seed
      setBursts((b) => [...b, { id, pieces: makePieces(id) }])
      window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), LIFETIME)
    }
    window.addEventListener(EVENT, onCelebrate)
    return () => window.removeEventListener(EVENT, onCelebrate)
  }, [])

  if (bursts.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {bursts.flatMap((b) =>
        b.pieces.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 block"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              animation: `confetti-fall ${p.duration}s cubic-bezier(.3,.7,.5,1) ${p.delay}s forwards`,
            }}
          />
        )),
      )}
    </div>,
    document.body,
  )
}
