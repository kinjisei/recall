// ============================================================================
// Серия дней подряд на Главной: число, неделя полосками, «Мой прогресс».
// Вынесено из DashboardPage.tsx без правок поведения (PLAN.md Ф2.9 — Главная
// не растёт).
// ============================================================================
import { IconArrowRight, IconFlame } from '../../shared/ui/icons'
import { AppLink } from '../../shared/ui/AppLink'
import type { WeekDay } from '../../lib/activity'

export function StreakHero({
  streak,
  week,
  didToday,
  perfect = false,
}: {
  streak: number
  week: WeekDay[]
  didToday: boolean
  /** Все пункты плана дня выполнены — пламя «золотое». */
  perfect?: boolean
}) {
  const hint = perfect
    ? 'Идеальный день: весь план выполнен ✦'
    : didToday
    ? 'Сегодня засчитано — так держать!'
    : streak > 0
      ? 'Позанимайся, чтобы не потерять серию'
      : 'Занимайся каждый день — серия растёт'

  return (
    // Фон и пятно — токены hero-* (в тёмной — прежние цвета, в светлой —
    // бледно-лавандовая карточка с тенью); форма градиента та же, что была.
    <div
      className="animate-fade-up relative overflow-hidden rounded-3xl border border-accent/25 bg-radial-[140%_160%_at_15%_0%] from-hero via-hero-mid via-55% to-hero-edge p-5 shadow-card"
      style={{ animationDelay: '.06s' }}
    >
      {/* размытое акцентное пятно справа-сверху */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-radial-[circle] from-hero-glow to-transparent to-70% blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-fg-tertiary">Серия дней подряд</p>
          <p className="mt-1.5 flex items-center gap-2.5">
            <IconFlame
              size={34}
              className={`animate-flame ${perfect ? 'text-warning-strong' : 'text-accent-soft-fg'}`}
            />
            <span className="animate-pop-in text-4xl font-medium tabular-nums">{streak}</span>
          </p>
        </div>
        <p className="max-w-[48%] pt-1 text-right text-sm leading-snug text-fg-tertiary">
          {hint}
        </p>
      </div>

      {/* неделя: 7 полосок */}
      <div className="relative mt-5 flex items-end gap-1.5">
        {week.map((d, i) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`animate-grow-bar h-1.5 w-full rounded-full ${
                d.active ? 'bg-accent' : 'bg-tint/[0.09]'
              } ${d.isToday && !d.active ? 'ring-1 ring-accent-line' : ''}`}
              // заметный каскад слева направо: пн → вт → ср → …
              style={{ animationDelay: `${0.2 + i * 0.12}s` }}
            />
            <span
              className={`text-micro ${
                d.isToday ? 'text-accent-strong' : 'text-fg-muted'
              }`}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>

      <AppLink
        to="/progress"
        className="relative mt-3 inline-flex min-h-11 items-center gap-1 text-sm text-accent-strong hover:underline"
      >
        Мой прогресс <IconArrowRight size={14} />
      </AppLink>
    </div>
  )
}
