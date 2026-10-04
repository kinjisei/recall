// ============================================================================
// Шапка расписания (макеты t2, d1). Телефон: «Расписание», «День / Неделя»,
// под ними ‹ дата › и «Сегодня». Компьютер — одной строкой: ‹ › период
// «Сегодня» … «День / Неделя», вид недели и «+ Новый урок».
// ============================================================================
import { dayLong, weekTitle } from '../../domains/schedule'
import { Button } from '../../shared/ui/Button'
import { IconChevronLeft, IconChevronRight, IconColumns, IconList, IconPlus } from '../../shared/ui/icons'
import { TabPicker } from '../../shared/ui/TabPicker'
import type { ScheduleView, WeekLayout } from './useScheduleUrl'

const VIEWS = [
  { id: 'day' as const, label: 'День' },
  { id: 'week' as const, label: 'Неделя' },
]

function LayoutToggle({ layout, onLayout }: { layout: WeekLayout; onLayout: (l: WeekLayout) => void }) {
  const item = (id: WeekLayout, label: string, Icon: typeof IconList) => (
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
    <div role="group" aria-label="Вид недели" className="inline-flex flex-none gap-0.5 rounded-full bg-tint/[0.07] p-0.5 ring-1 ring-control-line">
      {item('cols', 'Колонками по часам', IconColumns)}
      {item('list', 'Списком по дням', IconList)}
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
  layout: WeekLayout
  day: string
  monday: string
  /** На экране сегодня (день) или эта неделя — «Сегодня» не нужно. */
  isCurrent: boolean
  desktop: boolean
  canWrite: boolean
  onView: (v: ScheduleView) => void
  onLayout: (l: WeekLayout) => void
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
        {view === 'week' && <LayoutToggle layout={layout} onLayout={onLayout} />}
        <Button className="min-h-11 px-4 py-2 text-sm" onClick={onNew} disabled={!canWrite}>
          <IconPlus size={18} /> Новый урок
        </Button>
      </header>
    )
  }
  return (
    <header className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">Расписание</h1>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{switcher}</div>
        {view === 'week' && <LayoutToggle layout={layout} onLayout={onLayout} />}
      </div>
      <div className="flex items-center gap-1">
        {arrows}
        {today}
      </div>
    </header>
  )
}
