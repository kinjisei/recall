// ============================================================================
// «Начать занятие» на Главной: ведомая сессия слова → чтение → речь
// (`lib/guided.ts`). Главная кнопка, подпись «~15 минут · …» под ней (макет
// u1-1: 60 px на телефоне; d4-v2: 56 в карточке с планом — `compact`). За 10
// минут до урока и во время него главное — «Войти в урок», а эта кнопка
// становится мягкой: «~15 минут · после урока» (u1-2, d4-v2-2; PLAN.md Ф2.9).
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { Button } from '../../shared/ui/Button'
import { IconArrowRight } from '../../shared/ui/icons'
import { startGuidedRoute } from '../../lib/guided'
import type { AppLang } from '../../types'

export function StartButton({ lang, afterLesson, compact = false }: { lang: AppLang; afterLesson: boolean; compact?: boolean }) {
  const navigate = useNavigate()
  // телефон: 60 / мягкая 52 (u1); карточка компьютера: обе 56 (d4-v2)
  const height = compact ? '' : afterLesson ? 'h-13' : 'h-15'
  return (
    <div className={`animate-fade-up flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`} style={{ animationDelay: '.12s' }}>
      {/* Куда вести — решаем ДО перехода, иначе хаб «Практика» открывается
          зря и через несколько секунд сам меняется под пальцем (замер ревью 1А). */}
      <Button
        variant={afterLesson ? 'secondary' : 'primary'}
        size={afterLesson && !compact ? 'md' : 'lg'}
        onClick={() => void startGuidedRoute(lang).then((r) => navigate(r))}
        className={`font-semibold! ${height}`}
      >
        Начать занятие
        <IconArrowRight size={compact ? 20 : 22} aria-hidden />
      </Button>
      <p className="text-center text-note text-fg-muted">
        {afterLesson ? '~15 минут · после урока' : '~15 минут · слова → чтение → речь'}
      </p>
    </div>
  )
}
