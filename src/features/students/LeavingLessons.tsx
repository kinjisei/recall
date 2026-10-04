// ============================================================================
// «На паузе уроки уйдут из расписания» (PLAN.md Ф2.7; журнал п.65, 1). Пауза
// и архив убирают ученика из будущих уроков: серийные вернутся вместе с ним,
// разовые — нет. Поэтому до нажатия сказать, сколько уйдёт; уроков впереди
// нет — переход без лишнего вопроса. Не смогли проверить (нет связи) —
// спрашиваем общими словами: молча терять уроки хуже лишнего вопроса.
// ============================================================================
import { useState } from 'react'
import { dayBounds, leavingLessons, lessonsCount, loadSchedule, almatyDay, RANGE_MAX_DAYS } from '../../domains/schedule'
import type { CardStatus, StudentCard } from '../../domains/students'
import { addDays } from '../../shared/lib/days'
import { Button } from '../../shared/ui/Button'
import { Sheet } from '../../shared/ui/Sheet'

interface Ask {
  card: StudentCard
  next: 'paused' | 'archived'
  /** null — не удалось узнать. */
  total: number | null
  oneOff: number
  go: () => void
}

async function count(cardId: string): Promise<{ total: number; oneOff: number } | null> {
  const now = new Date()
  const today = almatyDay(now)
  try {
    const lessons = await loadSchedule(now, dayBounds(addDays(today, RANGE_MAX_DAYS - 1)).from)
    return leavingLessons(lessons, cardId, now)
  } catch {
    return null
  }
}

/** Проверка перед «Пауза» / «В архив»: check(card, next, go) — go сразу или после «Да». */
export function useLeavingLessons() {
  const [ask, setAsk] = useState<Ask | null>(null)
  const check = async (card: StudentCard, next: CardStatus, go: () => void) => {
    const leaving = (next === 'paused' || next === 'archived') && (card.status === 'trial' || card.status === 'active')
    if (!leaving) return go()
    const n = await count(card.id)
    if (n && n.total === 0) return go()
    setAsk({ card, next, total: n?.total ?? null, oneOff: n?.oneOff ?? 0, go })
  }
  const sheet = ask && (
    <Sheet onClose={() => setAsk(null)} labelledBy="leaving-title">
      <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
        <h2 id="leaving-title" className="text-lg font-semibold">
          {ask.next === 'paused' ? 'Поставить на паузу?' : 'Отправить в архив?'}
        </h2>
        <p className="text-sm text-fg-secondary">
          {ask.total === null
            ? `${ask.card.name}: будущие уроки уйдут из расписания.`
            : `${ask.card.name}: впереди ${lessonsCount(ask.total)} — они уйдут из расписания.`}{' '}
          Вернёшь в «Занимается» — уроки по расписанию серий появятся снова
          {ask.oneOff > 0 ? `, а разовые (${ask.oneOff}) — нет.` : '.'}
        </p>
        <Button
          className="w-full"
          onClick={() => {
            const go = ask.go
            setAsk(null)
            go()
          }}
        >
          {ask.next === 'paused' ? 'Поставить на паузу' : 'Отправить в архив'}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setAsk(null)}>
          Отмена
        </Button>
      </div>
    </Sheet>
  )
  return { check, sheet }
}
