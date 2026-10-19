// ============================================================================
// «Начать занятие» на Главной: ведомая сессия слова → чтение → речь
// (`lib/guided.ts`). Обычная главная кнопка 60 px, подпись — под ней (макет
// u1-1; градиентной подложки cta больше нет, лист s2). За 10 минут до урока и
// во время него главное — «Войти в урок», а эта кнопка становится мягкой:
// «~15 минут · после урока» (макет u1-2, PLAN.md Ф2.9). Вынесена из
// DashboardPage — он не растёт.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { Button } from '../../shared/ui/Button'
import { IconArrowRight } from '../../shared/ui/icons'
import { startGuidedRoute } from '../../lib/guided'
import type { AppLang } from '../../types'

export function StartButton({ lang, afterLesson }: { lang: AppLang; afterLesson: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="animate-fade-up flex flex-col gap-2" style={{ animationDelay: '.12s' }}>
      {/* Куда вести — решаем ДО перехода, иначе хаб «Практика» открывается
          зря и через несколько секунд сам меняется под пальцем (замер ревью 1А). */}
      <Button
        variant={afterLesson ? 'secondary' : 'primary'}
        size={afterLesson ? 'md' : 'lg'}
        onClick={() => void startGuidedRoute(lang).then((r) => navigate(r))}
        className={afterLesson ? 'h-13' : 'h-15'}
      >
        Начать занятие
        <IconArrowRight size={22} />
      </Button>
      <p className="text-center text-note text-fg-muted">
        {afterLesson ? '~15 минут · после урока' : '~15 минут · слова → чтение → речь'}
      </p>
    </div>
  )
}
