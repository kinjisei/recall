// ============================================================================
// Шторка «Новый урок» и «Изменить урок» (макеты t3, d2; «Изменить» — решение
// владельца 04.10.2026: та же шторка, заполненная). Тип, кто, дата и время,
// длительность, повтор, ссылка; внизу — сводка «Каждый пн и ср… · 20 уроков».
// Почему «Создать» нельзя — словами под кнопкой (draftProblem — копия
// проверок базы, решает всё равно база).
// «Изменить» урок серии: «Только этот» — правка одного урока, «Этот и все
// следующие» — новая серия с этого дня; заранее сказано, сколько отдельно
// перенесённых уроков впереди встанет по новому расписанию (журнал п.65, 3).
// ============================================================================
import { useState } from 'react'
import { isoWeekday } from '../../shared/lib/days'
import {
  canFollowing,
  dayShort,
  createLesson,
  createSeries,
  draftFromLesson,
  draftProblem,
  draftRule,
  draftSummary,
  firstSeriesDay,
  lessonsCount,
  movedMessage,
  newDraft,
  overlaps,
  rebuildCount,
  saveDefaultLessonLink,
  seriesChangedMessage,
  cleanLink,
  toLessonInput,
  toSeriesInput,
  updateLesson,
  updateSeriesFrom,
  type Lesson,
  type LessonDraft,
  type LessonKind,
  type Series,
} from '../../domains/schedule'
import type { StudentCard } from '../../domains/students'
import { Button } from '../../shared/ui/Button'
import { IconClose, IconList, IconWarning } from '../../shared/ui/icons'
import { Sheet, SHEET_BODY } from '../../shared/ui/Sheet'
import { TabPicker } from '../../shared/ui/TabPicker'
import { FormWho } from './FormWho'
import { FormLink, FormRepeat } from './FormRepeatLink'
import type { Done } from './types'
import { useDayLessons, useLessonsAhead } from './useScheduleData'
import { DurationField, WhenFields } from './WhenFields'

export type FormMode =
  | { kind: 'new'; day: string; time: string; cardIds?: string[]; seed?: StudentCard[] }
  | { kind: 'edit'; lesson: Lesson; series: Series | null }

const KINDS: { id: LessonKind; label: string }[] = [
  { id: 'individual', label: 'Индивидуальный' },
  { id: 'group', label: 'Группа' },
  { id: 'trial', label: 'Пробный' },
]

/** Сохранить черновик: новый урок или серия, правка одного или «этот и все следующие». */
async function save(mode: FormMode, d: LessonDraft, scope: 'one' | 'following', defaultLink: string | null): Promise<Done> {
  // первая ссылка запоминается для следующих уроков (t3-3) — до урока, чтобы
  // урок не хранил копию и шёл за ссылкой по умолчанию
  const link = cleanLink(d.link)
  if (!defaultLink && link) await saveDefaultLessonLink(link)
  if (mode.kind === 'new') {
    if (d.repeat && d.kind !== 'trial') {
      await createSeries(toSeriesInput(d))
      return { toast: 'Уроки созданы', day: firstSeriesDay(draftRule(d)) ?? d.day }
    }
    await createLesson(toLessonInput(d))
    return { toast: 'Урок создан', day: d.day }
  }
  const l = mode.lesson
  const before = draftFromLesson(l, null, defaultLink)
  if (scope === 'following') {
    await updateSeriesFrom(l.id, toSeriesInput({ ...d, repeat: true }))
    const s = mode.series
    const days = (w: number[]) => [...w].sort((a, b) => a - b).join()
    const changed = !s || s.startTime.slice(0, 5) !== d.time || s.minutes !== d.minutes || s.everyWeeks !== d.everyWeeks || days(s.weekdays) !== days(d.weekdays)
    const from = firstSeriesDay(draftRule(d)) ?? d.day
    return {
      toast: 'Уроки изменены',
      tell: changed ? { title: 'Расписание изменилось', cardIds: d.cardIds, text: (who) => seriesChangedMessage(who, d, from) } : undefined,
    }
  }
  const input = toLessonInput({ ...d, repeat: false })
  await updateLesson(l.id, input)
  // база отдаёт время в своём виде («…+00:00»), сравниваем моменты, а не строки
  const moved = new Date(input.startsAt).getTime() !== new Date(l.startsAt).getTime()
  return {
    toast: 'Урок изменён',
    day: d.day,
    undo: () => updateLesson(l.id, toLessonInput(before)),
    tell: moved ? { title: 'Урок перенесён', cardIds: d.cardIds, text: (who) => movedMessage(who, l.startsAt, input.startsAt), url: l.link } : undefined,
  }
}

export function LessonForm({
  mode,
  cards,
  defaultLink,
  today,
  now,
  onClose,
  onDone,
  onCardCreated,
}: {
  mode: FormMode
  cards: StudentCard[]
  defaultLink: string | null
  today: string
  now: Date
  onClose: () => void
  onDone: (done: Done) => void
  onCardCreated: (card: StudentCard) => void
}) {
  const edit = mode.kind === 'edit' ? mode : null
  const [draft, setDraft] = useState<LessonDraft>(() =>
    mode.kind === 'edit' ? draftFromLesson(mode.lesson, mode.series, defaultLink) : newDraft(mode.day, mode.time, mode.cardIds ?? []),
  )
  const [scope, setScope] = useState<'one' | 'following'>('one')
  // карточки, которых ещё нет в перечитанном списке: созданные здесь и перед формой (seed)
  const [extra, setExtra] = useState<StudentCard[]>(() => (mode.kind === 'new' ? (mode.seed ?? []) : []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const patch = (p: Partial<LessonDraft>) => setDraft((d) => ({ ...d, ...p }))

  const seriesEdit = edit && edit.series && canFollowing(edit.lesson, now) ? edit : null
  const following = seriesEdit !== null && scope === 'following'
  // что уйдёт в базу: «только этот» — разовый, «этот и все следующие» — серия
  // «этот и все следующие» делит серию на дне урока по правилу серии (у
  // перенесённого урока он не совпадает с датой урока)
  const effective: LessonDraft = edit ? { ...draft, repeat: following, day: following ? (edit.lesson.seriesDate ?? draft.day) : draft.day } : draft
  const dayLessons = useDayLessons(draft.day)
  const clashes = overlaps(effective, dayLessons.data ?? [], edit?.lesson.id)
  const ahead = useLessonsAhead(today, following)
  const rebuild = seriesEdit && following ? rebuildCount(ahead.data ?? [], seriesEdit.lesson, now) : 0
  const problem = draftProblem(effective, today)
  const allCards = [...cards, ...extra.filter((c) => !cards.some((x) => x.id === c.id))]

  const submit = async () => {
    if (problem || busy) return
    setBusy(true)
    setError(null)
    try {
      onDone(await save(mode, effective, scope, defaultLink))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить урок')
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="lesson-form-title" maxH="92dvh">
      <div className={SHEET_BODY}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="lesson-form-title" className="text-lg font-semibold">
            {edit ? 'Изменить урок' : 'Новый урок'}
          </h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-muted hover:bg-tint/[0.06]">
            <IconClose size={20} />
          </button>
        </div>

        {!edit && (
          <TabPicker
            variant="segment"
            stretch
            ariaLabel="Тип урока"
            options={KINDS}
            value={draft.kind}
            onChange={(kind) => patch({ kind, repeat: kind === 'trial' ? false : draft.repeat, cardIds: kind === 'group' || draft.kind === 'group' ? [] : draft.cardIds })}
          />
        )}
        {seriesEdit && (
          <div className="flex flex-col gap-1.5">
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
            {following && rebuild > 0 && (
              <p role="status" className="flex items-start gap-1.5 text-note text-warning-strong">
                <IconWarning size={15} aria-hidden className="mt-0.5 flex-none" />
                Впереди {lessonsCount(rebuild)}, перенесённых отдельно, — они встанут по новому расписанию.
              </p>
            )}
          </div>
        )}

        <section aria-label={draft.kind === 'group' ? 'Группа' : 'Ученик'} className="flex flex-col gap-1.5">
          <span className="text-note text-fg-muted">{draft.kind === 'group' ? 'Группа' : 'Ученик'}</span>
          <FormWho
            kind={draft.kind}
            cards={allCards}
            cardIds={draft.cardIds}
            title={draft.title}
            onCards={(cardIds) => patch({ cardIds })}
            onTitle={(title) => patch({ title })}
            onCreated={(card) => {
              setExtra((x) => [...x, card])
              onCardCreated(card)
            }}
          />
        </section>

        <section aria-label="Дата и время" className="flex flex-col gap-1.5">
          <span className="text-note text-fg-muted">{following ? `Время · с ${dayShort(effective.day)}` : 'Дата и время'}</span>
          <WhenFields
            day={draft.day}
            time={draft.time}
            minutes={draft.minutes}
            today={today}
            showDate={!following}
            clashes={clashes}
            // дни повтора по умолчанию — день урока: сменили дату — день идёт следом
            onDay={(day) =>
              patch({ day, weekdays: draft.weekdays.length === 1 && draft.weekdays[0] === isoWeekday(draft.day) ? [isoWeekday(day)] : draft.weekdays })
            }
            onTime={(time) => patch({ time })}
          />
        </section>

        <section aria-label="Длительность" className="flex flex-col gap-1.5">
          <span className="text-note text-fg-muted">Длительность</span>
          <DurationField minutes={draft.minutes} trial={draft.kind === 'trial'} onMinutes={(minutes) => patch({ minutes })} />
        </section>

        {draft.kind !== 'trial' && (!edit || following) && (
          <FormRepeat draft={edit ? { ...draft, repeat: true } : draft} today={today} fixed={!!edit} onChange={(p) => patch(edit ? { ...p, repeat: true } : p)} />
        )}

        <FormLink link={draft.link} defaultLink={defaultLink} group={draft.kind === 'group'} title={draft.title} onLink={(link) => patch({ link })} />

        <p className="flex items-start gap-2 rounded-xl bg-tint/[0.04] px-3 py-2.5 text-note text-fg-secondary" data-lesson-summary>
          <IconList size={16} aria-hidden className="mt-0.5 flex-none text-fg-muted" />
          {draftSummary(effective)}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger-soft-fg">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Button className="w-full" onClick={() => void submit()} disabled={problem !== null} loading={busy}>
            {edit ? 'Сохранить' : 'Создать урок'}
          </Button>
          {problem && <p className="text-center text-note text-fg-muted">{problem}</p>}
        </div>
      </div>
    </Sheet>
  )
}
