// ============================================================================
// Число, которое меняется на глазах, а не скачком.
//
// Заведено ради энергии ⚡: это валюта продукта, и когда после проверки эссе
// «12» мгновенно превращается в «10», человек не видит СОБЫТИЯ — он видит
// другое число и гадает, всегда ли так было. Отсчёт показывает цену действия.
//
// Сознательно НЕ применяется к стрику и счётчику верных ответов в раунде:
// стрик меняется раз в сутки и обычно не на глазах, а счётчик растёт на
// единицу — отсчёт от 3 до 4 никто не различит. Анимация без события —
// украшение, а его правило в docs/motion-plan.md запрещает.
// ============================================================================
import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 450): number {
  const [shown, setShown] = useState(target)
  const prev = useRef(target)

  useEffect(() => {
    const from = prev.current
    prev.current = target
    if (from === target) return

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setShown(target)
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(from + (target - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // размонтирование посреди отсчёта не должно оставлять висящий кадр
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  // Первый показ — сразу настоящее значение: отсчёт «с нуля» на каждой
  // загрузке экрана был бы фокусом, а не сообщением о событии.
  return shown
}
