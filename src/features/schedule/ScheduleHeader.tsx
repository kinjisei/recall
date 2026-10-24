// ============================================================================
// Шапка расписания (макеты t2, d1). Телефон: «Расписание» и справа вверху
// «таблица / список», под ними «День / Неделя», ниже ‹ дата › и «Сегодня».
// Компьютер — одной строкой, как в d1: ‹ › в рамках, период 24, «Сегодня T»
// … «День / Неделя» и «таблица / список» прямоугольными сегментами,
// «+ Новый урок N» (клавиши T и N слушает ScheduleScreen). Таблица и список —
// у дня и у недели (правка владельца 05.10.2026, PLAN.md Ф2.10).
// ============================================================================
import { dayLong, weekTitle } from '../../domains/schedule'
import { Button } from '../../shared/ui/Button'
import { IconChevronLeft, IconChevronRight, IconColumns, IconList, IconPlus } from '../../shared/ui/icons'
import { Kbd } from '../../shared/ui/Kbd'
import { TabPicker } from '../../shared/ui/TabPicker'
import type { ScheduleLayout, ScheduleView } from './useScheduleUrl'

const VIEWS = [
  { id: 'day' as const, label: 'День' },
  { id: 'week' as const, label: 'Неделя' },
]

/** «Таблица / список» — сегментом, как «День / Неделя» рядом (t2-2, d1): дорожка поля, выбранный — плашка segment. */
function LayoutToggle({ layout, square, onLayout }: { layout: ScheduleLayout; square: boolean; onLayout: (l: ScheduleLayout) => void }) {
  const shape = square ? 'rounded-tile' : 'rounded-full'
  const item = (id: ScheduleLayout, label: string, Icon: typeof IconList) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={layout === id}
      onClick={() => onLayout(id)}
      className={`relative flex size-11 items-center justify-center transition-colors duration-(--dur-1) ${shape} ${
        layout === id ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'
      }`}
    >
      {layout === id && <span aria-hidden className={`absolute inset-0.75 bg-segment shadow-segment ${square ? 'rounded-tag' : 'rounded-full'}`} />}
      <Icon size={18} className="relative" />
    </button>
  )
  return (
    <div role="group" aria-label="Таблица или список" className={`inline-flex flex-none bg-input ${shape}`}>
      {item('cols', 'Таблицей по часам', IconColumns)}
      {item('list', 'Списком', IconList)}
    </div>
  )
}

export function ScheduleHeader({
  view,
  layout,
  day,
  monday,
  isCurrent,
  desktop,
  canWrite,
  onView,
  onLayout,
  onShift,
  onToday,
  onNew,
}: {
  view: ScheduleView
  layout: ScheduleLayout
  day: string
  monday: string
  /** На экране сегодня (день) или эта неделя — «Сегодня» не нужно. */
  isCurrent: boolean
  desktop: boolean
  canWrite: boolean
  onView: (v: ScheduleView) => void
  onLayout: (l: ScheduleLayout) => void
  /** −1 — назад, 1 — вперёд: на день или на неделю. */
  onShift: (dir: -1 | 1) => void
  onToday: () => void
  onNew: () => void
}) {
  const unit = view === 'day' ? 'день' : 'неделя'
  const period = view === 'day' ? dayLong(day) : weekTitle(monday, !desktop)
  // компьютер (d1): стрелки — квадраты в рамке на поверхности; телефон (t2) — без рамки
  const arrow = `flex size-11 flex-none items-center justify-center rounded-control-sm ${
    desktop ? 'bg-surface text-fg inset-ring inset-ring-line hover:bg-row-press' : 'text-fg-secondary hover:bg-tint/[0.06]'
  }`
  const arrows = (
    <>
      <button type="button" aria-label={view === 'day' ? 'Предыдущий день' : 'Предыдущая неделя'} onClick={() => onShift(-1)} className={arrow}>
        <IconChevronLeft size={20} />
      </button>
      {!desktop && <Period text={period} unit={unit} desktop={false} />}
      <button type="button" aria-label={view === 'day' ? 'Следующий день' : 'Следующая неделя'} onClick={() => onShift(1)} className={arrow}>
        <IconChevronRight size={20} />
      </button>
      {desktop && <Period text={period} unit={unit} desktop />}
    </>
  )
  const switcher = (
    <TabPicker variant="segment" square={desktop} stretch options={VIEWS} value={view} onChange={onView} ariaLabel="Вид расписания" />
  )

  if (desktop) {
    return (
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="sr-only">Расписание</h1>
        {arrows}
        <Button size="sm" variant="outline" onClick={onToday} disabled={isCurrent} className="px-3!">
          Сегодня <Kbd show="pointer">T</Kbd>
        </Button>
        <span className="flex-1" />
        <div className="w-52">{switcher}</div>
        <LayoutToggle layout={layout} square onLayout={onLayout} />
        <Button size="sm" onClick={onNew} disabled={!canWrite} className="pl-3.5! pr-3!">
          <IconPlus size={18} /> Новый урок <Kbd show="pointer" onPrimary={canWrite}>N</Kbd>
        </Button>
      </header>
    )
  }
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Расписание</h1>
        <LayoutToggle layout={layout} square={false} onLayout={onLayout} />
      </div>
      {switcher}
      <div className="flex items-center gap-1">
        {arrows}
        <button
          type="button"
          onClick={onToday}
          disabled={isCurrent}
          className="min-h-11 flex-none rounded-control-sm px-3 text-sm font-semibold text-accent-strong hover:bg-tint/[0.06] disabled:text-fg-muted disabled:hover:bg-transparent"
        >
          Сегодня
        </button>
      </div>
    </header>
  )
}

/** Период между стрелками (телефон) или после них (компьютер, 24 — как заголовок экрана d1). */
function Period({ text, unit, desktop }: { text: string; unit: string; desktop: boolean }) {
  return (
    <h2 aria-live="polite" className={`min-w-0 truncate font-semibold text-fg tabular-nums ${desktop ? 'mx-1 text-2xl' : 'flex-1 text-center text-base'}`}>
      <span className="sr-only">{unit}: </span>
      {text}
    </h2>
  )
}
