// ============================================================================
// Блок «Уроки» в карточке ученика (макеты t7-1, d10-1, t6-2; PLAN.md Ф2.8,
// Ф2.17-4б-2): остаток крупным числом («Оплачено, осталось 3 урока»; минус —
// только учителю), «Отметить оплату», при остатке 1 и меньше — «Напомнить об
// оплате», два ближайших урока строками (значок, «Сегодня, 19:00–20:00»,
// «индивидуальный · каждый вт и чт» или название группы; нажатие — урок в
// расписании) и «История уроков и оплат». Уроки и серии берёт у вкладки
// «Ученики» — те же, что у второй строки списка. Карточку собирает студия
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
  dayShort,
  isTracked,
  lessonDay,
  lessonName,
  repeatLabel,
  timeRange,
  type Lesson,
  type LessonBalance,
  type Series,
} from '../../domains/schedule'
import type { StudentCard } from '../../domains/students'
import { addDays } from '../../shared/lib/days'
import { plural } from '../../shared/lib/plural'
import { useNow } from '../../shared/lib/useNow'
import { AppLink } from '../../shared/ui/AppLink'
import { Button } from '../../shared/ui/Button'
import { IconCalendar, IconChevronRight, IconClock, IconUsers } from '../../shared/ui/icons'
import { HistorySheet } from './HistorySheet'
import { PaySheet } from './PaySheet'
import { RemindSheet } from './RemindSheet'

/** «Сегодня» · «Завтра» · «чт, 22 окт». */
const when = (day: string, today: string) => (day === today ? 'Сегодня' : day === addDays(today, 1) ? 'Завтра' : dayShort(day))

/** Под временем урока: «индивидуальный · каждый вт и чт», у группы — название. */
function lessonNote(l: Lesson, series: Series[] | null): string {
  if (l.kind === 'group') return lessonName(l)
  const kind = l.kind === 'trial' ? 'пробный' : 'индивидуальный'
  const s = l.seriesId ? series?.find((x) => x.id === l.seriesId) : null
  const repeat = s ? repeatLabel(s.weekdays, s.everyWeeks) : ''
  return repeat ? `${kind} · ${repeat.charAt(0).toLowerCase()}${repeat.slice(1)}` : kind
}

/** Строка блока (d10-1): значок, текст с подписью, шеврон; высота ≥ 52. */
const ROW = 'flex min-h-13 items-center gap-2.5 py-1 text-body text-fg tabular-nums active:bg-row-press'

export function CardLessons({
  card,
  balance,
  lessons,
  series,
  canWrite,
  autoRemind = false,
  onRemindShown,
  onChanged,
}: {
  card: StudentCard
  balance: LessonBalance | null
  /** Уроки вокруг сегодня (вкладка «Ученики»); null — не пришли. */
  lessons: Lesson[] | null
  /** Серии студии — подпись повтора «каждый вт и чт»; null — без неё. */
  series: Series[] | null
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
  const [chosen, setChosen] = useState<'pay' | 'history' | 'remind' | null>(null)
  // пришли из уведомления — «Напомнить» открыт, пока ?remind=1 в адресе;
  // закрыли — параметр уходит (onRemindShown), «назад» его не вернёт
  const sheet = chosen ?? (autoRemind ? 'remind' : null)
  const setSheet = (next: typeof chosen) => {
    if (autoRemind) onRemindShown?.()
    setChosen(next)
  }
  const [note, setNote] = useState<string | null>(null)
  const next = (lessons ?? [])
    .filter((l) => l.status === 'planned' && new Date(l.startsAt) > now && l.participants.some((p) => p.cardId === card.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 2)
  const left = isTracked(balance) && (balance?.balance ?? 0) > 0 ? (balance?.balance ?? 0) : null

  const changed = (text: string) => {
    setSheet(null)
    setNote(text)
    onChanged()
  }

  return (
    <section aria-label="Уроки" className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card" data-card-lessons>
      <h3 className="text-lg font-semibold text-fg">Уроки</h3>
      <div className="flex items-center gap-3">
        {/* «Оплачено, осталось» — подписью, число крупно (d10-1); иначе — фразой */}
        <span className="min-w-0 flex-1" data-balance aria-label={balanceLabel(balance)}>
          {left !== null ? (
            <span aria-hidden>
              <small className="mb-1 block text-note text-fg-muted">Оплачено, осталось</small>
              <span className="text-3xl font-semibold leading-none tabular-nums">{left}</span>{' '}
              <span className="text-body text-fg-secondary">{plural(left, 'урок', 'урока', 'уроков')}</span>
            </span>
          ) : (
            <span aria-hidden className={`text-body font-semibold ${(balance?.balance ?? 0) < 0 ? 'text-warning-soft-fg' : 'text-fg'}`}>
              {balanceLabel(balance)}
            </span>
          )}
        </span>
        {canWrite && (
          <Button size="sm" variant="secondary" className="flex-none font-semibold!" onClick={() => setSheet('pay')}>
            Отметить оплату
          </Button>
        )}
      </div>
      {balanceLow(balance) && (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setSheet('remind')}>
          Напомнить об оплате
        </Button>
      )}
      {note && (
        <p role="status" className="text-note text-success-strong">
          {note}
        </p>
      )}

      {next.length > 0 ? (
        <p className="-mb-1.5 mt-0.5 text-note font-medium text-fg-muted">Ближайшие</p>
      ) : (
        lessons && (
          <p className="text-note text-fg-muted">
            Уроков в ближайшие две недели нет ·{' '}
            <AppLink to="/schedule" className="text-accent-strong underline underline-offset-2">
              Расписание
            </AppLink>
          </p>
        )
      )}
      <div className="flex flex-col divide-y divide-line">
        {next.map((l) => {
          const Icon = l.kind === 'group' ? IconUsers : IconCalendar
          return (
            <AppLink key={l.id} to={`/schedule?view=day&day=${lessonDay(l)}&lesson=${l.id}`} className={ROW}>
              <Icon size={20} aria-hidden className="flex-none text-fg-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {when(lessonDay(l), today)}, {timeRange(l)}
                </span>
                <small className="block truncate text-note text-fg-muted">{lessonNote(l, series)}</small>
              </span>
              <IconChevronRight size={18} aria-hidden className="flex-none text-fg-muted" />
            </AppLink>
          )
        })}
        <button type="button" className={`${ROW} w-full text-left`} onClick={() => setSheet('history')}>
          <IconClock size={20} aria-hidden className="flex-none text-fg-muted" />
          <span className="min-w-0 flex-1">История уроков и оплат</span>
          <IconChevronRight size={18} aria-hidden className="flex-none text-fg-muted" />
        </button>
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
  // макеты t6-1, d3-1: число 18 полужирным; минус — жёлтой «таблеткой» (его видит только учитель, п.29)
  const negative = (balance?.balance ?? 0) < 0
  return (
    <span
      className={`flex-none font-semibold tabular-nums ${negative ? 'rounded-full bg-warning-soft px-2.25 py-0.5 text-base text-warning-soft-fg' : 'min-w-7 text-right text-lg'}`}
      title="Осталось оплаченных уроков"
      data-balance-count
    >
      {text}
    </span>
  )
}
