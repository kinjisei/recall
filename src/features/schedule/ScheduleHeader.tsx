// ============================================================================
// Шапка расписания (макеты t2, d1). Телефон: «Расписание» и справа вверху
// «таблица / список», под ними «День / Неделя», ниже ‹ дата › и «Сегодня».
// Компьютер — одной строкой: ‹ › период «Сегодня» … «День / Неделя»,
// «таблица / список» и «+ Новый урок». Таблица и список — у дня и у недели
// (правка владельца 05.10.2026, PLAN.md Ф2.10).
// ============================================================================
import { dayLong, weekTitle } from '../../domains/schedule'
import { Button } from '../../shared/ui/Button'
import { IconChevronLeft, IconChevronRight, IconColumns, IconList, IconPlus } from '../../shared/ui/icons'
import { TabPicker } from '../../shared/ui/TabPicker'
import type { ScheduleLayout, ScheduleView } from './useScheduleUrl'

const VIEWS = [
  { id: 'day' as const, label: 'День' },
  { id: 'week' as const, label: 'Неделя' },
]

function LayoutToggle({ layout, onLayout }: { layout: ScheduleLayout; onLayout: (l: ScheduleLayout) => void }) {
  const item = (id: ScheduleLayout, label: string, Icon: typeof IconList) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={layout === id}
      onClick={() => onLayout(id)}
      className={`flex size-11 items-center justify-center rounded-full transition-colors ${
        layout === id ? 'bg-accent-soft text-accent-soft-fg shadow-card' : 'text-fg-muted hover:text-fg-secondary'
      }`}
    >
      <Icon size={18} />
    </button>
  )
  return (
    <div role="group" aria-label="Таблица или список" className="inline-flex flex-none gap-0.5 rounded-full bg-tint/[0.07] p-0.5 ring-1 ring-control-line">
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
  const arrows = (
    <>
      <button
        type="button"
        aria-label={view === 'day' ? 'Предыдущий день' : 'Предыдущая неделя'}
        onClick={() => onShift(-1)}
        className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-secondary hover:bg-tint/[0.06]"
      >
        <IconChevronLeft size={20} />
      </button>
      <h2 aria-live="polite" className={`min-w-0 truncate font-semibold text-fg ${desktop ? 'text-xl' : 'flex-1 text-center text-base'}`}>
        <span className="sr-only">{unit}: </span>
        {period}
      </h2>
      <button
        type="button"
        aria-label={view === 'day' ? 'Следующий день' : 'Следующая неделя'}
        onClick={() => onShift(1)}
        className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-secondary hover:bg-tint/[0.06]"
      >
        <IconChevronRight size={20} />
      </button>
    </>
  )
  const today = (
    <button
      type="button"
      onClick={onToday}
      disabled={isCurrent}
      className="min-h-11 flex-none rounded-xl px-3 text-sm font-semibold text-accent-strong hover:bg-tint/[0.06] disabled:text-fg-muted disabled:hover:bg-transparent"
    >
      Сегодня
    </button>
  )
  const switcher = <TabPicker variant="segment" stretch options={VIEWS} value={view} onChange={onView} ariaLabel="Вид расписания" />

  if (desktop) {
    return (
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="sr-only">Расписание</h1>
        {arrows}
        {today}
        <span className="flex-1" />
        <div className="w-56">{switcher}</div>
        <LayoutToggle layout={layout} onLayout={onLayout} />
        <Button className="min-h-11 px-4 py-2 text-sm" onClick={onNew} disabled={!canWrite}>
          <IconPlus size={18} /> Новый урок
        </Button>
      </header>
    )
  }
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Расписание</h1>
        <LayoutToggle layout={layout} onLayout={onLayout} />
      </div>
      {switcher}
      <div className="flex items-center gap-1">
        {arrows}
        {today}
      </div>
    </header>
  )
}
