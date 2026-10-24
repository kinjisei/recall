// ============================================================================
// «<имя> остаётся заниматься?» после пробного урока (журнал п.30; макеты
// t2-1, t7-4, d1). «Да» — карточка «занимается» и сразу «Отметить оплату?»,
// «Нет» — в архив с «Вернуть». Кого спрашивать, решает domains/schedule
// (trialQuestions): урок закончился, ученик всё ещё «пробный».
// Телефон (t7-4): карточка над лентой дня — инициалы ученика, вопрос, «Да» и
// «Нет» поровну на мягкой подложке и подложке поля. Компьютер (d1): строка
// под шапкой — искра, вопрос одной строкой, «Да / Нет» справа, рамка ring.
// Имя — без падежей («с Нұрсұлтаном»): склонять казахские и русские имена
// правилом не получится, а ошибка в имени заметнее, чем простой оборот.
// ============================================================================
import { almatyTime, dayShort, lessonDay, type TrialQuestion as Question } from '../../domains/schedule'
import { addDays } from '../../shared/lib/days'
import { Button } from '../../shared/ui/Button'
import { IconSparkle } from '../../shared/ui/icons'
import { Avatar } from '../students'

export function TrialQuestion({
  question,
  today,
  desktop,
  busy,
  inApp,
  onAnswer,
}: {
  question: Question
  today: string
  desktop: boolean
  busy: boolean
  inApp: (cardId: string) => boolean
  onAnswer: (stays: boolean) => void
}) {
  const { lesson, participant } = question
  const day = lessonDay(lesson)
  const when = `${day === today ? 'сегодня' : day === addDays(today, -1) ? 'вчера' : dayShort(day)}, ${almatyTime(lesson.startsAt)}`
  const yes = (
    <Button size="sm" variant="secondary" className={`font-semibold! ${desktop ? '' : 'flex-1'}`} loading={busy} onClick={() => onAnswer(true)}>
      Да
    </Button>
  )
  const no = (
    <Button size="sm" variant="neutral" className={desktop ? '' : 'flex-1'} disabled={busy} onClick={() => onAnswer(false)}>
      Нет
    </Button>
  )

  if (desktop) {
    return (
      <section
        aria-label="После пробного урока"
        className="flex items-center gap-3 rounded-control bg-surface py-2 pl-3.5 pr-2 shadow-card inset-ring-2 inset-ring-ring"
      >
        <IconSparkle size={18} aria-hidden className="flex-none text-accent" />
        <p className="min-w-0 flex-1 text-body text-fg">
          <span className="font-semibold">Пробный урок прошёл</span>
          <span className="text-fg-secondary">
            {' '}
            · {when}. {participant.name} остаётся заниматься?
          </span>
        </p>
        <div className="flex flex-none gap-2">
          {yes}
          {no}
        </div>
      </section>
    )
  }
  return (
    <section aria-label="После пробного урока" className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Avatar name={participant.name} inApp={inApp(participant.cardId)} small />
        <p className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-semibold text-fg">
            Пробный урок прошёл <span className="whitespace-nowrap text-note font-normal text-fg-muted">· {when}</span>
          </span>
          <span className="text-sm text-fg-secondary">{participant.name} остаётся заниматься?</span>
        </p>
      </div>
      <div className="flex gap-2">
        {yes}
        {no}
      </div>
    </section>
  )
}
