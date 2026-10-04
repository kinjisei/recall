// ============================================================================
// «<имя> остаётся заниматься?» после пробного урока (журнал п.30; макеты
// t2-1, t7-4, d1). «Да» — карточка «занимается» и сразу «Отметить оплату?»,
// «Нет» — в архив с «Вернуть». Кого спрашивать, решает domains/schedule
// (trialQuestions): урок закончился, ученик всё ещё «пробный».
// Имя — без падежей («с Нұрсұлтаном»): склонять казахские и русские имена
// правилом не получится, а ошибка в имени заметнее, чем простой оборот.
// ============================================================================
import { almatyTime, dayShort, lessonDay, type TrialQuestion as Question } from '../../domains/schedule'
import { addDays } from '../../shared/lib/days'
import { Button } from '../../shared/ui/Button'
import { IconSparkle } from '../../shared/ui/icons'

export function TrialQuestion({
  question,
  today,
  desktop,
  busy,
  onAnswer,
}: {
  question: Question
  today: string
  desktop: boolean
  busy: boolean
  onAnswer: (stays: boolean) => void
}) {
  const { lesson, participant } = question
  const day = lessonDay(lesson)
  const when = `${day === today ? 'сегодня' : day === addDays(today, -1) ? 'вчера' : dayShort(day)}, ${almatyTime(lesson.startsAt)}`
  const buttons = (
    <div className={`flex gap-2 ${desktop ? 'flex-none' : ''}`}>
      <Button variant="secondary" className={`min-h-11 px-4 py-2 text-sm ${desktop ? '' : 'flex-1'}`} loading={busy} onClick={() => onAnswer(true)}>
        Да
      </Button>
      <Button variant="ghost" className={`min-h-11 px-4 py-2 text-sm ${desktop ? '' : 'flex-1'}`} disabled={busy} onClick={() => onAnswer(false)}>
        Нет
      </Button>
    </div>
  )
  return (
    <section
      aria-label="После пробного урока"
      className={`flex gap-3 rounded-2xl border border-accent-line bg-surface p-4 shadow-card ${desktop ? 'items-center' : 'flex-col'}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
          <IconSparkle size={20} />
        </span>
        <p className="min-w-0 text-sm">
          <span className="font-semibold text-fg">Пробный урок прошёл</span>
          <span className="text-fg-muted"> · {when}</span>
          <span className="block text-fg-secondary">{participant.name} остаётся заниматься?</span>
        </p>
      </div>
      {buttons}
    </section>
  )
}
