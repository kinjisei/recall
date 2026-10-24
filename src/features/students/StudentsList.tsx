// ============================================================================
// Список «Ученики» (макеты t6-1 — телефон, d3-1, d3-3, d3-5 — компьютер;
// PLAN.md Ф2.17-4б-1): поиск, фильтр по статусу, тихая строка мест тарифа,
// «Ученики · N» с сортировкой «Ближайший урок / Осталось уроков» и ↑↓,
// строки карточек и раздел «Группы». «+ Ученик» — в шапке экрана (Ф2.11б-2).
// Строка: имя, «в приложении», бейджи статуса и домашки; вторая строка —
// ближайший урок («сегодня 17:00 · IELTS вечер»), справа — остаток уроков.
// Что во второй строке, порядок и бейдж домашки даёт студия (features/teacher).
// На компьютере (список рядом с карточкой) — одна карточка во всю высоту:
// шапка с поиском и фильтром стоит, остальное прокручивается; «/» — к поиску,
// ↑ ↓ — по ученикам.
// ============================================================================
import { useRef, useState, type ReactNode } from 'react'
import {
  CARD_FILTERS,
  matchesFilter,
  matchesQuery,
  ROSTER_SORTS,
  seatsLine,
  type CardFilter,
  type RosterSort,
  type SeatsState,
  type StudentCard,
} from '../../domains/students'
import { useUrlState } from '../../shared/lib/useUrlState'
import { useHotkeys } from '../../shared/ui/hotkeys'
import { Card } from '../../shared/ui/Card'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { IconArrowUp, IconCaretDown, IconSearch, IconSmartphone, IconSparkle } from '../../shared/ui/icons'
import { MenuPanel, MenuRadio, useMenu } from '../../shared/ui/Menu'
import { RowCard } from '../../shared/ui/RowCard'
import { Avatar, StatusBadge } from './CardBits'
import { Avatar as AvatarView } from '../../shared/ui/Avatar'
import { Badge } from '../../shared/ui/Badge'

/**
 * Поиск — на компьютере всегда (d3: восемь учеников и поиск), на телефоне —
 * когда учеников столько, что глазами уже долго (t6-1: восемь — без поиска).
 */
const SEARCH_FROM_PHONE = 12

export interface RosterRow {
  card: StudentCard
  /** Вторая строка: ближайший урок или вопрос «остаётся?». */
  line: ReactNode
  /** Пробный прошёл — строка закреплена сверху, аватар с искрой, строка акцентом. */
  trialAsk: boolean
  /** Бейдж домашки рядом с именем («просрочена», «не начата»). */
  mark: string | null
  /** Справа — остаток уроков; нет — ничего. */
  trailing: ReactNode
  /** Ученик в приложении без места тарифа. */
  outside: boolean
}

export interface RosterGroup {
  id: string
  title: string
  line: string
  to: string
}

export function StudentsList({
  rows,
  groups,
  sort,
  attention,
  footer,
  seats,
  selectedId,
  canWrite,
  wide,
  onOpen,
}: {
  /** Строки в порядке показа. */
  rows: RosterRow[]
  groups: RosterGroup[]
  sort: { by: RosterSort; desc: boolean; onBy: (by: RosterSort) => void; onFlip: () => void }
  /** Сводка «Нужно внимание» над строками. */
  attention?: ReactNode
  /** Под строками и группами: строка общего кода (Ф2.11б-2). */
  footer?: ReactNode
  seats: SeatsState | null
  selectedId: string | null
  /** Без тарифа после пробного — только просмотр (журнал п.41). */
  canWrite: boolean
  /** Список рядом с карточкой (содержимое от 880): одна карточка во всю высоту. */
  wide: boolean
  onOpen: (id: string) => void
}) {
  const [rawFilter, setRawFilter] = useUrlState('filter', (v) => CARD_FILTERS.some((f) => f.id === v))
  const filter = (rawFilter as CardFilter | null) ?? 'all'
  const [query, setQuery] = useState('')
  const shown = rows.filter((r) => matchesFilter(r.card, filter) && matchesQuery(r.card, query))
  const search = useRef<HTMLInputElement>(null)
  const many = wide || rows.length >= SEARCH_FROM_PHONE

  // компьютер: «/» — к поиску (значка в поле нет — решение владельца
  // 20.10.2026), ↑ ↓ — по ученикам (d3-1, d3-3)
  const step = (dir: 1 | -1) => {
    if (!shown.length) return
    const at = shown.findIndex((r) => r.card.id === selectedId)
    const next = at === -1 ? 0 : Math.min(Math.max(at + dir, 0), shown.length - 1)
    onOpen(shown[next]!.card.id)
  }
  useHotkeys({ Slash: () => search.current?.focus(), ArrowDown: () => step(1), ArrowUp: () => step(-1) }, wide)

  const head = (
    <>
      {!canWrite && <p className="text-sm text-fg-muted">Тариф закончился — ученики только для просмотра. Пригласить в приложение можно.</p>}
      {many && (
        <label className="flex min-h-11 items-center gap-2 rounded-control-sm bg-input pl-3 pr-2 text-fg-muted ring-1 ring-control-line">
          <IconSearch size={18} className="flex-none" aria-hidden />
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти ученика"
            aria-label="Найти ученика"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-muted"
          />
        </label>
      )}
      {/* Телефон — одна строка с прокруткой вбок (t6-1): край строки — до края
          экрана, видно, что там есть ещё. Компьютер — перенос (d3). Строка с
          прокруткой режет и по высоте, а рамка чипа — кольцо снаружи кнопки:
          py-1 даёт ей место (иначе верх и низ рамки срезаны), -my-1 оставляет
          отступы как были. */}
      <ChoiceGroup
        label="Статус"
        options={CARD_FILTERS.map((f) => ({ id: f.id, label: f.label }))}
        value={filter}
        onChange={(id) => setRawFilter(id === 'all' ? null : id)}
        className={wide ? '' : '-mx-4 -my-1 flex-nowrap! overflow-x-auto px-4 py-1 scrollbar-none'}
      />
    </>
  )

  const body =
    rows.length === 0 ? (
      <Card className="text-center">
        <p className="font-semibold">Пока ни одного ученика</p>
        <p className="mt-1 text-sm text-fg-muted">
          Добавь ученика — карточку можно вести и без приложения, а пригласить в Recall потом, когда понадобится.
        </p>
      </Card>
    ) : (
      <>
        <Seats seats={seats} />
        {attention}
        <div className="flex items-center justify-between gap-2 pl-1" data-roster-head>
          <span className="text-note font-medium text-fg-muted">Ученики · {shown.length}</span>
          <SortControl {...sort} />
        </div>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">{query ? 'Никого не нашлось' : 'Здесь пока никого'}</p>
        ) : (
          <ul className={wide ? '-mx-3.5 divide-y divide-line' : 'divide-y divide-line overflow-hidden rounded-row bg-surface shadow-card'}>
            {shown.map((r) => (
              <li key={r.card.id} data-card-row={r.card.id}>
                <Row row={r} selected={r.card.id === selectedId} onOpen={() => onOpen(r.card.id)} />
              </li>
            ))}
          </ul>
        )}
        {groups.length > 0 && filter === 'all' && !query && (
          <>
            <p className="mt-2 pl-1 text-note font-medium text-fg-muted">Группы · {groups.length}</p>
            <ul className={wide ? '-mx-3.5 divide-y divide-line' : 'divide-y divide-line overflow-hidden rounded-row bg-surface shadow-card'} data-roster-groups>
              {groups.map((g) => (
                <li key={g.id}>
                  <RowCard flat to={g.to} lead={<AvatarView name={g.title} group strong />} title={g.title} desc={g.line} />
                </li>
              ))}
            </ul>
          </>
        )}
        {footer}
      </>
    )

  if (!wide) {
    return (
      <div className="flex flex-col gap-3">
        {head}
        {body}
      </div>
    )
  }
  // компьютер: карточка во всю высоту — шапка стоит, строки прокручиваются (d3-1)
  return (
    <section aria-label="Ученики" className="relative flex h-full flex-col overflow-hidden rounded-row bg-surface shadow-card">
      <div className="flex flex-none flex-col gap-2.5 border-b border-line p-3.5 pb-2.5">{head}</div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3.5 pb-8 pt-2.5">{body}</div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-b from-transparent to-surface" />
    </section>
  )
}

/** «В приложении 3 из 5 мест тарифа» и полоска по местам (t6-1). */
function Seats({ seats }: { seats: SeatsState | null }) {
  const line = seatsLine(seats)
  if (!line) return null
  const used = seats?.seats_used ?? 0
  const total = typeof seats?.seats === 'number' ? seats.seats : 0
  return (
    <p className="flex items-center gap-2 px-1 text-note text-fg-secondary" data-seats-line>
      <IconSmartphone size={15} aria-hidden className="flex-none text-fg-muted" />
      <span className="flex-1">{line}</span>
      {total > 0 && total <= 10 ? (
        // по одной черточке на место — до 10 мест (Mini 5); больше — сплошная полоса
        <span aria-hidden className="flex flex-none gap-0.75">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={`h-1.5 w-3.5 rounded-full ${i < used ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </span>
      ) : (
        <span aria-hidden className="h-1.5 w-14 flex-none overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${total ? Math.min(100, (used / total) * 100) : 0}%` }} />
        </span>
      )}
    </p>
  )
}

/** «Ближайший урок ⌄» — меню из двух порядков (d3-5) и ↑↓ — направление. */
function SortControl({ by, desc, onBy, onFlip }: { by: RosterSort; desc: boolean; onBy: (by: RosterSort) => void; onFlip: () => void }) {
  const { open, leaving, close, trigger, box } = useMenu()
  const current = ROSTER_SORTS.find((s) => s.id === by) ?? ROSTER_SORTS[0]!
  return (
    <div ref={box} className="relative flex items-center gap-1">
      <button
        type="button"
        {...trigger}
        className={`inline-flex min-h-11 items-center gap-0.5 whitespace-nowrap rounded-control-sm pl-2.5 pr-1.5 text-sm font-semibold transition-colors duration-(--dur-1) ${
          open ? 'bg-accent-soft text-accent-soft-fg' : 'text-accent-strong active:bg-ghost-press'
        }`}
      >
        {current.label}
        <IconCaretDown size={18} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onFlip}
        aria-label={`${current.label}, ${desc ? 'по убыванию' : 'по возрастанию'}. Нажми, чтобы сменить`}
        className="flex size-11 items-center justify-center rounded-control-sm bg-accent-soft text-accent-soft-fg active:bg-accent-soft-press"
      >
        <IconArrowUp size={20} aria-hidden className={`transition-transform duration-(--dur-2) ${desc ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <MenuPanel leaving={leaving} title="Сортировать" className="right-0 top-full mt-1 w-68 origin-top-right">
          {ROSTER_SORTS.map((s) => (
            <MenuRadio
              key={s.id}
              checked={s.id === by}
              label={s.label}
              hint={s.hint}
              onSelect={() => {
                onBy(s.id)
                close()
              }}
            />
          ))}
        </MenuPanel>
      )}
    </div>
  )
}

/** Строка ученика (общий RowCard в списке): аватар, имя, бейджи, урок, остаток. */
function Row({ row, selected, onOpen }: { row: RosterRow; selected: boolean; onOpen: () => void }) {
  const { card } = row
  return (
    <RowCard
      flat
      current={selected}
      onClick={onOpen}
      lead={row.trialAsk ? <AvatarView name={card.name} cardOnly Icon={IconSparkle} /> : <Avatar name={card.name} inApp={card.inApp} />}
      trailing={row.trailing ?? <span aria-hidden />}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{card.name}</span>
          {card.inApp && <IconSmartphone size={14} aria-label="в приложении" className="flex-none text-fg-muted" />}
          {card.status !== 'active' && <StatusBadge status={card.status} small />}
          {row.mark && (
            <span title={`Домашка ${row.mark}`} className="flex-none">
              <Badge tone="warning" small>
                {row.mark}
              </Badge>
            </span>
          )}
        </span>
      }
      desc={
        <>
          <span className={row.trialAsk ? 'font-medium text-accent-strong' : ''}>{row.line}</span>
          {row.outside && (
            <span className="mt-1 block w-fit rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-soft-fg">Вне мест тарифа</span>
          )}
        </>
      }
    />
  )
}

