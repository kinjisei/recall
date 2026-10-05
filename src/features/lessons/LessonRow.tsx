// ============================================================================
// Строка урока ученика (макет u2-1): плитка даты, время, с кем, пометка
// «Отменён» / «Перенесён с …», у сегодняшнего — «Войти в урок». Ученик только
// смотрит (журнал п.32): ни переноса, ни отмены, ни других участников группы.
// Что написать — domains/schedule/student.ts.
// ============================================================================
import {
  canJoin,
  dateTile,
  isGroup,
  lessonNote,
  myLessonWhen,
  whoLabel,
  type MyLesson,
} from '../../domains/schedule'
import { IconArrowRight, IconUser, IconUsers, IconXCircle } from '../../shared/ui/icons'
import { JoinLink } from './JoinLink'

export function LessonRow({
  lesson,
  now,
  join,
  highlighted,
}: {
  lesson: MyLesson
  now: Date
  /** Показать «Войти в урок» (ближайший сегодняшний урок со ссылкой). */
  join: boolean
  /** Урок, на который вело уведомление (u3-1): подсветка и прокрутка к нему. */
  highlighted: boolean
}) {
  const tile = dateTile(lesson)
  const note = lessonNote(lesson)
  const cancelled = lesson.status === 'cancelled'
  const Who = isGroup(lesson) ? IconUsers : IconUser
  return (
    <li
      id={`lesson-${lesson.id}`}
      data-my-lesson={lesson.id}
      className={`flex gap-3 px-4 py-3.5 ${highlighted ? 'rounded-2xl bg-accent-soft/60 ring-2 ring-accent' : ''}`}
    >
      <span
        aria-hidden
        className={`flex size-11 flex-none flex-col items-center justify-center rounded-xl leading-none ${
          cancelled ? 'border border-dashed border-tint/[0.2] text-fg-muted' : 'bg-accent-soft text-accent-soft-fg'
        }`}
      >
        <span className="text-micro uppercase">{tile.weekday}</span>
        <span className="mt-0.5 text-base font-semibold tabular-nums">{tile.day}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-body font-semibold ${cancelled ? 'text-fg-muted line-through' : 'text-fg'}`}>
          {/* «Сегодня, 19:00–20:00» читает и скринридер, плитка — только глазам */}
          {myLessonWhen(lesson, now)}
        </p>
        <p className={`mt-0.5 flex items-center gap-1.5 text-sm ${cancelled ? 'text-fg-muted line-through' : 'text-fg-secondary'}`}>
          <Who size={14} aria-hidden className="flex-none" />
          <span className="truncate">{whoLabel(lesson)}</span>
        </p>
        {note && (
          <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${
              note.kind === 'cancelled' ? 'bg-tint/[0.08] text-fg-secondary' : 'bg-accent-soft text-accent-soft-fg'
            }`}
          >
            {note.kind === 'cancelled' ? <IconXCircle size={12} aria-hidden /> : <IconArrowRight size={12} aria-hidden />}
            {note.text}
          </span>
        )}
        {join && canJoin(lesson, now) && lesson.link && <JoinLink href={lesson.link} className="mt-2.5" />}
      </div>
    </li>
  )
}
