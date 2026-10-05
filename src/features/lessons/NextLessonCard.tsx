// ============================================================================
// «Ближайший урок» на Главной ученика (PLAN.md Ф2.9; макеты u1-1, u1-2, d4):
// когда, с кем, «Войти в урок», «Все уроки». За 10 минут до начала и во
// время урока карточка становится главной: акцентная рамка, «Войти в урок» —
// главная кнопка, а «Начать занятие» Главная делает второстепенной
// (useNextLesson → urgent). Остаток оплаченных уроков здесь не показываем
// никогда (журнал п.33) — только тихой строкой в «Моих уроках».
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

export function NextLessonCard({ lesson, urgent, now }: { lesson: MyLesson; urgent: boolean; now: Date }) {
  const link = canJoin(lesson, now) ? lesson.link : null
  return (
    <section
      data-next-lesson
      aria-label="Ближайший урок"
      className={`animate-fade-up rounded-2xl border bg-surface p-4 shadow-card ${urgent ? 'border-accent ring-1 ring-accent' : 'border-tint/[0.08]'}`}
    >
      <p className={`text-note ${urgent ? 'font-semibold text-accent-strong' : 'text-fg-muted'}`}>{cardTitle(lesson, now)}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight text-fg">{myLessonWhen(lesson, now)}</p>
      <p className="truncate text-sm text-fg-secondary">{whoLabel(lesson)}</p>
      <div className={`mt-3 flex gap-2 ${urgent ? 'flex-col items-stretch' : 'items-center'}`}>
        {link && <JoinLink href={link} primary={urgent} className={urgent ? 'min-h-12 w-full' : 'flex-1'} />}
        <AppLink
          to="/lessons"
          className="inline-flex min-h-11 select-none items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold text-accent-strong hover:underline"
        >
          Все уроки <IconChevronRight size={16} aria-hidden />
        </AppLink>
      </div>
    </section>
  )
}
