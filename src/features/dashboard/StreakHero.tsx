// ============================================================================
// Серия дней подряд на Главной (макеты u1-1, d4-v2): пламя в круге, число,
// неделя кружками — занимался — залит с галочкой, нет — пунктир, сегодня
// обведён, — и «Мой прогресс». На компьютере (`compact`, d4-v2) карточка
// плотнее: пламя 48 и число 36, на телефоне — 56 и 40.
// ============================================================================
import { IconArrowRight, IconCheck, IconFlame } from '../../shared/ui/icons'
import { AppLink } from '../../shared/ui/AppLink'
import type { WeekDay } from '../../lib/activity'

/** Фон карточки-героя Главной: из левого верхнего угла hero → hero-mid → surface. */
export const HOME_HERO = 'bg-radial-[130%_120%_at_0%_0%] from-hero via-hero-mid via-55% to-surface'

export function StreakHero({
  streak,
  week,
  perfect = false,
  compact = false,
}: {
  streak: number
  week: WeekDay[]
  /** Все пункты плана дня выполнены — пламя «золотое». */
  perfect?: boolean
  compact?: boolean
}) {
  const done = week.filter((d) => d.active).map((d) => d.label)
  return (
    <section
      aria-label="Серия дней подряд"
      className={`animate-fade-up relative flex h-full flex-col overflow-hidden rounded-card inset-ring inset-ring-hero-line ${HOME_HERO} ${compact ? 'gap-3 px-5 pb-1.5 pt-4.5' : 'gap-4 px-5 pb-2 pt-5'}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-17.5 -top-20 size-60 rounded-full bg-radial-[circle] from-hero-glow-soft to-transparent to-70%"
      />
      <div className="relative flex items-center gap-3.5">
        <span
          className={`flex flex-none items-center justify-center rounded-full ${perfect ? 'bg-warning text-warning-fg' : 'bg-accent text-accent-fg'} ${compact ? 'size-12' : 'size-14'}`}
        >
          <IconFlame size={compact ? 24 : 28} aria-hidden className="animate-flame" />
        </span>
        <span className="flex flex-col">
          <span className={`animate-pop-in font-bold leading-none tabular-nums ${compact ? 'text-4xl tracking-tight' : 'text-display'}`}>
            {streak}
          </span>
          <span className="text-body text-accent-soft-fg">Серия дней подряд</span>
        </span>
      </div>

      <div
        role="img"
        aria-label={done.length ? `На этой неделе занимался: ${done.join(', ')}` : 'На этой неделе ещё не занимался'}
        className="relative grid grid-cols-7 gap-1"
      >
        {week.map((d, i) => (
          <div key={d.day} className="flex flex-col items-center gap-1.5 text-xs text-accent-soft-fg">
            <span
              // заметный каскад слева направо: пн → вт → ср → …
              style={{ animationDelay: `${0.15 + i * 0.06}s` }}
              className={`animate-pop-in flex size-8.5 items-center justify-center rounded-full ${d.active ? 'bg-accent text-accent-fg' : 'border-dashed-ring'} ${d.isToday ? 'ring-2 ring-fg ring-offset-2 ring-offset-hero' : ''}`}
            >
              {d.active && <IconCheck size={16} aria-hidden />}
            </span>
            {d.isToday ? <b className="font-semibold">{d.label}</b> : d.label}
          </div>
        ))}
      </div>

      <AppLink
        to="/progress"
        className="relative flex min-h-11 items-center gap-1.5 self-start text-body font-semibold text-accent-soft-fg hover:underline"
      >
        Мой прогресс <IconArrowRight size={16} aria-hidden />
      </AppLink>
    </section>
  )
}
