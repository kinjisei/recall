// ============================================================================
// «Перенести урок» (макет t5-1; журнал п.31, 65). «Только этот урок» — серия
// не рвётся, потом «Урок перенесён · Вернуть». «Этот и все следующие» — день
// урока в серии меняется на новый («вт и чт», чт → пт = «вт и пт»), время у
// серии одно на все дни; заранее видно, как будет дальше и сколько отдельно
// перенесённых уроков впереди встанет по новому расписанию.
// ============================================================================
import { useState } from 'react'
import {
  almatyInstant,
  almatyTime,
  canFollowing,
  dayShort,
  draftFromLesson,
  endTime,
  firstSeriesDay,
  lessonDay,
  lessonMinutes,
  lessonName,
  lessonsCount,
  movedMessage,
  movedWeekdays,
  moveSeriesInput,
  overlaps,
  rebuildCount,
  repeatLabel,
  seriesChangedMessage,
  timeRange,
  toLessonInput,
  updateLesson,
  updateSeriesFrom,
  weekdaysList,
  type Lesson,
  type Series,
} from '../../domains/schedule'
import { Button } from '../../shared/ui/Button'
import { IconArrowRight, IconClose, IconInfo, IconWarning } from '../../shared/ui/icons'
import { Sheet } from '../../shared/ui/Sheet'
import { TabPicker } from '../../shared/ui/TabPicker'
import { LessonAvatar } from './LessonParts'
import type { Done } from './types'
import { useDayLessons, useLessonsAhead } from './useScheduleData'
import { WhenFields } from './WhenFields'

export function MoveSheet({
  lesson,
  series,
  defaultLink,
  today,
  now,
  inApp,
  onClose,
  onDone,
}: {
  lesson: Lesson
  series: Series | null
  defaultLink: string | null
  today: string
  now: Date
  inApp: (cardId: string) => boolean
  onClose: () => void
  onDone: (done: Done) => void
}) {
  const before = draftFromLesson(lesson, null, defaultLink)
  const [day, setDay] = useState(before.day)
  const [time, setTime] = useState(before.time)
  const [scope, setScope] = useState<'one' | 'following'>('one')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seriesMove = series && canFollowing(lesson, now) ? series : null
  const following = seriesMove !== null && scope === 'following'
  const minutes = lessonMinutes(lesson)
  const clashes = overlaps({ ...before, day, time }, useDayLessons(day).data ?? [], lesson.id)
  const ahead = useLessonsAhead(today, following)
  const rebuild = following ? rebuildCount(ahead.data ?? [], lesson, now) : 0
  const newWeekdays = seriesMove ? movedWeekdays(seriesMove, lesson, day) : []
  const nextRule = seriesMove
    ? { weekdays: newWeekdays, everyWeeks: seriesMove.everyWeeks, startsOn: lesson.seriesDate ?? before.day, endsOn: seriesMove.endsOn }
    : null
  const firstNew = nextRule ? firstSeriesDay(nextRule) : null
  const to = almatyInstant(day, time).toISOString()
  const same = new Date(to).getTime() === new Date(lesson.startsAt).getTime()

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (following && seriesMove) {
        const input = moveSeriesInput(seriesMove, lesson, day, time)
        await updateSeriesFrom(lesson.id, input)
        const d = { ...before, weekdays: input.weekdays, everyWeeks: input.everyWeeks, time, minutes }
        onDone({
          toast: 'Уроки перенесены',
          day: firstNew ?? day,
          tell: { title: 'Расписание изменилось', cardIds: seriesMove.cardIds, text: (who) => seriesChangedMessage(who, d, firstNew ?? day), url: lesson.link },
        })
      } else {
        await updateLesson(lesson.id, toLessonInput({ ...before, day, time }))
        onDone({
          toast: 'Урок перенесён',
          day,
          undo: () => updateLesson(lesson.id, toLessonInput(before)),
          tell: { title: 'Урок перенесён', cardIds: before.cardIds, text: (who) => movedMessage(who, lesson.startsAt, to), url: lesson.link },
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось перенести урок')
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="move-title">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-1">
        <div className="flex items-center justify-between gap-3">
          <h2 id="move-title" className="text-lg font-semibold">
            Перенести урок
          </h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-muted hover:bg-tint/[0.06]">
            <IconClose size={20} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <LessonAvatar lesson={lesson} inApp={inApp} />
          <p className="min-w-0 text-sm">
            <span className="block truncate font-semibold">{lessonName(lesson)}</span>
            <span className="text-fg-muted">
              {dayShort(lessonDay(lesson))}, {timeRange(lesson)}
            </span>
          </p>
        </div>

        <section aria-label="Новая дата и время" className="flex flex-col gap-1.5">
          <span className="text-note text-fg-muted">Новая дата и время</span>
          <WhenFields day={day} time={time} minutes={minutes} today={today} clashes={clashes} onDay={setDay} onTime={setTime} />
        </section>

        {seriesMove && (
          <section aria-label="Что изменить" className="flex flex-col gap-1.5">
            <span className="text-note text-fg-muted">Что изменить</span>
            <TabPicker
              variant="segment"
              stretch
              ariaLabel="Что изменить"
              value={scope}
              onChange={setScope}
              options={[
                { id: 'one', label: 'Только этот урок' },
                { id: 'following', label: 'Этот и все следующие' },
              ]}
            />
            <p className="flex items-start gap-1.5 text-note text-fg-muted">
              <IconInfo size={15} aria-hidden className="mt-0.5 flex-none" />
              {following
                ? `Дальше: ${repeatLabel(newWeekdays, seriesMove.everyWeeks).toLowerCase()}, ${time}–${endTime(time, minutes)}${firstNew ? ` · первый урок — ${dayShort(firstNew)}` : ''}`
                : `Остальные уроки по ${weekdaysList(seriesMove.weekdays)} останутся как были.`}
            </p>
            {following && rebuild > 0 && (
              <p role="status" className="flex items-start gap-1.5 text-note text-warning-strong">
                <IconWarning size={15} aria-hidden className="mt-0.5 flex-none" />
                Впереди {lessonsCount(rebuild)}, перенесённых отдельно, — они встанут по новому расписанию.
              </p>
            )}
          </section>
        )}

        {!following && (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-tint/[0.04] px-3 py-2.5 text-sm" data-move-preview>
            <span className="text-fg-muted">
              {dayShort(lessonDay(lesson))}, {almatyTime(lesson.startsAt)}
            </span>
            <IconArrowRight size={16} aria-hidden className="text-fg-muted" />
            <span className="font-semibold">
              {dayShort(day)}, {time}
            </span>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger-soft-fg">
            {error}
          </p>
        )}
        <Button className="w-full" onClick={() => void submit()} disabled={same && !following} loading={busy}>
          Перенести
        </Button>
      </div>
    </Sheet>
  )
}
