// ============================================================================
// «Моя учёба» на компьютере (макет d12; содержимое от 936 — уже остаётся
// телефонный t1-4б в MyStudyPage, журнал п.76 (9)). Сверху «Моя учёба» и
// «видишь только ты · ученики сюда не попадают», сводка одной карточкой:
// язык и уровень с EN/ES, серия дней, «Начать занятие». Ниже `MainAside
// fill`: слева «Учёба» (шесть плиток — те же разделы, что в хабе «Учёбы») и
// «Практика» (сколько слов к повторению или «всё повторено», три плитки),
// справа «Диалог» (LearnDialog). Разделы — те же экраны, что у ученика.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { countDueCards } from '../../lib/fsrs'
import { startGuidedRoute } from '../../lib/guided'
import type { HomeActivity } from '../../lib/activity'
import { almatyInstant, almatyToday } from '../../shared/lib/almaty'
import { plural } from '../../shared/lib/plural'
import type { AsyncData } from '../../shared/lib/useAsyncData'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { AppLink } from '../../shared/ui/AppLink'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import {
  IconBars,
  IconBook,
  IconCards,
  IconCheck,
  IconChevronRight,
  IconGraduation,
  IconMic,
  IconPencil,
  IconSparkle,
  IconText,
  IconUser,
  type IconLike,
} from '../../shared/ui/icons'
import { MainAside } from '../../shared/ui/layouts'
import { sessionCaption, type TodayPlanItem } from '../../lib/dailyPlan'
import { STREAK_HERO, StreakCount, StreakGlow, WeekDots } from './StudyStreak'
import { LoadError } from '../../shared/ui/LoadError'
import type { AppLang } from '../../types'
import { LearnDialog } from './LearnDialog'

const LANG_NAME: Record<AppLang, string> = { en: 'Английский', es: 'Испанский' }

type Tile = { to: string; title: string; desc: string; Icon: IconLike }

function studyTiles(lang: AppLang, level: string | null): Tile[] {
  return [
    { to: '/study?view=reader', title: 'Чтение', desc: 'тексты и диалоги с разбором слов', Icon: IconBook },
    { to: '/grammar', title: 'Грамматика', desc: lang === 'es' ? 'уроки A1–B2 и спряжения глаголов' : 'уроки A1–C1 и неправильные глаголы', Icon: IconGraduation },
    { to: '/study?view=words', title: 'Мой словарь', desc: 'наборы по уровням и свои слова', Icon: IconCards },
    { to: '/writing', title: 'Письмо', desc: 'AI разберёт по критериям экзамена', Icon: IconPencil },
    { to: '/self-material', title: 'Материал под себя', desc: 'AI соберёт текст под твой уровень', Icon: IconSparkle },
    level
      ? { to: '/placement', title: `Твой уровень: ${level}`, desc: 'пройти тест заново', Icon: IconBars }
      : { to: '/placement', title: 'Тест уровня', desc: 'узнать свой уровень', Icon: IconBars },
  ]
}

const PRACTICE: Tile[] = [
  { to: '/practice?g=words', title: 'Слова', desc: 'тренировка', Icon: IconText },
  { to: '/practice?g=grammar', title: 'Грамматика', desc: 'упражнения', Icon: IconGraduation },
  { to: '/practice?g=speech', title: 'Речь', desc: 'говорить вслух', Icon: IconMic },
]

/** Плитка раздела (d12 `.it12`): значок 38 на мягком акценте, название, пояснение, стрелка. */
function TileLink({ to, title, desc, Icon }: Tile) {
  return (
    <AppLink to={to} className="lift flex min-h-16.5 items-center gap-3 rounded-control bg-surface px-3 py-2.5 text-fg shadow-card">
      <span className="flex size-9.5 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
        <Icon size={20} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <b className="text-body font-semibold">{title}</b>
        <small className="text-note text-fg-secondary">{desc}</small>
      </span>
      <IconChevronRight size={18} aria-hidden className="flex-none text-fg-faint" />
    </AppLink>
  )
}

function Heading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mx-1 mt-1.5 -mb-0.5 flex items-baseline gap-2.5">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <small className="text-note text-fg-muted">{note}</small>
    </div>
  )
}

/** Конец завтрашнего дня по Алматы: «следующие слова — завтра», если к нему что-то подойдёт. */
const endOfTomorrow = (): Date => almatyInstant(almatyToday(2))

/** «К повторению: 9» с «Открыть повторение» или «На сегодня всё повторено» (d12 `.rep12`). */
function ReviewRow({ lang }: { lang: AppLang }) {
  const navigate = useNavigate()
  const due = useAsyncData(
    async () => {
      const now = await countDueCards(lang)
      return { now, soon: now ? now : await countDueCards(lang, endOfTomorrow()) }
    },
    [lang],
    'Не удалось узнать, сколько слов к повторению',
  )
  if (due.error) return <LoadError message={due.error} onRetry={due.reload} />
  const n = due.data?.now ?? null
  return (
    <div className="flex min-h-17 items-center gap-3.5 rounded-control bg-surface py-3 pl-4 pr-3 shadow-card" data-learn-review>
      {n === null ? (
        <span className="animate-skeleton h-11 w-full rounded-control-sm bg-skeleton" />
      ) : n > 0 ? (
        <>
          <span className="flex h-11 min-w-11 flex-none items-center justify-center rounded-control-sm bg-warning-soft px-2 text-lg font-bold tabular-nums text-warning-soft-fg">
            {n > 99 ? '99+' : n}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-snug">
            <b className="text-base font-semibold text-fg">К повторению: {n > 99 ? '99+' : n}</b>
            <small className="text-note text-fg-secondary">{plural(n, 'слово', 'слова', 'слов')}, у которых подошёл срок</small>
          </span>
          <Button variant="secondary" onClick={() => navigate('/practice?g=review')}>
            Открыть повторение
          </Button>
        </>
      ) : (
        <>
          <span className="flex size-11 flex-none items-center justify-center rounded-control-sm bg-success-soft text-success-soft-fg">
            <IconCheck size={20} aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-snug">
            <b className="text-base font-semibold text-fg">На сегодня всё повторено</b>
            <small className="text-note text-fg-secondary">{due.data?.soon ? 'следующие слова — завтра' : 'новых слов к повторению пока нет'}</small>
          </span>
        </>
      )}
    </div>
  )
}

export function LearnDesk({
  lang,
  setLang,
  level,
  activity,
  steps,
}: {
  lang: AppLang
  setLang: (l: AppLang) => void
  level: string | null
  activity: AsyncData<HomeActivity>
  /** Шаги «Начать занятие» — план дня (useSessionSteps); null — ещё считаем. */
  steps: TodayPlanItem[] | null
}) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-4">
      <header className="flex min-h-10 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Моя учёба</h1>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-note font-medium text-fg-secondary inset-ring inset-ring-line">
          <IconUser size={14} aria-hidden /> видишь только ты · ученики сюда не попадают
        </span>
      </header>

      {/* серия — как на телефоне (фон, пламя, неделя с днями), кнопка — справа (решение владельца 22.10) */}
      <section aria-label="Сводка" className={`${STREAK_HERO} flex items-center gap-5 py-4 pl-5.5 pr-4.5`} data-learn-summary>
        <StreakGlow />
        <div className="relative flex flex-col gap-2">
          <b className="text-xl font-semibold tracking-tight">
            {LANG_NAME[lang]}
            {level ? ` · ${level}` : ''}
          </b>
          <ChoiceGroup variant="segment" label="Язык учёбы" options={[{ id: 'en', label: 'EN' }, { id: 'es', label: 'ES' }]} value={lang} onChange={setLang} />
        </div>
        <div className="relative flex items-center gap-3.5 self-stretch border-x border-accent/20 px-5">
          {activity.error ? (
            <button type="button" onClick={activity.reload} className="flex min-h-11 flex-col items-start text-left text-note text-fg-secondary">
              серия не загрузилась
              <span className="font-medium text-accent-strong">Повторить</span>
            </button>
          ) : activity.data ? (
            <>
              <StreakCount streak={activity.data.streak} />
              <span className="ml-2">
                <WeekDots week={activity.data.week} />
              </span>
            </>
          ) : (
            <span className="animate-skeleton h-12 w-64 rounded-lg bg-skeleton" />
          )}
        </div>
        <div className="relative ml-auto flex min-w-65 flex-col gap-1.5">
          {/* куда вести — решаем ДО перехода (как на Главной, StartButton); шаги — план дня */}
          <Button size="lg" onClick={() => void startGuidedRoute(lang, steps ?? undefined).then((r) => navigate(r))}>
            Начать занятие
          </Button>
          {/* подпись — из шагов плана дня: учитель поменял план — поменялась и она */}
          <small className="min-h-4.5 text-center text-note text-fg-secondary" data-start-caption>
            {steps ? sessionCaption(steps) : ''}
          </small>
        </div>
      </section>

      <MainAside
        size="fill"
        label="Диалог"
        main={
          <div className="flex flex-col gap-3">
            <Heading title="Учёба" note="тексты, грамматика, словарь" />
            <nav aria-label="Учёба" className="grid grid-cols-2 gap-2" data-learn-tiles>
              {studyTiles(lang, level).map((t) => (
                <TileLink key={t.to} {...t} />
              ))}
            </nav>
            <Heading title="Практика" note="повторение и тренировки" />
            <ReviewRow lang={lang} />
            <nav aria-label="Практика" className="grid grid-cols-3 gap-2">
              {PRACTICE.map((t) => (
                <TileLink key={t.to} {...t} />
              ))}
            </nav>
          </div>
        }
        aside={<LearnDialog lang={lang} />}
      />
    </div>
  )
}
