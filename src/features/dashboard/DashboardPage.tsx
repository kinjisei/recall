// ============================================================================
// Главная в теме «Nocturne».
// Порядок: приветствие → ближайший урок (Ф2.9, макет u1) → стрик-герой (с
// неделей) → новое задание учителя → «Начать занятие» → план на сегодня →
// слово дня → сданное задание/учитель. За 10 минут до урока и во время него
// главное — «Войти в урок», «Начать занятие» становится второстепенной (u1-2).
// Данные берём из уже существующих источников: activity_log (стрик, неделя,
// сделанное сегодня) и FSRS (карточки к повторению, слово дня).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import {
  IconGap,
  IconCheck,
  IconMic,
  IconDialog,
  IconHint,
  IconCards,
  IconRows,
  type IconLike,
} from '../../shared/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { logActivity } from '../../lib/activity'
import { buildTodayPlan, isPerfectDay } from '../../lib/dailyPlan'
import { countDueCards } from '../../lib/fsrs'
import { cachedWordOfDay, newWordOfDay, type PoolItem } from '../../lib/wordPool'
import { countMyWords } from '../../lib/cards'
import { getEsLevel } from '../../lib/esLevel'
import { EnergyBar } from '../../components/EnergyBar'
import { RowCard } from '../../shared/ui/RowCard'
import { HowItWorks } from '../../shared/ui/HowItWorks'
import { HOW_IT_WORKS } from '../../data/howItWorks'
import { AssignmentsNotice, TeacherBlock } from '../teacher'
import { LoadError } from '../../shared/ui/LoadError'
import { LessonPushAsk, NextLessonCard, useNextLesson } from '../lessons'
import { useHomeData } from './useHomeData'
import { StreakHero } from './StreakHero'
import { WordOfDay } from './WordOfDay'
import { StartButton } from './StartButton'
import type { ActivityType } from '../../types'

/** Иконки пунктов плана дня (сами пункты строит lib/dailyPlan). */
const PLAN_ICONS: Record<string, IconLike> = {
  words: IconCards,
  reader: IconGap,
  grammar: IconHint,
  pronunciation: IconMic,
  conversation: IconDialog,
  assignment: IconGap,
  quest: IconHint,
}

export function DashboardPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  // первый кадр: все входы разом, без выдуманных нулей при сбое связи (useHomeData)
  const { data: home, ready, failed, reload } = useHomeData(user?.id)
  // ближайший урок ученика (Ф2.9): за 10 минут до начала — главное на экране
  const next = useNextLesson(home?.lessons ?? null)
  const profile = home?.profile ?? null
  const assignments = home?.assignments ?? null
  const planInputs = home?.planInputs ?? null
  /** Слово дня ещё считается: место под него держим, чтобы низ не прыгал. */
  const [wordPending, setWordPending] = useState(true)
  // сделанное сегодня — из activity_log, плюс «идеальный день», отмеченный здесь
  const [markedPerfect, setMarkedPerfect] = useState(false)
  const doneToday = useMemo(() => {
    const done = new Set<ActivityType>(home?.activity?.todayTypes ?? [])
    if (markedPerfect) done.add('perfect')
    return done
  }, [home, markedPerfect])
  const [dueCount, setDueCount] = useState<number | null>(null)
  // сколько всего своих слов: 0 — колода пуста, новичка не путаем «Всё повторено»
  const [wordCount, setWordCount] = useState<number | null>(null)
  const [wordOfDay, setWordOfDay] = useState<PoolItem | null>(null)

  useEffect(() => {
    if (!user) return
    // alive: при быстром переключении EN/ES ответ по старому языку не должен
    // перетирать данные нового
    let alive = true
    setDueCount(null)
    setWordCount(null)
    setWordOfDay(null)
    // счётчик — лёгкие count-запросы, без выкачивания строк карточек
    countDueCards(lang)
      .then((n) => alive && setDueCount(Math.min(n, 99)))
      .catch(() => {})
    countMyWords(lang)
      .then((n) => alive && setWordCount(n))
      .catch(() => {})

    // Слово дня — НОВОЕ слово из пака уровня с кнопкой «В колоду».
    // Кэш на день читаем сразу; полный расчёт тянет ленивый чанк словаря
    // (ES ~836 КБ), поэтому первую загрузку откладываем до простоя браузера,
    // чтобы не конкурировать с первым рендером Главной.
    const cached = cachedWordOfDay(lang)
    let idleId = 0
    let usedIdle = false
    setWordPending(true)
    if (cached !== undefined) {
      setWordOfDay(cached)
      setWordPending(false)
    } else {
      const load = () => {
        newWordOfDay(lang)
          .then((w) => alive && setWordOfDay(w))
          .catch(() => {})
          .finally(() => alive && setWordPending(false))
      }
      if (typeof requestIdleCallback === 'function') {
        usedIdle = true
        idleId = requestIdleCallback(load, { timeout: 3000 })
      } else {
        idleId = window.setTimeout(load, 1500)
      }
    }
    return () => {
      alive = false
      if (idleId) {
        if (usedIdle) cancelIdleCallback(idleId)
        else window.clearTimeout(idleId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, lang])

  const name = profile?.display_name || user?.email?.split('@')[0] || 'друг'
  const esLevel = lang === 'es' ? getEsLevel() : null
  // ⚠️ Не подставляем B1: раньше приложение уверенно писало уровень, которого
  // никто не измерял (умолчание колонки в базе). Не знаем — не говорим.
  const level = lang === 'es' ? esLevel : (profile?.level ?? null)
  const didToday = doneToday.size > 0

  // план на сегодня — ТОЛЬКО когда все входы загружены (иначе null)
  const todayPlan = planInputs
    ? buildTodayPlan(planInputs.dailyCfg, {
        pendingAssignments: assignments?.pending ?? 0,
        activeQuests: planInputs.activeQuests,
        weekday: new Date().getDay(),
      })
    : null
  const doneCount = todayPlan
    ? todayPlan.filter((p) => p.types.some((t) => doneToday.has(t))).length
    : 0
  const allDone = todayPlan !== null && doneCount === todayPlan.length
  const perfect = todayPlan !== null && isPerfectDay(todayPlan, doneToday)

  // «идеальный день»: фиксируем один раз и только по ПОЛНОМУ плану
  useEffect(() => {
    if (perfect && !doneToday.has('perfect')) {
      void logActivity('perfect', 0)
      setMarkedPerfect(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfect])

  // Пустая колода ≠ «всё повторено»: новичку без единого слова предлагаем
  // добавить первые (плитка ведёт в «Учёбу», где живут паки и добавление).
  const emptyDeck = wordCount === 0
  const dueLabel = emptyDeck
    ? 'Добавь первые слова'
    : dueCount === null
      ? 'Повторить и потренировать'
      : dueCount === 0
        ? 'Всё повторено'
        : `К повторению: ${dueCount}${dueCount >= 99 ? '+' : ''}`

  if (!ready) return <HomeSkeleton />

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Приветствие */}
      <header className="animate-fade-up">
        <h1 className="text-2xl font-medium tracking-tight">Привет, {name}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {lang === 'es' ? 'Испанский' : 'Английский'}
          {level ? ` · ${level}` : ''} ·{' '}
          {didToday ? 'сегодня уже занимался' : 'готов к практике?'}
        </p>
        <div className="mt-2">
          <HowItWorks>{HOW_IT_WORKS.dashboard}</HowItWorks>
        </div>
      </header>

      {/* 1б. Не всё пришло — говорим о связи, а не рисуем «0» (Ф1.13) */}
      {failed > 0 && (
        <LoadError
          message="Часть главной не загрузилась — похоже, пропала связь. Слова, тексты и грамматика работают и без интернета."
          onRetry={reload}
        />
      )}

      {/* 1в. Ближайший урок и просьба включить уведомления (Ф2.9, макеты u1, u3) */}
      {next.lesson && <NextLessonCard lesson={next.lesson} urgent={next.urgent} now={next.now} />}
      <LessonPushAsk hasLessons={next.lesson !== null} />

      {/* 2. Стрик-герой (скелетон, пока не пришёл activity_log — чтобы не мигать «0»;
          не пришёл совсем — героя нет: серию мы не знаем) */}
      {!home ? (
        <div
          aria-hidden
          className="h-[196px] animate-pulse rounded-3xl border border-accent-line bg-tint/[0.04]"
        />
      ) : home.activity && (
        <StreakHero streak={home.activity.streak} week={home.activity.week} didToday={didToday} perfect={perfect} />
      )}

      {/* 2б. Энергия AI (E3): дневной запас на разговоры с ИИ */}
      {home?.myPlan && <EnergyBar plan={home.myPlan} className="animate-fade-up" />}

      {/* 3. Новое задание от преподавателя */}
      <AssignmentsNotice placement="top" counts={assignments} />

      {/* 3б. Новая программа обучения (гаснет после открытия /program) */}
      {home?.newProgram && (
        <RowCard
          Icon={IconRows}
          title="Тебе назначили программу обучения"
          desc={`${home.newProgram.lang.toUpperCase()} · ${home.newProgram.weeks.length} нед. — посмотри план на эту неделю`}
          to="/program"
          active
          className="animate-fade-up"
        />
      )}

      {/* 4. Начать занятие — за 10 минут до урока второстепенная (u1-2) */}
      <StartButton lang={lang} afterLesson={next.urgent} />

      {/* 5. План на сегодня: пункты от учителя или умный дефолт (lib/dailyPlan).
          Входы не пришли — плана не показываем: дефолт мог бы разойтись с учительским. */}
      {(!home || planInputs) && <section className="animate-fade-up" style={{ animationDelay: '.18s' }}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-medium tracking-tight">План на сегодня</h2>
          {todayPlan && (
            <span className={`text-sm ${perfect ? 'font-medium text-warning-strong' : allDone ? 'text-accent-strong' : 'text-fg-muted'}`}>
              {perfect ? 'Идеальный день ✦' : `${doneCount} из ${todayPlan.length} готово`}
            </span>
          )}
        </div>
        {todayPlan === null ? (
          // скелетоны, пока грузятся входы плана (настройка/задания/квесты)
          <div className="flex flex-col gap-2.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-tint/[0.04]" />
            ))}
          </div>
        ) : (
        <div className="flex flex-col gap-2.5">
          {todayPlan.map((p, i) => {
            const done = p.types.some((t) => doneToday.has(t))
            const isWords = p.key === 'words'
            return (
              <RowCard
                key={p.key}
                Icon={PLAN_ICONS[p.key] ?? IconGap}
                title={p.title}
                desc={done ? 'Готово · засчитано в серию' : isWords ? dueLabel : p.desc}
                to={isWords && emptyDeck ? '/study' : p.to}
                muted={done}
                active={!done && i === 0}
                trailing={
                  done ? (
                    <IconCheck
                      size={20}
                      className="flex-none text-accent"
                    />
                  ) : undefined
                }
                className="animate-fade-up"
                style={{ animationDelay: `${0.2 + i * 0.06}s` }}
              />
            )
          })}
        </div>
        )}
      </section>}

      {/* 6. Слово дня — новое слово уровня, можно сразу добавить в колоду.
          Считается отдельно: тянет ленивый чанк словаря (в ES ~836 КБ), поэтому
          ждать его в общем кадре нельзя. Но место под него держим — иначе
          через пару секунд оно раздвигает низ экрана под пальцем. */}
      {wordOfDay ? (
        <WordOfDay word={wordOfDay} lang={lang} />
      ) : wordPending ? (
        <div aria-hidden className="h-[104px] animate-pulse rounded-2xl bg-tint/[0.04]" />
      ) : null}

      {/* 7. Сданное задание уезжает вниз + блок преподавателя */}
      <AssignmentsNotice placement="bottom" counts={assignments} />
      <TeacherBlock profile={profile} />
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Скелетон Главной — повторяет РАСКЛАДКУ, а не просто «что-то серое».
 * Смысл в том, чтобы после загрузки ничего не сдвинулось: высоты блоков здесь
 * те же, что у настоящих (герой 196, кнопка 58, строки плана 74).
 */
function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Загружаем главную">
      <header>
        <div className="h-7 w-44 animate-pulse rounded-lg bg-tint/[0.06]" />
        <div className="mt-2 h-4 w-60 animate-pulse rounded bg-tint/[0.04]" />
      </header>
      <div className="h-[196px] animate-pulse rounded-3xl border border-accent-line bg-tint/[0.04]" />
      <div className="h-[86px] animate-pulse rounded-2xl bg-tint/[0.04]" />
      <div className="h-[58px] animate-pulse rounded-2xl border border-accent-line bg-tint/[0.04]" />
      <section>
        <div className="mb-3 h-6 w-40 animate-pulse rounded bg-tint/[0.06]" />
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-tint/[0.04]" />
          ))}
        </div>
      </section>
    </div>
  )
}
