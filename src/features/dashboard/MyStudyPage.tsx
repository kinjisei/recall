// ============================================================================
// Адрес /learn — «Моя учёба» учителя (PLAN.md Ф2.10, Ф2.17-4г-1; журнал
// п.34, п.76 (9)): для репетитора, который сам учит язык. Разделы те же, что у
// ученика, — не дублируются.
// Телефон и содержимое уже 936 — макет t1-4б (решение владельца 05.10.2026:
// только сводка и плитки): язык и уровень, одна карточка (серия дней, неделя
// кружками, «Начать занятие») и три плитки столбиком — Учёба, Практика,
// Диалог (втроём в строку на 390 px подписи переносились по слову).
// Компьютер — макет d12 (LearnDesk): сводка, плитки «Учёбы» и «Практики»,
// «К повторению», карточка «Диалог» с последними репликами.
// Кто сюда пускается — таблица маршрутов: не-учителя уводит на его Главную.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { loadHomeActivity, type HomeActivity } from '../../lib/activity'
import { getEsLevel } from '../../lib/esLevel'
import { sessionCaption, type TodayPlanItem } from '../../lib/dailyPlan'
import { startGuidedRoute } from '../../lib/guided'
import { getCachedEnLevel, getProfile } from '../../lib/profile'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { AppLink } from '../../shared/ui/AppLink'
import { Button } from '../../shared/ui/Button'
import { LoadError } from '../../shared/ui/LoadError'
import { IconArrowRight, IconChevronRight, IconDialog, IconPractice, IconStudy, type IconLike } from '../../shared/ui/icons'
import { useAsideSplit } from '../../shared/ui/layouts'
import type { AppLang } from '../../types'
import { LearnDesk } from './LearnDesk'
import { STREAK_HERO, StreakCount, StreakGlow, WeekDots } from './StudyStreak'
import { useSessionSteps } from './useSessionSteps'

const TILES: { to: string; title: string; desc: string; Icon: IconLike }[] = [
  { to: '/study', title: 'Учёба', desc: 'Тексты, грамматика, словарь', Icon: IconStudy },
  { to: '/practice', title: 'Практика', desc: 'Повторение, речь, игры', Icon: IconPractice },
  { to: '/conversation', title: 'Диалог', desc: 'Разговор с AI', Icon: IconDialog },
]

/** Серия, неделя кружками с днями и «Начать занятие» — одной карточкой (t1-4б). */
function StreakCard({ activity, lang, steps }: { activity: HomeActivity; lang: AppLang; steps: TodayPlanItem[] | null }) {
  const navigate = useNavigate()
  return (
    <section className={`${STREAK_HERO} flex flex-col gap-3.5 p-4.5`}>
      <StreakGlow />
      {/* узкий телефон — неделя переносится под число, прижатая вправо */}
      <div className="relative flex flex-wrap items-center gap-x-3.5 gap-y-3">
        <StreakCount streak={activity.streak} />
        <span className="ml-auto">
          <WeekDots week={activity.week} />
        </span>
      </div>
      {/* куда вести — решаем ДО перехода (как на Главной, StartButton); шаги — план дня */}
      <Button size="lg" className="relative w-full" onClick={() => void startGuidedRoute(lang, steps ?? undefined).then((r) => navigate(r))}>
        Начать занятие <IconArrowRight size={22} aria-hidden />
      </Button>
      {/* подпись — из шагов плана дня; пока считаем — держим место */}
      <span className="relative min-h-4.5 text-center text-note text-fg-secondary" data-start-caption>
        {steps ? sessionCaption(steps) : ''}
      </span>
    </section>
  )
}

export function MyStudyPage() {
  const { user } = useAuth()
  const { lang, setLang } = useLanguage()
  // компьютер (содержимое от 936) — d12; уже — телефонный t1-4б (журнал п.76 (9))
  const desk = useAsideSplit()
  // серия — из activity_log; не пришла — не рисуем «0 дней», а говорим о связи (Ф1.13)
  const activity = useAsyncData(loadHomeActivity, [user?.id], 'Не удалось загрузить серию занятий')
  // уровень — подпись: не знаем — не пишем (умолчание базы — не измеренный уровень)
  const profile = useAsyncData(() => (user ? getProfile(user.id) : Promise.resolve(null)), [user?.id])
  const level = lang === 'es' ? getEsLevel() : (profile.data?.level ?? getCachedEnLevel() ?? null)
  // «Начать занятие» — по плану дня; серия не пришла — сделанного не знаем, план целиком
  const steps = useSessionSteps(lang, activity.data?.todayTypes ?? (activity.error ? new Set() : null))

  if (desk) return <LearnDesk lang={lang} setLang={setLang} level={level} activity={activity} steps={steps} />

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Моя учёба</h1>
        {/* EN/ES — в шапке: у учителя из него берётся и язык домашки (до PLAN.md Ф3.6) */}
        <p className="mt-1 text-body text-fg-secondary">
          {lang === 'es' ? 'Испанский' : 'Английский'}
          {level ? ` · ${level}` : ''}
        </p>
      </header>

      {activity.error ? (
        <LoadError message={activity.error} onRetry={activity.reload} />
      ) : activity.data ? (
        <StreakCard activity={activity.data} lang={lang} steps={steps} />
      ) : (
        <div aria-hidden className="animate-skeleton h-52 rounded-card bg-skeleton" />
      )}

      <nav aria-label="Разделы учёбы" className="flex flex-col gap-2.5" data-learn-tiles>
        {TILES.map(({ to, title, desc, Icon }) => (
          <AppLink
            key={to}
            to={to}
            className="lift flex items-center gap-3.5 rounded-card bg-surface p-3.5 text-fg shadow-card ring-1 ring-tint/[0.06]"
          >
            <span className="flex size-11 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <Icon size={22} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold">{title}</span>
              <span className="text-xs leading-snug text-fg-muted">{desc}</span>
            </span>
            <IconChevronRight size={18} aria-hidden className="flex-none text-fg-muted" />
          </AppLink>
        ))}
      </nav>
    </div>
  )
}
