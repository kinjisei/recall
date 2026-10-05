// ============================================================================
// «Отменить урок» (макет t5-2; журнал п.27): «Не списывать» или «Списать —
// поздняя отмена» с остатком после, «Только этот урок» или «Этот и все
// следующие». Кнопка — отдельно от выбора: случайное касание варианта урок
// не отменяет. Один урок — потом «Урок отменён · Вернуть»; серия — без
// возврата (уроки после удаляются), поэтому об этом сказано до нажатия.
// Пробный не списывается и при поздней отмене — выбора нет (п.30).
// ============================================================================
import { useState } from 'react'
import {
  balanceAfter,
  cancelLesson,
  cancelledMessage,
  cancelSeriesFrom,
  canFollowing,
  dayShort,
  isCharged,
  isTrialLesson,
  lessonDay,
  lessonName,
  restoreLesson,
  seriesCancelledMessage,
  timeRange,
  weekdaysList,
  type Lesson,
  type LessonBalance,
  type Series,
} from '../../domains/schedule'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { IconClose, IconInfo, IconWarning } from '../../shared/ui/icons'
import { Sheet, SHEET_BODY } from '../../shared/ui/Sheet'
import { TabPicker } from '../../shared/ui/TabPicker'
import { LessonAvatar } from './LessonParts'
import type { Done } from './types'

export function CancelSheet({
  lesson,
  series,
  balance,
  now,
  inApp,
  onClose,
  onDone,
}: {
  lesson: Lesson
  series: Series | null
  /** Остаток ученика индивидуального урока — для «Останется N»; null — учёт не ведётся. */
  balance: LessonBalance | null
  now: Date
  inApp: (cardId: string) => boolean
  onClose: () => void
  onDone: (done: Done) => void
}) {
  const [charge, setCharge] = useState<'no' | 'yes'>('no')
  const [scope, setScope] = useState<'one' | 'following'>('one')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trial = isTrialLesson(lesson) && lesson.kind !== 'group'
  const seriesCancel = series && canFollowing(lesson, now) ? series : null
  const following = seriesCancel !== null && scope === 'following'
  const p = lesson.kind === 'group' ? null : lesson.participants[0]
  const was = p ? isCharged(p.charge) : false
  const after = (willCharge: boolean) => (balance && balance.paid > 0 ? balanceAfter(balance.balance, was, willCharge) : undefined)
  const cardIds = lesson.participants.map((x) => x.cardId)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const yes = charge === 'yes' && !trial
    try {
      if (following && seriesCancel) {
        await cancelSeriesFrom(lesson.id, yes)
        const from = lesson.seriesDate ?? lessonDay(lesson)
        onDone({
          toast: 'Уроки отменены',
          tell: { title: 'Уроки отменены', cardIds, text: (who) => seriesCancelledMessage(who, seriesCancel.weekdays, from), url: lesson.link },
        })
      } else {
        await cancelLesson(lesson.id, yes)
        onDone({
          toast: 'Урок отменён',
          undo: () => restoreLesson(lesson.id),
          tell: { title: 'Урок отменён', cardIds, text: (who) => cancelledMessage(who, lesson), url: lesson.link },
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отменить урок')
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="cancel-title">
      <div className={SHEET_BODY}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="cancel-title" className="text-lg font-semibold">
            Отменить урок
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

        {trial ? (
          <p className="flex items-center gap-1.5 text-note text-fg-muted">
            <IconInfo size={15} aria-hidden className="flex-none" /> Пробный урок не списывается — и при поздней отмене
          </p>
        ) : (
          <section aria-label="Списать урок?" className="flex flex-col gap-1.5">
            <span className="text-note text-fg-muted">Списать урок?</span>
            <ChoiceGroup<'no' | 'yes'>
              variant="cards"
              label="Списать урок?"
              value={charge}
              onChange={setCharge}
              options={[
                { id: 'no', label: 'Не списывать', hint: after(false) },
                {
                  id: 'yes',
                  label: 'Списать — поздняя отмена',
                  hint: lesson.kind === 'group' ? 'Спишется каждому, кроме пробных' : after(true),
                },
              ]}
            />
          </section>
        )}

        {seriesCancel && (
          <section aria-label="Что отменить" className="flex flex-col gap-1.5">
            <span className="text-note text-fg-muted">Что отменить</span>
            <TabPicker
              variant="segment"
              stretch
              ariaLabel="Что отменить"
              value={scope}
              onChange={setScope}
              options={[
                { id: 'one', label: 'Только этот урок' },
                { id: 'following', label: 'Этот и все следующие' },
              ]}
            />
            <p className={`flex items-start gap-1.5 text-note ${following ? 'text-warning-strong' : 'text-fg-muted'}`}>
              {following ? <IconWarning size={15} aria-hidden className="mt-0.5 flex-none" /> : <IconInfo size={15} aria-hidden className="mt-0.5 flex-none" />}
              {following
                ? 'Уроки после этого удалятся, вернуть их можно будет только новой серией.'
                : `Остальные уроки по ${weekdaysList(seriesCancel.weekdays)} останутся как были.`}
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger-soft-fg">
            {error}
          </p>
        )}
        {/* сплошной красный (макет t5-2) — с редизайном: белое на danger в тёмной
            теме 4,4:1, ниже нормы для текста (test-tokens.mjs, Ф2.17) */}
        <Button variant="danger-outline" className="w-full" onClick={() => void submit()} loading={busy}>
          {following ? 'Отменить уроки' : 'Отменить урок'}
        </Button>
      </div>
    </Sheet>
  )
}
