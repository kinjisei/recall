// ============================================================================
// Справа от списка учеников на компьютере, пока никто не выбран (макет d3-3;
// PLAN.md Ф2.8, Ф2.17-4б-1): «Выбери ученика слева · По списку — стрелки
// ↑ ↓» и «Требуют внимания»: пробный прошёл — «остаётся заниматься?»
// («Решить» — в расписании), остался 1 оплаченный урок — «Напомнить»,
// оплаченные закончились — с минусом (его видит только учитель, п.29),
// нажатие — карточка. Уроки (две недели назад и вперёд) грузит вкладка
// «Ученики» — те же, что у второй строки списка.
// ============================================================================
import { useState, type ReactNode } from 'react'
import {
  almatyDay,
  balanceLow,
  dayShort,
  lessonDay,
  almatyTime,
  nextLessonOf,
  trialQuestions,
  type Lesson,
  type LessonBalance,
} from '../../domains/schedule'
import type { StudentCard } from '../../domains/students'
import { Avatar } from '../students'
import { buttonClass } from '../../shared/ui/Button'
import { AppLink } from '../../shared/ui/AppLink'
import { Avatar as AvatarView } from '../../shared/ui/Avatar'
import { IconChevronRight, IconSparkle, IconUsers } from '../../shared/ui/icons'
import { RemindSheet } from './RemindSheet'

export function AttentionPanel({
  cards,
  lessons,
  balances,
  canWrite,
  onOpen,
}: {
  cards: StudentCard[]
  /** Уроки вокруг сегодня; null — ещё не пришли или не загрузились. */
  lessons: Lesson[] | null
  balances: Map<string, LessonBalance>
  canWrite: boolean
  onOpen: (cardId: string) => void
}) {
  const [remind, setRemind] = useState<StudentCard | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const now = new Date()
  const trials = canWrite && lessons ? trialQuestions(lessons, now) : []
  const low = cards.filter((c) => c.status !== 'archived' && balanceLow(balances.get(c.id)))
  const total = trials.length + low.length
  const nextOf = (cardId: string) => (lessons ? nextLessonOf(lessons, cardId, now) : null)

  return (
    <section aria-label="Ученик не выбран" className="flex h-full flex-col gap-4 overflow-y-auto rounded-row bg-page p-5 ring-1 ring-inset ring-line" data-attention>
      <div className="flex flex-col items-center gap-2 px-5 pb-2 pt-7 text-center">
        <span className="mb-1 flex size-14 items-center justify-center rounded-control-lg bg-accent-soft text-accent-soft-fg">
          <IconUsers size={26} aria-hidden />
        </span>
        <b className="text-lg font-semibold text-fg">Выбери ученика слева</b>
        <span className="text-body text-fg-secondary">Карточка откроется здесь. По списку — стрелки ↑ ↓.</span>
      </div>
      {total > 0 && (
        <>
          <h2 className="-mb-2 mt-2 px-1 text-note font-medium text-fg-muted">Требуют внимания · {total}</h2>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-row bg-surface shadow-card">
            {trials.map(({ lesson, participant }) => (
              <Item
                key={`trial-${participant.cardId}`}
                avatar={<AvatarView name={participant.name} cardOnly Icon={IconSparkle} />}
                name={participant.name}
                detail={`Пробный прошёл ${lessonDay(lesson) === almatyDay(now) ? 'сегодня' : dayShort(lessonDay(lesson))} — остаётся заниматься?`}
                onOpen={() => onOpen(participant.cardId)}
                action={
                  <AppLink to={`/schedule?view=day&day=${lessonDay(lesson)}`} className={`${buttonClass('secondary', 'sm')} flex-none font-semibold!`}>
                    Решить
                  </AppLink>
                }
              />
            ))}
            {low.map((c) => {
              const b = balances.get(c.id)
              const left = b?.balance ?? 0
              const next = nextOf(c.id)
              return (
                <Item
                  key={c.id}
                  avatar={<Avatar name={c.name} inApp={c.inApp} />}
                  name={c.name}
                  detail={
                    sent === c.id ? (
                      'Напоминание отправлено'
                    ) : left > 0 ? (
                      `Остался 1 оплаченный урок${next ? ` · ${dayShort(lessonDay(next))}, ${almatyTime(next.startsAt)}` : ''}`
                    ) : (
                      <>
                        Оплаченные уроки закончились
                        {left < 0 && (
                          <>
                            {' · '}
                            <span className="font-semibold text-warning-soft-fg">−{-left}</span>
                          </>
                        )}
                      </>
                    )
                  }
                  onOpen={() => onOpen(c.id)}
                  // остался урок — «Напомнить» (t7); закончились — открыть карточку: отметить оплату
                  action={
                    left > 0 ? (
                      <button type="button" className={`${buttonClass('secondary', 'sm')} flex-none font-semibold!`} onClick={() => setRemind(c)}>
                        Напомнить
                      </button>
                    ) : (
                      <IconChevronRight size={20} aria-hidden className="flex-none text-fg-muted" />
                    )
                  }
                />
              )
            })}
          </ul>
        </>
      )}
      {remind && (
        <RemindSheet
          card={remind}
          left={balances.get(remind.id)?.balance ?? 0}
          next={nextOf(remind.id)?.startsAt ?? null}
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

/** Строка «Требуют внимания» (d3-3): аватар, имя 15,5, пояснение, действие справа. */
function Item({ avatar, name, detail, onOpen, action }: { avatar: ReactNode; name: string; detail: ReactNode; onOpen: () => void; action: ReactNode }) {
  return (
    <li className="flex min-h-16 items-center gap-3 py-2 pl-4 pr-3.5">
      <button type="button" onClick={onOpen} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-fg">{name}</span>
          <span className="block truncate text-note text-fg-secondary">{detail}</span>
        </span>
      </button>
      {action}
    </li>
  )
}
