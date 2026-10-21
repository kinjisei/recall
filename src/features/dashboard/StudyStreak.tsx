// ============================================================================
// Серия «Моей учёбы» — одна на телефон (карточка t1-4б) и компьютер (сводка
// d12): фон-градиент с пятном, пламя в круге, число и «дней подряд», неделя
// кружками — занимался — залит, нет — пунктир, — под кружками подписи дней
// «пн … вс», сегодняшний — жирнее (решение владельца 22.10.2026: на компьютере
// серия — как на телефоне).
// ============================================================================
import type { WeekDay } from '../../lib/activity'
import { plural } from '../../shared/lib/plural'
import { IconFlame } from '../../shared/ui/icons'

/** Фон серии: из левого верхнего угла hero → hero-mid → hero-edge, рамка акцентом. */
export const STREAK_HERO = 'relative overflow-hidden rounded-card border border-accent/30 bg-radial-[130%_120%_at_0%_0%] from-hero via-hero-mid via-55% to-hero-edge'

/** Мягкое пятно в правом верхнем углу фона серии. */
export function StreakGlow() {
  return <div aria-hidden className="pointer-events-none absolute -right-18 -top-20 size-60 rounded-full bg-radial-[circle] from-hero-glow to-transparent to-70%" />
}

/** Пламя в круге и «5 дней подряд». */
export function StreakCount({ streak }: { streak: number }) {
  return (
    <>
      <span className="flex size-12 flex-none items-center justify-center rounded-full bg-accent text-accent-fg">
        <IconFlame size={24} aria-hidden />
      </span>
      <span className="flex flex-col whitespace-nowrap">
        <span className="text-3xl font-bold leading-none tabular-nums">{streak}</span>
        <span className="text-sm text-accent-soft-fg">{plural(streak, 'день подряд', 'дня подряд', 'дней подряд')}</span>
      </span>
    </>
  )
}

/** Неделя пн → вс: кружок и подпись дня под ним. */
export function WeekDots({ week }: { week: WeekDay[] }) {
  const done = week.filter((d) => d.active).map((d) => d.label)
  return (
    <span
      role="img"
      aria-label={done.length ? `На этой неделе занимался: ${done.join(', ')}` : 'На этой неделе ещё не занимался'}
      className="flex flex-none gap-1"
      data-week-dots
    >
      {week.map((d) => (
        <span key={d.day} className="flex w-4 flex-col items-center gap-1">
          <i className={`size-3 rounded-full ${d.active ? 'bg-accent' : 'border-2 border-dashed border-accent/50'}`} />
          <span className={`text-caption leading-none ${d.isToday ? 'font-semibold text-fg' : 'text-fg-secondary'}`}>{d.label}</span>
        </span>
      ))}
    </span>
  )
}
