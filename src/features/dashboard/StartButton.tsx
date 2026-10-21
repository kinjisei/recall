// ============================================================================
// «Начать занятие» на Главной: ведомая сессия по плану дня (`lib/guided.ts`,
// журнал п.76 (10)). Главная кнопка, подпись под ней — из шагов плана: «~20
// минут · слова → грамматика → диалог» (макет u1-1: 60 px на телефоне;
// d4-v2: 56 в карточке с планом — `compact`). Учитель поменял план дня —
// поменялись и шаги, и подпись. За 10 минут до урока и во время него главное —
// «Войти в урок», а эта кнопка становится мягкой: «~20 минут · после урока»
// (u1-2, d4-v2-2; PLAN.md Ф2.9).
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { Button } from '../../shared/ui/Button'
import { IconArrowRight } from '../../shared/ui/icons'
import { sessionCaption, type TodayPlanItem } from '../../lib/dailyPlan'
import { startGuidedRoute } from '../../lib/guided'
import type { AppLang } from '../../types'

export function StartButton({
  lang,
  steps,
  afterLesson,
  compact = false,
}: {
  lang: AppLang
  /** Шаги занятия — `sessionSteps` плана дня. */
  steps: TodayPlanItem[]
  afterLesson: boolean
  compact?: boolean
}) {
  const caption = sessionCaption(steps)
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
        onClick={() => void startGuidedRoute(lang, steps).then((r) => navigate(r))}
        className={`font-semibold! ${height}`}
      >
        Начать занятие
        <IconArrowRight size={compact ? 20 : 22} aria-hidden />
      </Button>
      <p className="text-center text-note text-fg-muted">
        {afterLesson ? `${caption.split(' · ')[0]} · после урока` : caption}
      </p>
    </div>
  )
}
