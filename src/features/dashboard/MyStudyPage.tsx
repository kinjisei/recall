// ============================================================================
// Адрес /learn — «Моя учёба» учителя (PLAN.md Ф2.10, макет t1-4б; журнал
// п.34): для репетитора, который сам учит язык. Сводка — язык и уровень,
// серия дней, «Начать занятие» — и три плитки в разделы ученика: Учёба,
// Практика, Диалог. Сами разделы те же, что у ученика, — не дублируются.
// Решение владельца 05.10.2026: только сводка и плитки, без плана дня и
// слова дня (они остаются на Главной ученика).
// Кто сюда пускается — таблица маршрутов: не-учителя уводит на его Главную.
// ============================================================================
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { loadHomeActivity } from '../../lib/activity'
import { getEsLevel } from '../../lib/esLevel'
import { getCachedEnLevel, getProfile } from '../../lib/profile'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { AppLink } from '../../shared/ui/AppLink'
import { LoadError } from '../../shared/ui/LoadError'
import { IconDialog, IconPractice, IconStudy, type IconLike } from '../../shared/ui/icons'
import { StartButton } from './StartButton'
import { StreakHero } from './StreakHero'

const TILES: { to: string; title: string; desc: string; Icon: IconLike }[] = [
  { to: '/study', title: 'Учёба', desc: 'Тексты, грамматика, словарь', Icon: IconStudy },
  { to: '/practice', title: 'Практика', desc: 'Повторение, речь, игры', Icon: IconPractice },
  { to: '/conversation', title: 'Диалог', desc: 'Разговор с AI', Icon: IconDialog },
]

export function MyStudyPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  // серия — из activity_log; не пришла — не рисуем «0 дней», а говорим о связи (Ф1.13)
  const activity = useAsyncData(loadHomeActivity, [user?.id], 'Не удалось загрузить серию занятий')
  // уровень — подпись: не знаем — не пишем (умолчание базы — не измеренный уровень)
  const profile = useAsyncData(() => (user ? getProfile(user.id) : Promise.resolve(null)), [user?.id])
  const level = lang === 'es' ? getEsLevel() : (profile.data?.level ?? getCachedEnLevel() ?? null)
  const a = activity.data

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Моя учёба</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {lang === 'es' ? 'Испанский' : 'Английский'}
          {level ? ` · ${level}` : ''}
        </p>
      </header>

      {activity.error ? (
        <LoadError message={activity.error} onRetry={activity.reload} />
      ) : a ? (
        <StreakHero streak={a.streak} week={a.week} didToday={a.todayTypes.size > 0} />
      ) : (
        <div aria-hidden className="h-49 animate-pulse rounded-3xl border border-accent-line bg-tint/[0.04]" />
      )}

      <StartButton lang={lang} afterLesson={false} />

      <nav aria-label="Разделы учёбы" className="grid grid-cols-3 gap-3">
        {TILES.map(({ to, title, desc, Icon }) => (
          <AppLink
            key={to}
            to={to}
            className="lift flex flex-col gap-2 rounded-2xl border border-tint/[0.08] bg-surface p-3.5 text-fg shadow-card hover:border-tint/[0.14]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <Icon size={22} />
            </span>
            <span className="mt-auto text-body font-semibold">{title}</span>
            <span className="text-note leading-snug text-fg-muted">{desc}</span>
          </AppLink>
        ))}
      </nav>
    </div>
  )
}
