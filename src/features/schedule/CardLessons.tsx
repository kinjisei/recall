// ============================================================================
// Блок «Уроки» в карточке ученика (макет t7-1; PLAN.md Ф2.8): остаток
// («Оплачено, осталось 3 урока»; минус — только учителю), «Отметить оплату»,
// при остатке 1 и меньше — «Напомнить об оплате», два ближайших урока со
// ссылкой в расписание, «История уроков и оплат». Карточку собирает студия
// (features/teacher), блок — расписания: уроки и учёт живут здесь.
// Из уведомления «остался 1 · Напомнить» карточка открывается с ?remind=1 —
// шторка «Напомнить» появляется сама (autoRemind).
// ============================================================================
import { useState } from 'react'
import {
  almatyDay,
  balanceLabel,
  balanceLow,
  balanceShort,
  dayBounds,
  dayShort,
  lessonDay,
  lessonName,
  loadSchedule,
  timeRange,
  type LessonBalance,
} from '../../domains/schedule'
import type { StudentCard } from '../../domains/students'
import { addDays } from '../../shared/lib/days'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useNow } from '../../shared/lib/useNow'
import { AppLink } from '../../shared/ui/AppLink'
import { Button } from '../../shared/ui/Button'
import { IconTicket } from '../../shared/ui/icons'
import { RowCard } from '../../shared/ui/RowCard'
import { HistorySheet } from './HistorySheet'
import { PaySheet } from './PaySheet'
import { RemindSheet } from './RemindSheet'

/** «Сегодня» · «Завтра» · «чт, 22 окт». */
const when = (day: string, today: string) => (day === today ? 'Сегодня' : day === addDays(today, 1) ? 'Завтра' : dayShort(day))

/** Ближайшие уроки карточки на две недели вперёд. */
function useUpcoming(cardId: string, version: number) {
  return useAsyncData(
    async () => {
      const from = new Date()
      const lessons = await loadSchedule(from, dayBounds(addDays(almatyDay(from), 14)).from)
      return lessons.filter((l) => l.status === 'planned' && new Date(l.startsAt) > from && l.participants.some((p) => p.cardId === cardId))
    },
    [cardId, version],
    'Не удалось загрузить уроки',
  )
}

export function CardLessons({
  card,
  balance,
  canWrite,
  autoRemind = false,
  onRemindShown,
  onChanged,
}: {
  card: StudentCard
  balance: LessonBalance | null
  canWrite: boolean
  /** «Напомнить» открыт сразу (пришли из уведомления, ?remind=1). */
  autoRemind?: boolean
  /** Шторку закрыли или сменили — убрать ?remind=1 из адреса. */
  onRemindShown?: () => void
  /** Отметили оплату или исправили историю — перечитать остатки. */
  onChanged: () => void
}) {
  const now = useNow()
  const today = almatyDay(now)
  const [version, setVersion] = useState(0)
  const upcoming = useUpcoming(card.id, version)
  const [chosen, setChosen] = useState<'pay' | 'history' | 'remind' | null>(null)
  // пришли из уведомления — «Напомнить» открыт, пока ?remind=1 в адресе;
  // закрыли — параметр уходит (onRemindShown), «назад» его не вернёт
  const sheet = chosen ?? (autoRemind ? 'remind' : null)
  const setSheet = (next: typeof chosen) => {
    if (autoRemind) onRemindShown?.()
    setChosen(next)
  }
  const [note, setNote] = useState<string | null>(null)
  const next = upcoming.data?.slice(0, 2) ?? []

  const changed = (text: string) => {
    setSheet(null)
    setNote(text)
    setVersion((v) => v + 1)
    onChanged()
  }

  return (
    <section aria-label="Уроки" className="flex flex-col gap-3 rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card" data-card-lessons>
      <h3 className="text-sm font-semibold text-fg-secondary">Уроки</h3>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold" data-balance>
          <IconTicket size={18} aria-hidden className="text-fg-muted" />
          {balanceLabel(balance)}
        </span>
        {canWrite && (
          <Button variant="secondary" className="min-h-11 px-3 py-2 text-sm" onClick={() => setSheet('pay')}>
            Отметить оплату
          </Button>
        )}
      </div>
      {balanceLow(balance) && (
        <Button variant="ghost" className="min-h-11 self-start px-3 py-2 text-sm" onClick={() => setSheet('remind')}>
          Напомнить об оплате
        </Button>
      )}
      {note && (
        <p role="status" className="text-note text-success-strong">
          {note}
        </p>
      )}

      {next.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-note text-fg-muted">Ближайшие</span>
          {next.map((l) => (
            <AppLink key={l.id} to={`/schedule?view=day&day=${lessonDay(l)}&lesson=${l.id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-1 text-sm hover:bg-tint/[0.04]">
              <span className="truncate">
                {when(lessonDay(l), today)}, {timeRange(l)}
              </span>
              <span className="truncate text-note text-fg-muted">{l.kind === 'group' ? lessonName(l) : l.kind === 'trial' ? 'пробный' : 'индивидуальный'}</span>
            </AppLink>
          ))}
        </div>
      ) : (
        upcoming.data && (
          <p className="text-note text-fg-muted">
            Уроков в ближайшие две недели нет ·{' '}
            <AppLink to="/schedule" className="text-accent-strong underline underline-offset-2">
              Расписание
            </AppLink>
          </p>
        )
      )}
      <div className="-mx-4 -mb-4 border-t border-tint/[0.06]">
        <RowCard flat title="История уроков и оплат" onClick={() => setSheet('history')} />
      </div>

      {sheet === 'pay' && (
        <PaySheet cardId={card.id} name={card.name} balance={balance} today={today} onClose={() => setSheet(null)} onPaid={(n) => changed(`Отмечено: +${n}`)} />
      )}
      {/* текст зависит от остатка — шторка ждёт его (из уведомления карточка открывается сразу) */}
      {sheet === 'remind' && balance && (
        <RemindSheet
          card={card}
          left={balance?.balance ?? 0}
          next={next[0]?.startsAt ?? null}
          onClose={() => setSheet(null)}
          onSent={() => changed('Напоминание отправлено в приложение')}
        />
      )}
      {sheet === 'history' && (
        <HistorySheet
          cardId={card.id}
          name={card.name}
          balance={balance}
          today={today}
          now={now}
          canWrite={canWrite}
          onClose={() => setSheet(null)}
          onPay={() => setSheet('pay')}
          onChanged={onChanged}
        />
      )}
    </section>
  )
}

/** Остаток в строке списка учеников (макет t7-4): «6», «1», «−2»; учёт не ведётся — ничего. */
export function BalanceCount({ balance }: { balance: LessonBalance | null | undefined }) {
  const text = balanceShort(balance)
  if (!text) return null
  const tone = (balance?.balance ?? 0) < 0 ? 'text-danger-strong' : balanceLow(balance) ? 'text-warning-strong' : 'text-fg-secondary'
  return (
    <span className={`flex-none text-sm font-bold tabular-nums ${tone}`} title="Осталось оплаченных уроков" data-balance-count>
      {text}
    </span>
  )
}
