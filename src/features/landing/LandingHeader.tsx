// ============================================================================
// Шапка лендинга для гостя (макет d15, .lhd): логотип и «Войти», держится при
// прокрутке. Прокрутил мимо главной кнопки первого экрана — в шапке
// появляется «Попробовать 14 дней бесплатно» (подпись на кадре d15-2); на
// телефоне ей уступают место слово Recall и «Войти» (знак остаётся). Фон —
// стекло темы, не тёмный литерал (в светлой теме шапка была серой).
// ============================================================================
import { useEffect, useState, type RefObject } from 'react'
import { AppLink } from '../../shared/ui/AppLink'
import { BrandMark } from '../../shared/ui/Brand'
import { CTA } from './LandingParts'

/** Ушла ли главная кнопка первого экрана вверх за край окна. */
export function useScrolledPast(ref: RefObject<HTMLElement | null>, on: boolean): boolean {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!on || !el) return
    const io = new IntersectionObserver(([e]) => e && setPast(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [ref, on])
  return past
}

export function LandingHeader({ pad, showCta }: { pad: string; showCta: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-glass pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className={`flex h-18 items-center gap-4 ${pad}`}>
        <span className="flex items-center gap-2.5 text-lg font-semibold text-fg">
          <BrandMark size={30} />
          <span className={showCta ? 'hidden @md/landing:inline' : undefined}>Recall</span>
        </span>
        <span className="flex-1" />
        <AppLink
          to="/login?role=teacher"
          className={`min-h-11 items-center rounded-control-sm px-3 text-body font-medium text-accent-strong ${showCta ? 'hidden @md/landing:flex' : 'flex'}`}
        >
          Войти
        </AppLink>
        {showCta && <CTA size="sm" className="animate-fade-in" />}
      </div>
    </header>
  )
}
