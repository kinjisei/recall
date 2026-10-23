// ============================================================================
// «Отменить урок» (макет t5-2; журнал п.27): «Не списывать» или «Списать —
// поздняя отмена» с остатком после, «Только этот урок» или «Этот и все
// следующие», кому Recall напишет сам. Кнопка — сплошной красный отдельно от
// выбора, под чертой внизу: случайное касание варианта урок не отменяет. Один
// урок — потом «Урок отменён · Вернуть» (база при возврате снимает и
// списание), поэтому без лишнего вопроса. Серия — без возврата (уроки после
// удаляются): это сказано до нажатия и ещё раз спрошено диалогом по центру
// (лист s3 «необратимое ещё и подтверждается», d0 правило 8; решение
// владельца 20.10.2026 — диалог только у серии). Пробный не списывается и при
// поздней отмене — выбора нет (п.30). На компьютере — правая панель (d2-2).
// ============================================================================
import { useState } from 'react'
import {
  balanceAfter,
  cancelLesson,
  cancelledMessage,
  cancelSeriesFrom,
  canFollowing,
  dateShort,
  isCharged,
  isTrialLesson,
  lessonDay,
  restoreLesson,
  seriesCancelledMessage,
  weekdaysList,
  type Lesson,
  type LessonBalance,
  type Series,
} from '../../domains/schedule'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { IconInfo, IconWarning, IconXCircle } from '../../shared/ui/icons'
import { Sheet, SHEET_BODY, SheetFooter } from '../../shared/ui/Sheet'
import { SheetHeader } from '../../shared/ui/SheetHeader'
import { TabPicker } from '../../shared/ui/TabPicker'
import { CHOICE_LABEL, LessonWho, NotifyLine } from './LessonParts'
import type { Done } from './types'
import { ErrorText } from '../../shared/ui/ErrorText'

export function CancelSheet({
  lesson,
  series,
  balance,
  now,
  inApp,
  reached,
  onClose,
  onDone,
}: {
  lesson: Lesson
  series: Series | null
  /** Остаток ученика индивидуального урока — для «Останется N»; null — учёт не ведётся. */
  balance: LessonBalance | null
  now: Date
  inApp: (cardId: string) => boolean
  /** До карточки Recall достаёт сам — «… получит уведомление». */
  reached: (cardId: string) => boolean
  onClose: () => void
  onDone: (done: Done) => void
}) {
  const [charge, setCharge] = useState<'no' | 'yes'>('no')
  const [scope, setScope] = useState<'one' | 'following'>('one')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()
  const trial = isTrialLesson(lesson) && lesson.kind !== 'group'
  const seriesCancel = series && canFollowing(lesson, now) ? series : null
  const following = seriesCancel !== null && scope === 'following'
  const p = lesson.kind === 'group' ? null : lesson.participants[0]
  const was = p ? isCharged(p.charge) : false
  const after = (willCharge: boolean) => (balance && balance.paid > 0 ? balanceAfter(balance.balance, was, willCharge) : undefined)
  const cardIds = lesson.participants.map((x) => x.cardId)
  const from = lesson.seriesDate ?? lessonDay(lesson)

  const submit = async () => {
    if (following && seriesCancel) {
      const ok = await confirm({
        title: 'Отменить уроки?',
        body: `Уроки по ${weekdaysList(seriesCancel.weekdays)} после ${dateShort(from)} удалятся — вернуть их можно будет только новой серией.`,
        action: 'Отменить уроки',
        cancel: 'Оставить',
      })
      if (!ok) return
    }
    setBusy(true)
    setError(null)
    const yes = charge === 'yes' && !trial
    try {
      if (following && seriesCancel) {
        await cancelSeriesFrom(lesson.id, yes)
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
      <SheetHeader id="cancel-title" title="Отменить урок" />
      <div className={SHEET_BODY}>
        <LessonWho lesson={lesson} inApp={inApp} />

        {trial ? (
          <p className="flex items-center gap-1.5 px-1 text-note text-fg-muted">
            <IconInfo size={16} aria-hidden className="flex-none" /> Пробный урок не списывается — и при поздней отмене
          </p>
        ) : (
          <section aria-label="Списать урок?" className="flex flex-col gap-1.5">
            <span className={CHOICE_LABEL}>Списать урок?</span>
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
          <section aria-label="Что изменить" className="flex flex-col gap-1.5">
            <span className={CHOICE_LABEL}>Что изменить</span>
            <TabPicker
              variant="segment"
              stretch
              small
              ariaLabel="Что изменить"
              value={scope}
              onChange={setScope}
              options={[
                { id: 'one', label: 'Только этот урок' },
                { id: 'following', label: 'Этот и все следующие' },
              ]}
            />
            <p className={`mt-0.5 flex items-start gap-1.5 px-1 text-note ${following ? 'text-warning-strong' : 'text-fg-muted'}`}>
              {following ? <IconWarning size={16} aria-hidden className="mt-px flex-none" /> : <IconInfo size={16} aria-hidden className="mt-px flex-none" />}
              {following
                ? 'Уроки после этого удалятся, вернуть их можно будет только новой серией.'
                : `Остальные уроки по ${weekdaysList(seriesCancel.weekdays)} останутся как были.`}
            </p>
          </section>
        )}

        <NotifyLine lesson={lesson} reached={reached} />

        {error && (
          <ErrorText>
            {error}
          </ErrorText>
        )}
      </div>
      <SheetFooter>
        <Button variant="danger-solid" className="w-full" onClick={() => void submit()} loading={busy}>
          <IconXCircle size={20} aria-hidden />
          {following ? 'Отменить уроки' : 'Отменить урок'}
        </Button>
      </SheetFooter>
      {dialog}
    </Sheet>
  )
}
