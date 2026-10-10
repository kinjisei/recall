// ============================================================================
// Адрес /learn — «Моя учёба» учителя (PLAN.md Ф2.10, макет t1-4б; журнал
// п.34): для репетитора, который сам учит язык. Сводка — язык и уровень, одна
// карточка (серия дней, неделя кружками, «Начать занятие») — и три плитки в
// разделы ученика: Учёба, Практика, Диалог. Сами разделы те же, что у
// ученика, — не дублируются. Решение владельца 05.10.2026: только сводка и
// плитки, без плана дня и слова дня (они остаются на Главной ученика).
// На телефоне плитки — столбиком (Ф2.11б-2): втроём в строку на 390 px
// подписи переносились по слову и плитки выходили разной высоты; компьютер —
// тремя колонками (пустоты на нём — Ф2.19).
// Кто сюда пускается — таблица маршрутов: не-учителя уводит на его Главную.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { loadHomeActivity, type HomeActivity } from '../../lib/activity'
import { getEsLevel } from '../../lib/esLevel'
import { startGuidedRoute } from '../../lib/guided'
import { getCachedEnLevel, getProfile } from '../../lib/profile'
import { plural } from '../../shared/lib/plural'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { AppLink } from '../../shared/ui/AppLink'
import { Button } from '../../shared/ui/Button'
import { LoadError } from '../../shared/ui/LoadError'
import { IconArrowRight, IconChevronRight, IconDialog, IconFlame, IconPractice, IconStudy, type IconLike } from '../../shared/ui/icons'
import type { AppLang } from '../../types'

const TILES: { to: string; title: string; desc: string; Icon: IconLike }[] = [
  { to: '/study', title: 'Учёба', desc: 'Тексты, грамматика, словарь', Icon: IconStudy },
  { to: '/practice', title: 'Практика', desc: 'Повторение, речь, игры', Icon: IconPractice },
  { to: '/conversation', title: 'Диалог', desc: 'Разговор с AI', Icon: IconDialog },
]

/** Серия, неделя кружками и «Начать занятие» — одной карточкой (t1-4б). */
function StreakCard({ activity, lang }: { activity: HomeActivity; lang: AppLang }) {
  const navigate = useNavigate()
  const { streak, week } = activity
  const done = week.filter((d) => d.active).map((d) => d.label)
  return (
    <section className="relative flex flex-col gap-3.5 overflow-hidden rounded-3xl border border-accent/30 bg-radial-[130%_120%_at_0%_0%] from-hero via-hero-mid via-55% to-hero-edge p-4.5">
      <div aria-hidden className="pointer-events-none absolute -right-18 -top-20 size-60 rounded-full bg-radial-[circle] from-hero-glow to-transparent to-70%" />
      <div className="relative flex items-center gap-3.5">
        <span className="flex size-12 flex-none items-center justify-center rounded-full bg-accent text-accent-fg">
          <IconFlame size={24} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-3xl font-bold leading-none tabular-nums">{streak}</span>
          <span className="text-sm text-accent-soft-fg">{plural(streak, 'день подряд', 'дня подряд', 'дней подряд')}</span>
        </span>
        <span
          role="img"
          aria-label={done.length ? `На этой неделе занимался: ${done.join(', ')}` : 'На этой неделе ещё не занимался'}
          className="flex flex-none gap-1.5"
        >
          {week.map((d) => (
            <i key={d.day} className={`size-3 rounded-full ${d.active ? 'bg-accent' : 'border-2 border-dashed border-accent/50'}`} />
          ))}
        </span>
      </div>
      {/* куда вести — решаем ДО перехода (как на Главной, StartButton) */}
      <Button className="relative h-14 w-full rounded-2xl text-lg" onClick={() => void startGuidedRoute(lang).then((r) => navigate(r))}>
        Начать занятие <IconArrowRight size={22} aria-hidden />
      </Button>
      <span className="relative text-center text-note text-fg-secondary">~15 минут · слова → чтение → речь</span>
    </section>
  )
}

export function MyStudyPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  // серия — из activity_log; не пришла — не рисуем «0 дней», а говорим о связи (Ф1.13)
  const activity = useAsyncData(loadHomeActivity, [user?.id], 'Не удалось загрузить серию занятий')
  // уровень — подпись: не знаем — не пишем (умолчание базы — не измеренный уровень)
  const profile = useAsyncData(() => (user ? getProfile(user.id) : Promise.resolve(null)), [user?.id])
  const level = lang === 'es' ? getEsLevel() : (profile.data?.level ?? getCachedEnLevel() ?? null)

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
        <StreakCard activity={activity.data} lang={lang} />
      ) : (
        <div aria-hidden className="h-52 animate-pulse rounded-3xl border border-accent-line bg-tint/[0.04]" />
      )}

      <nav aria-label="Разделы учёбы" className="grid grid-cols-1 gap-2.5 lg:grid-cols-3" data-learn-tiles>
        {TILES.map(({ to, title, desc, Icon }) => (
          <AppLink
            key={to}
            to={to}
            className="lift flex items-center gap-3.5 rounded-3xl bg-surface p-3.5 text-fg shadow-card ring-1 ring-tint/[0.06] lg:min-h-33 lg:flex-col lg:items-start lg:justify-between lg:gap-4"
          >
            <span className="flex size-11 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <Icon size={22} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold">{title}</span>
              <span className="text-xs leading-snug text-fg-muted">{desc}</span>
            </span>
            <IconChevronRight size={18} aria-hidden className="flex-none text-fg-muted lg:hidden" />
          </AppLink>
        ))}
      </nav>
    </div>
  )
}
