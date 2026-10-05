// ============================================================================
// «Начать занятие» на Главной: ведомая сессия слова → чтение → речь
// (`lib/guided.ts`). За 10 минут до урока и во время него главное — «Войти в
// урок», а эта кнопка становится второстепенной: «~15 минут · после урока»
// (макет u1-2, PLAN.md Ф2.9). Вынесена из DashboardPage — он не растёт.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { IconArrowRight } from '../../shared/ui/icons'
import { startGuidedRoute } from '../../lib/guided'
import type { AppLang } from '../../types'

export function StartButton({ lang, afterLesson }: { lang: AppLang; afterLesson: boolean }) {
  const navigate = useNavigate()
  return (
    // Куда вести — решаем ДО перехода, иначе хаб «Практика» открывается зря и
    // через несколько секунд сам меняется под пальцем (замер ревью 1А).
    <button
      onClick={() => void startGuidedRoute(lang).then((r) => navigate(r))}
      className={`lift animate-fade-up flex h-14.5 items-center justify-center gap-2.5 rounded-2xl border font-medium text-fg ${
        afterLesson ? 'border-tint/[0.08] bg-surface' : 'border-accent-line bg-linear-[135deg] from-cta to-cta-end shadow-raised'
      }`}
      style={{ animationDelay: '.12s' }}
    >
      <IconArrowRight size={22} className="text-accent-soft-fg" />
      <span className="flex flex-col items-start leading-tight">
        Начать занятие
        <span className="text-caption font-normal text-fg-muted">
          {afterLesson ? '~15 минут · после урока' : '~15 минут · слова → чтение → речь'}
        </span>
      </span>
    </button>
  )
}
