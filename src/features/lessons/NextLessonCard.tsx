// ============================================================================
// «Ближайший урок» на Главной ученика (PLAN.md Ф2.9; макеты u1-1, u1-2, d4-v2):
// когда, с кем, «Войти в урок», «Все уроки». За 10 минут до начала и во
// время урока карточка становится главной: фон героя и рамка 2 px цветом
// фокуса, «Войти в урок» — главная кнопка во всю ширину, «Все уроки» — под
// ней по центру; «Начать занятие» Главная делает второстепенной
// (useNextLesson → urgent). На компьютере карточка стоит в ряду с серией и
// тянется на его высоту (`fill`): кнопки — внизу. Остаток оплаченных уроков
// здесь не показываем никогда (журнал п.33) — только тихой строкой в «Моих
// уроках». С кем — имя преподавателя без падежей (журнал п.68).
// ============================================================================
import { canJoin, cardPhase, cardTitle, myLessonWhen, nextLesson, whoLabel, type MyLesson } from '../../domains/schedule'
import { useNow } from '../../shared/lib/useNow'
import { AppLink } from '../../shared/ui/AppLink'
import { IconChevronRight } from '../../shared/ui/icons'
import { JoinLink } from './JoinLink'

export interface NextLessonState {
  lesson: MyLesson | null
  /** Урок вот-вот начнётся или идёт: карточка — главная (u1-2). */
  urgent: boolean
  now: Date
}

/** Ближайший урок из уроков Главной; «сейчас» обновляется раз в полминуты. */
export function useNextLesson(lessons: MyLesson[] | null): NextLessonState {
  const now = useNow()
  const lesson = lessons ? nextLesson(lessons, now) : null
  return { lesson, urgent: !!lesson && cardPhase(lesson, now) !== 'later', now }
}

/** Фон героя (как у серии на Главной): из левого верхнего угла hero → hero-mid → surface. */
const HERO = 'bg-radial-[130%_120%_at_0%_0%] from-hero via-hero-mid via-55% to-surface inset-ring-2 inset-ring-focus'

export function NextLessonCard({ lesson, urgent, now, fill = false }: { lesson: MyLesson; urgent: boolean; now: Date; fill?: boolean }) {
  const link = canJoin(lesson, now) ? lesson.link : null
  const all = (
    <AppLink
      to="/lessons"
      className={`inline-flex min-h-11 select-none items-center gap-1 px-1.5 text-body font-medium whitespace-nowrap text-accent-strong hover:underline ${urgent ? 'self-center' : ''}`}
    >
      Все уроки <IconChevronRight size={16} aria-hidden />
    </AppLink>
  )
  return (
    <section
      data-next-lesson
      aria-label="Ближайший урок"
      className={`animate-fade-up flex flex-col gap-3.5 rounded-card p-4.5 ${fill ? 'h-full justify-between' : ''} ${urgent ? HERO : 'bg-surface shadow-card'}`}
    >
      <span className="flex flex-col gap-0.5">
        <span className={`text-note ${urgent ? 'font-semibold text-accent-soft-fg' : 'text-fg-muted'}`}>{cardTitle(lesson, now)}</span>
        <span className="text-xl font-semibold tabular-nums tracking-normal text-fg">{myLessonWhen(lesson, now)}</span>
        <span className="truncate text-body text-fg-secondary">{whoLabel(lesson)}</span>
      </span>
      {urgent ? (
        <span className="flex flex-col gap-3.5">
          {link && <JoinLink href={link} primary large className="w-full" />}
          {all}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {link && <JoinLink href={link} large className="flex-1" />}
          {all}
        </span>
      )}
    </section>
  )
}
