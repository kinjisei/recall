// ============================================================================
// Главная ученика (макеты u1 — телефон, d4-v2 — компьютер, вариант 1б).
// Телефон и содержимое уже 936 — одна колонка: приветствие → ближайший урок
// → домашка → «Начать занятие» → серия → план → слово дня → энергия (за 10
// минут до урока: урок первым, «Начать занятие» — тихой, сразу под ним, u1-2).
// Компьютер — две равные колонки (EvenColumns): ряд пары — серия и урок (за
// 10 минут урок встаёт слева), ниже слева «Начать занятие» с планом одной
// карточкой, справа то, что сверяют: домашка, слово дня, энергия. Без урока —
// пары нет: серия уходит в правую колонку. Данные — из того, что уже есть:
// activity_log (серия, неделя, сделанное сегодня), FSRS (к повторению, слово
// дня), домашка, уроки (useHomeData — одним кадром).
// ============================================================================
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  IconBook,
  IconCards,
  IconClipboard,
  IconClipboardCheck,
  IconDialog,
  IconFlag,
  IconHint,
  IconMic,
  IconRows,
  type IconLike,
} from '../../shared/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { logActivity } from '../../lib/activity'
import { buildTodayPlan, isPerfectDay, sessionSteps, todayWeekday } from '../../lib/dailyPlan'
import { getEsLevel } from '../../lib/esLevel'
import { dueShort, homeworkProgress } from '../../lib/homework'
import { plural } from '../../shared/lib/plural'
import { EnergyBar } from '../../components/EnergyBar'
import { RowCard } from '../../shared/ui/RowCard'
import { EvenColumns, useEvenColumnsSplit } from '../../shared/ui/layouts'
import { TeacherBlock } from '../teacher'
import { LoadError } from '../../shared/ui/LoadError'
import { LessonPushAsk, NextLessonCard, useNextLesson } from '../lessons'
import { useHomeData, type HomeData } from './useHomeData'
import { useHomeWords } from './useHomeWords'
import { StreakHero } from './StreakHero'
import { WordOfDay } from './WordOfDay'
import { StartButton } from './StartButton'
import { PlanList, type PlanRow } from './PlanList'
import { HomeSkeleton } from './HomeSkeleton'
import type { ActivityType } from '../../types'

/** Иконки пунктов плана дня (сами пункты строит lib/dailyPlan). */
const PLAN_ICONS: Record<string, IconLike> = {
  words: IconCards,
  reader: IconBook,
  grammar: IconHint,
  pronunciation: IconMic,
  conversation: IconDialog,
  assignment: IconClipboard,
  quest: IconFlag,
}

/** Имя без фамилии: «Мадина · до воскресенья» (имена не склоняем, журнал п.68). */
const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null

export function DashboardPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  // первый кадр: все входы разом, без выдуманных нулей при сбое связи (useHomeData)
  const { data: home, ready, failed, reload } = useHomeData(user?.id)
  // ближайший урок ученика (Ф2.9): за 10 минут до начала — главное на экране
  const next = useNextLesson(home?.lessons ?? null)
  const { dueCount, wordCount, wordOfDay, wordPending } = useHomeWords(user?.id, lang)
  const wide = useEvenColumnsSplit()
  const profile = home?.profile ?? null
  const planInputs = home?.planInputs ?? null
  // сделанное сегодня — из activity_log, плюс «идеальный день», отмеченный здесь
  const [markedPerfect, setMarkedPerfect] = useState(false)
  const doneToday = useMemo(() => {
    const done = new Set<ActivityType>(home?.activity?.todayTypes ?? [])
    if (markedPerfect) done.add('perfect')
    return done
  }, [home, markedPerfect])

  // план на сегодня — ТОЛЬКО когда все входы загружены (иначе null)
  const todayPlan = planInputs
    ? buildTodayPlan(planInputs.dailyCfg, {
        pendingAssignments: home?.assignments?.pending ?? 0,
        activeQuests: planInputs.activeQuests,
        weekday: todayWeekday(),
      })
    : null
  const perfect = todayPlan !== null && isPerfectDay(todayPlan, doneToday)

  // «идеальный день»: фиксируем один раз и только по ПОЛНОМУ плану
  useEffect(() => {
    if (perfect && !doneToday.has('perfect')) {
      void logActivity('perfect', 0)
      setMarkedPerfect(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfect])

  if (!ready) return <HomeSkeleton />

  // Пустая колода ≠ «всё повторено»: новичку без единого слова предлагаем
  // добавить первые (пункт ведёт в «Учёбу», где живут паки и добавление).
  const emptyDeck = wordCount === 0
  const wordsDetail = emptyDeck
    ? 'добавь первые слова'
    : dueCount
      ? `${dueCount}${dueCount >= 99 ? '+' : ''} ${plural(dueCount, 'слово', 'слова', 'слов')}`
      : undefined
  const rows: PlanRow[] | null = todayPlan?.map((p) => ({
    key: p.key,
    title: p.title,
    detail: p.key === 'words' ? wordsDetail : p.key === 'assignment' || p.key === 'quest' ? p.desc : undefined,
    to: p.key === 'words' && emptyDeck ? '/study' : p.to,
    done: p.types.some((t) => doneToday.has(t)),
    Icon: PLAN_ICONS[p.key] ?? IconRows,
  })) ?? null
  const doneCount = rows?.filter((r) => r.done).length ?? 0
  // «Начать занятие» — по плану дня: несделанные пункты; план не пришёл —
  // план без настроек учителя; повторять нечего — без шага слов (журнал п.76 (10))
  const steps = sessionSteps(todayPlan ?? buildTodayPlan(null, { pendingAssignments: 0, activeQuests: 0, weekday: todayWeekday() }), doneToday, {
    noReview: emptyDeck || dueCount === 0,
  })

  // ⚠️ Не подставляем B1: раньше приложение уверенно писало уровень, которого
  // никто не измерял (умолчание колонки в базе). Не знаем — не говорим.
  const level = lang === 'es' ? getEsLevel() : (profile?.level ?? null)
  // «Привет, Айгерим» — по имени, без фамилии (u1, d4-v2)
  const name = firstName(profile?.display_name) || user?.email?.split('@')[0] || 'друг'
  const urgent = next.urgent

  const hello = (
    <header key="hello" className={`animate-fade-up flex flex-col gap-0.5 px-1 ${wide ? '' : 'pt-1'}`}>
      <h1 className="text-greeting font-semibold text-fg">Привет, {name}</h1>
      <p className="text-body text-fg-muted">
        {lang === 'es' ? 'Испанский' : 'Английский'}
        {level ? ` · ${level}` : ''}
      </p>
    </header>
  )
  // Не всё пришло — говорим о связи, а не рисуем «0» (Ф1.13)
  const lost = failed > 0 && (
    <LoadError
      key="lost"
      message="Часть главной не загрузилась — похоже, пропала связь. Слова, тексты и грамматика работают и без интернета."
      onRetry={reload}
    />
  )
  const lesson = next.lesson && <NextLessonCard key="lesson" lesson={next.lesson} urgent={urgent} now={next.now} fill={wide} />
  const pushAsk = <LessonPushAsk key="push" hasLessons={next.lesson !== null} />
  // серии нет, если не пришёл журнал: «0» был бы выдумкой
  const streak = home?.activity && (
    <StreakHero key="streak" streak={home.activity.streak} week={home.activity.week} perfect={perfect} compact={wide} />
  )
  const start = <StartButton key="start" lang={lang} steps={steps} afterLesson={urgent} compact={wide} />
  // входы плана не пришли — плана нет: дефолт мог бы разойтись с учительским
  const plan = rows && (
    <PlanList key="plan" rows={rows} pill={perfect ? 'Идеальный день ✦' : `${doneCount} из ${rows.length}`} compact={wide} />
  )
  const homework = homeworkRow(home)
  const program = home?.newProgram && (
    <RowCard
      key="program"
      Icon={IconRows}
      active
      title="Тебе назначили программу обучения"
      desc={`${home.newProgram.lang.toUpperCase()} · ${home.newProgram.weeks.length} нед. — посмотри план на эту неделю`}
      to="/program"
      className="animate-fade-up"
    />
  )
  // слово дня считается отдельно (ленивый чанк словаря) — место держим
  const word = wordOfDay ? (
    <WordOfDay key="word" word={wordOfDay} lang={lang} compact={wide} />
  ) : wordPending ? (
    <div key="word" aria-hidden className={`animate-skeleton rounded-card bg-skeleton ${wide ? 'h-25' : 'h-29'}`} />
  ) : null
  const energy = home?.myPlan && <EnergyBar key="energy" plan={home.myPlan} compact={wide} />
  const join = <TeacherBlock key="join" profile={profile} teachers={home?.teachers ?? null} compact={wide} />

  // компьютер: «Начать занятие» и план — одной карточкой (d4-v2, вариант 1б)
  const startCard = (
    <section className="flex flex-col gap-2.5 rounded-card bg-surface p-4.5 shadow-card">
      {start}
      {plan && <div aria-hidden className="mb-0.5 mt-1.5 h-px bg-line" />}
      {plan}
    </section>
  )
  const pair: readonly [ReactNode, ReactNode] | null = lesson ? (urgent ? [lesson, streak] : [streak, lesson]) : null
  // телефон — порядок u1: за 10 минут до урока приветствия нет, «Начать
  // занятие» — сразу под уроком (u1-2)
  const head = urgent ? [lost, lesson, pushAsk, start, homework, program] : [hello, lost, lesson, pushAsk, homework, program, start]
  const columns = (
    <EvenColumns
      pair={pair}
      left={startCard}
      right={[pair ? null : streak, homework, program, word, energy, join, pushAsk]}
      stack={[...head, streak, plan, word, energy, join]}
    />
  )
  if (!wide) return columns
  return (
    <div className="flex flex-col gap-5">
      {hello}
      {lost}
      {columns}
    </div>
  )
}

/** «Домашка на неделю» (u1-1, d4-v2); без домашки, но с заданиями-материалами — они. */
function homeworkRow(home: HomeData | null): ReactNode {
  const hw = home?.homework
  const { done, total } = homeworkProgress(hw ?? null)
  if (hw && total > 0) {
    const teacher = home?.teachers?.length === 1 ? firstName(home.teachers[0]!.display_name) : null
    return (
      <RowCard
        key="homework"
        Icon={IconClipboardCheck}
        active
        title="Домашка на неделю"
        value={`${done} из ${total}`}
        progress={done / total}
        desc={[teacher, dueShort(hw.due_at)].filter(Boolean).join(' · ')}
        to="/assignments"
        className="animate-fade-up"
      />
    )
  }
  const pending = home?.assignments?.pending ?? 0
  if (pending === 0) return null
  return (
    <RowCard
      key="homework"
      Icon={IconClipboard}
      active
      title="Задания от преподавателя"
      value={pending}
      desc={plural(pending, 'ждёт выполнения', 'ждут выполнения', 'ждут выполнения')}
      to="/assignments"
      className="animate-fade-up"
    />
  )
}
