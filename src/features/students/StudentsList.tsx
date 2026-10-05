// ============================================================================
// Список «Ученики» (макеты t6-1, d3): фильтр по статусу, поиск, тихая строка
// мест тарифа, строки карточек. Порядок строк и их вторую строку («кем
// заняться») даёт студия — у ученика в приложении это домашка и регулярность
// (features/teacher), у карточки без приложения — контакт.
// ============================================================================
import { useState, type ReactNode } from 'react'
import {
  CARD_FILTERS,
  matchesFilter,
  matchesQuery,
  seatsLine,
  type CardFilter,
  type SeatsState,
  type StudentCard,
} from '../../domains/students'
import { useUrlState } from '../../shared/lib/useUrlState'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { IconPlus, IconSearch, IconSmartphone } from '../../shared/ui/icons'
import { RowCard } from '../../shared/ui/RowCard'
import { Avatar, StatusBadge } from './CardBits'

/** Поиск появляется, когда учеников столько, что глазами уже долго. */
const SEARCH_FROM = 7

export function StudentsList({
  cards,
  detailOf,
  outsideOf,
  trailingOf,
  attention,
  seats,
  selectedId,
  canWrite,
  onOpen,
  onAdd,
}: {
  /** Карточки в порядке показа. */
  cards: StudentCard[]
  /** Вторая строка карточки — «кем заняться». */
  detailOf: (card: StudentCard) => ReactNode
  /** Ученик в приложении без места тарифа. */
  outsideOf: (card: StudentCard) => boolean
  /** Справа в строке — остаток уроков (расписание, Ф2.8); нет — стрелка. */
  trailingOf?: (card: StudentCard) => ReactNode
  /** Сводка «Нужно внимание» над строками. */
  attention?: ReactNode
  seats: SeatsState | null
  selectedId: string | null
  /** Без тарифа после пробного — только просмотр (журнал п.41). */
  canWrite: boolean
  onOpen: (id: string) => void
  onAdd: () => void
}) {
  const [rawFilter, setRawFilter] = useUrlState('filter', (v) => CARD_FILTERS.some((f) => f.id === v))
  const filter = (rawFilter as CardFilter | null) ?? 'all'
  const [query, setQuery] = useState('')
  const shown = cards.filter((c) => matchesFilter(c, filter) && matchesQuery(c, query))
  const line = seatsLine(seats)
  const used = seats?.seats_used ?? 0
  const total = typeof seats?.seats === 'number' ? seats.seats : 0

  return (
    <div className="flex flex-col gap-3">
      {/* заголовок «Ученики» — у экрана (вкладка меню учителя, макет t6-1): свой
          здесь повторял бы его строкой ниже */}
      <div className="flex justify-end">
        <Button className="min-h-11 px-4 py-2 text-sm" onClick={onAdd} disabled={!canWrite}>
          <IconPlus size={18} /> Ученик
        </Button>
      </div>
      {!canWrite && (
        <p className="text-sm text-fg-muted">
          Тариф закончился — ученики только для просмотра. Пригласить в приложение можно.
        </p>
      )}

      {cards.length >= SEARCH_FROM && (
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-tint/[0.08] bg-input px-3">
          <IconSearch size={18} className="flex-none text-fg-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти ученика"
            aria-label="Найти ученика"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </label>
      )}

      {/* Перенос, а не прокрутка вбок: пятый фильтр не должен прятаться за краем */}
      <div role="radiogroup" aria-label="Статус" className="flex flex-wrap gap-2">
        {CARD_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            onClick={() => setRawFilter(f.id === 'all' ? null : f.id)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              filter === f.id
                ? 'border-accent-line bg-accent-soft text-accent-soft-fg'
                : 'border-tint/[0.10] text-fg-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {line && (
        <p className="flex items-center gap-2 text-sm text-fg-muted" data-seats-line>
          <IconSmartphone size={15} />
          <span className="flex-1">{line}</span>
          <span aria-hidden className="h-1.5 w-14 overflow-hidden rounded-full bg-tint/[0.08]">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${total ? Math.min(100, (used / total) * 100) : 0}%` }}
            />
          </span>
        </p>
      )}

      {attention}

      {cards.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Пока ни одного ученика</p>
          <p className="mt-1 text-sm text-fg-muted">
            Добавь ученика — карточку можно вести и без приложения, а пригласить в Recall
            потом, когда понадобится.
          </p>
        </Card>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">
          {query ? 'Никого не нашлось' : 'Здесь пока никого'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-tint/[0.08] bg-surface shadow-card">
          <p className="border-b border-tint/[0.06] px-4 py-2 text-xs font-semibold text-fg-muted">
            Ученики · {shown.length}
          </p>
          <ul className="divide-y divide-tint/[0.06]">
            {shown.map((c) => (
              <li key={c.id} data-card-row={c.id}>
                <CardRow
                  card={c}
                  detail={detailOf(c)}
                  outside={outsideOf(c)}
                  trailing={trailingOf?.(c)}
                  selected={c.id === selectedId}
                  onOpen={() => onOpen(c.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Строка ученика (общий RowCard в списке): инициалы, имя, значок «в
 * приложении», бейдж не-«занимается» и вторая строка от студии.
 */
function CardRow({
  card,
  detail,
  outside,
  trailing,
  selected,
  onOpen,
}: {
  card: StudentCard
  detail: ReactNode
  outside: boolean
  trailing?: ReactNode
  selected: boolean
  onOpen: () => void
}) {
  return (
    <RowCard
      flat
      current={selected}
      onClick={onOpen}
      lead={<Avatar name={card.name} inApp={card.inApp} />}
      trailing={trailing ?? undefined}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-semibold">{card.name}</span>
          {card.inApp && (
            <span title="В приложении" className="flex-none text-fg-muted">
              <IconSmartphone size={14} />
            </span>
          )}
          {card.status !== 'active' && <StatusBadge status={card.status} />}
        </span>
      }
      desc={
        <>
          {detail}
          {outside && (
            <span className="mt-1 inline-block rounded-lg bg-warning/10 px-2 py-0.5 text-xs text-warning-soft-fg">
              Вне мест тарифа
            </span>
          )}
        </>
      }
    />
  )
}
