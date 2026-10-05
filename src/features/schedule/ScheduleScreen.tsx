// ============================================================================
// Экран «Расписание» (PLAN.md Ф2.7; макеты t2, t9-3, d1, d2). Шапка, строка
// «только для просмотра» без тарифа, вопрос после пробного, день (полоска
// недели + лента часов) или неделя (колонками или списком), пустое состояние
// нового репетитора, «Новый урок». Где я — в адресе (useScheduleUrl).
// На компьютере экран широкий (неделя — по умолчанию), шторки — панелью справа.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  almatyDay,
  almatyMinutes,
  byDay,
  defaultSlot,
  lessonDay,
  nextLessonId,
  trialQuestions,
} from '../../domains/schedule'
import { addDays, weekStart } from '../../shared/lib/days'
import { usePageWidth } from '../../shared/lib/screenWidth'
import { useShellInsets } from '../../shared/lib/shellInsets'
import { useIsDesktop } from '../../shared/lib/useMediaQuery'
import { useNow } from '../../shared/lib/useNow'
import { Button } from '../../shared/ui/Button'
import { EmptyState } from '../../shared/ui/EmptyState'
import { IconCalendarPlus, IconPlus } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { DayStrip } from './DayStrip'
import { DayTimeline } from './DayTimeline'
import { PLAN_REQUIRED_TEXT, ReadOnlyLine } from './ReadOnly'
import { ScheduleHeader } from './ScheduleHeader'
import { SchedulePanels } from './SchedulePanels'
import { TrialQuestion } from './TrialQuestion'
import { useScheduleActions } from './useScheduleActions'
import { useLessons, type ScheduleBase } from './useScheduleData'
import { useScheduleUrl } from './useScheduleUrl'
import { WeekGrid } from './WeekGrid'
import { WeekList } from './WeekList'

export function ScheduleScreen({ base, version, refresh }: { base: ScheduleBase; version: number; refresh: () => void }) {
  const desktop = useIsDesktop()
  usePageWidth(desktop)
  const insets = useShellInsets()
  const navigate = useNavigate()
  const now = useNow()
  const today = almatyDay(now)
  const url = useScheduleUrl(today, desktop)
  const monday = weekStart(url.day)
  const query = useLessons(monday, today, version, true)
  const [answering, setAnswering] = useState(false)

  const canWrite = base.plan?.can_write !== false
  const cards = new Map(base.cards.map((c) => [c.id, c]))
  const inApp = (id: string) => cards.get(id)?.inApp === true
  const act = useScheduleActions({
    cards,
    push: base.push,
    refresh,
    goToDay: (d) => url.goTo(d),
    closeLesson: url.closeLesson,
  })

  // ответ для другой недели не показываем под новыми датами — ждём свой
  const all = query.data && query.data.key.startsWith(`${monday}|`) ? query.data.lessons : null
  const week = (all ?? []).filter((l) => {
    const d = lessonDay(l)
    return d >= monday && d < addDays(monday, 7)
  })
  const days = byDay(week)
  const nextId = nextLessonId(week, now)
  const question = canWrite && all ? trialQuestions(all, now)[0] : undefined
  const opened = all?.find((l) => l.id === url.lessonId) ?? null
  const firstRun = all !== null && all.length === 0 && base.cards.length === 0

  const openNew = () => {
    if (!canWrite) return act.say(PLAN_REQUIRED_TEXT, 'Продлить', () => navigate('/pay'))
    act.setPanel({ kind: 'form', mode: { kind: 'new', ...defaultSlot(url.day < today ? today : url.day, today, almatyMinutes(now)) } })
  }
  const shift = (dir: -1 | 1) => url.goTo(addDays(url.day, dir * (url.view === 'day' ? 1 : 7)))

  let body
  if (!all) body = query.error ? <LoadError message={query.error} onRetry={query.reload} /> : <RowsSkeleton count={4} />
  else if (firstRun)
    body = (
      <EmptyState
        Icon={IconCalendarPlus}
        title="Пока нет уроков"
        actions={
          <>
            <Button onClick={() => (canWrite ? act.setPanel({ kind: 'card' }) : openNew())}>Добавить первого ученика</Button>
            <Button variant="secondary" onClick={openNew}>
              Новый урок
            </Button>
          </>
        }
      >
        Добавь ученика — и назначай ему уроки. Нового ученика можно записать и прямо в уроке.
      </EmptyState>
    )
  else if (url.view === 'day')
    body = (
      // день на компьютере — колонкой: ленте на 1100 px нечего показать сбоку
      <div className={`flex flex-col gap-4 ${desktop ? 'mx-auto w-full max-w-column' : ''}`}>
        <DayStrip
          monday={monday}
          day={url.day}
          today={today}
          busy={new Set(week.filter((l) => l.status !== 'cancelled').map(lessonDay))}
          onPick={(d) => url.goTo(d)}
        />
        <DayTimeline day={url.day} today={today} lessons={days.get(url.day) ?? []} now={now} nextId={nextId} inApp={inApp} onOpen={url.openLesson} />
      </div>
    )
  else if (url.layout === 'cols')
    body = (
      <WeekGrid monday={monday} today={today} days={days} now={now} compact={!desktop} inApp={inApp} onOpen={url.openLesson} onDay={(d) => url.goTo(d, 'day')} />
    )
  else body = <WeekList monday={monday} today={today} days={days} now={now} nextId={nextId} inApp={inApp} onOpen={url.openLesson} onDay={(d) => url.goTo(d, 'day')} />

  return (
    <div className={`flex flex-col gap-4 ${desktop ? '' : 'pb-16'}`} data-schedule-view={url.view}>
      <ScheduleHeader
        view={url.view}
        layout={url.layout}
        day={url.day}
        monday={monday}
        isCurrent={url.view === 'day' ? url.day === today : monday === weekStart(today)}
        desktop={desktop}
        canWrite={canWrite}
        onView={url.setView}
        onLayout={url.setLayout}
        onShift={shift}
        onToday={() => url.goTo(today)}
        onNew={openNew}
      />
      {!canWrite && <ReadOnlyLine plan={base.plan} />}
      {question && (
        <TrialQuestion
          question={question}
          today={today}
          desktop={desktop}
          busy={answering}
          onAnswer={(stays) => {
            setAnswering(true)
            void act.answerTrial(question.participant.cardId, question.participant.name, stays).finally(() => setAnswering(false))
          }}
        />
      )}
      {act.error && !opened && (
        <p role="alert" className="text-sm text-danger-soft-fg">
          {act.error}
        </p>
      )}
      {body}

      {/* обёртка держит место у края: у Button свой position: relative */}
      {!desktop && !firstRun && (
        <div className="fixed right-4 z-30" style={{ bottom: `calc(${insets.bottom} + 0.75rem)` }}>
          <Button className={`min-h-12 rounded-2xl px-4 shadow-raised ${canWrite ? '' : 'opacity-60'}`} onClick={openNew}>
            <IconPlus size={20} aria-hidden /> Новый урок
          </Button>
        </div>
      )}

      <SchedulePanels
        act={act}
        lesson={opened}
        cards={base.cards}
        series={new Map(base.series.map((s) => [s.id, s]))}
        balances={new Map(base.balances.map((b) => [b.cardId, b]))}
        defaultLink={base.defaultLink}
        canWrite={canWrite}
        today={today}
        now={now}
        closeLesson={url.closeLesson}
        refresh={refresh}
      />
    </div>
  )
}
