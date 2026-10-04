// ============================================================================
// «Требуют внимания» справа от списка учеников на компьютере, пока никто не
// выбран (макет d3-3; PLAN.md Ф2.8): пробный прошёл — «остаётся заниматься?»
// (решается в расписании), остался 1 оплаченный урок — «Напомнить»,
// оплаченные закончились — с минусом (его видит только учитель, п.29).
// Нечего показать — прежняя подсказка «выбери ученика слева».
// ============================================================================
import { useState } from 'react'
import {
  almatyDay,
  balanceLow,
  dayBounds,
  dayShort,
  lessonDay,
  loadSchedule,
  almatyTime,
  trialQuestions,
  type Lesson,
  type LessonBalance,
} from '../../domains/schedule'
import type { StudentCard } from '../../domains/students'
import { Avatar } from '../students'
import { addDays } from '../../shared/lib/days'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { AppLink } from '../../shared/ui/AppLink'
import { Button } from '../../shared/ui/Button'
import { RemindSheet } from './RemindSheet'

/** Уроки две недели назад и вперёд: пробные для вопроса, ближайшие — для «Напомнить». */
function useAround() {
  return useAsyncData(async () => {
    const today = almatyDay(new Date())
    return loadSchedule(dayBounds(addDays(today, -14)).from, dayBounds(addDays(today, 15)).from)
  }, [], 'Не удалось загрузить уроки')
}

const nextOf = (lessons: Lesson[], cardId: string, now: Date) =>
  lessons.find((l) => l.status === 'planned' && new Date(l.startsAt) > now && l.participants.some((p) => p.cardId === cardId)) ?? null

export function AttentionPanel({
  cards,
  balances,
  canWrite,
  empty,
  onOpen,
}: {
  cards: StudentCard[]
  balances: Map<string, LessonBalance>
  canWrite: boolean
  /** Подсказка, когда внимания никто не требует. */
  empty: string
  onOpen: (cardId: string) => void
}) {
  const around = useAround()
  const [remind, setRemind] = useState<StudentCard | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const now = new Date()
  const lessons = around.data ?? []
  const trials = canWrite ? trialQuestions(lessons, now) : []
  const low = cards.filter((c) => c.status !== 'archived' && balanceLow(balances.get(c.id)))
  const total = trials.length + low.length

  if (!total) {
    return <div className="rounded-2xl border border-dashed border-tint/[0.10] p-8 text-center text-sm text-fg-muted">{empty}</div>
  }
  return (
    <section aria-label="Требуют внимания" className="flex flex-col gap-2" data-attention>
      <h2 className="text-sm font-semibold text-fg-secondary">Требуют внимания · {total}</h2>
      <ul className="divide-y divide-tint/[0.06] overflow-hidden rounded-2xl border border-tint/[0.08] bg-surface shadow-card">
        {trials.map(({ lesson, participant }) => (
          <li key={`trial-${participant.cardId}`} className="flex items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => onOpen(participant.cardId)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
              <Avatar name={participant.name} inApp={cards.find((c) => c.id === participant.cardId)?.inApp === true} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{participant.name}</span>
                <span className="block truncate text-note text-fg-muted">
                  Пробный прошёл {lessonDay(lesson) === almatyDay(now) ? 'сегодня' : dayShort(lessonDay(lesson))} — остаётся заниматься?
                </span>
              </span>
            </button>
            <AppLink to={`/schedule?view=day&day=${lessonDay(lesson)}`} className="flex min-h-11 flex-none items-center rounded-xl px-3 text-sm font-semibold text-accent-strong hover:bg-tint/[0.06]">
              Решить
            </AppLink>
          </li>
        ))}
        {low.map((c) => {
          const b = balances.get(c.id)
          const next = nextOf(lessons, c.id, now)
          const detail =
            (b?.balance ?? 0) > 0
              ? `Остался 1 оплаченный урок${next ? ` · ${dayShort(lessonDay(next))}, ${almatyTime(next.startsAt)}` : ''}`
              : `Оплаченные уроки закончились${(b?.balance ?? 0) < 0 ? ` · −${-(b?.balance ?? 0)}` : ''}`
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <button type="button" onClick={() => onOpen(c.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar name={c.name} inApp={c.inApp} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.name}</span>
                  <span className="block truncate text-note text-fg-muted">{sent === c.id ? 'Напоминание отправлено' : detail}</span>
                </span>
              </button>
              <Button variant="ghost" className="min-h-11 flex-none px-3 py-2 text-sm" onClick={() => setRemind(c)}>
                Напомнить
              </Button>
            </li>
          )
        })}
      </ul>
      {remind && (
        <RemindSheet
          card={remind}
          left={balances.get(remind.id)?.balance ?? 0}
          next={nextOf(lessons, remind.id, now)?.startsAt ?? null}
          onClose={() => setRemind(null)}
          onSent={() => {
            setSent(remind.id)
            setRemind(null)
          }}
        />
      )}
    </section>
  )
}
