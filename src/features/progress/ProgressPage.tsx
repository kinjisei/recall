// ============================================================================
// «Мой прогресс» (роут /progress) — не в нижней навигации: вход через аватар
// в шапке и ссылку в стрик-герое.
// График недели + четыре метрики из уже существующих данных (activity_log,
// review_states) + выход из аккаунта (перенесён сюда с Главной).
// ============================================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CaretLeftIcon,
  BookmarksIcon,
  TargetIcon,
  TrophyIcon,
  CalendarCheckIcon,
  SignOutIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase, currentUserId } from '../../lib/supabase'
import { getBestStreak, getStreak, getWeek, type WeekDay } from '../../lib/activity'
import { getDeckIds } from '../../lib/cards'

interface Metrics {
  learned: number
  accuracy: number | null
  best: number
  tomorrow: number
}

/** Метрики по колоде текущего языка: выучено, точность, к повторению завтра. */
async function loadMetrics(lang: 'en' | 'es'): Promise<Omit<Metrics, 'best'>> {
  const userId = await currentUserId()
  if (!userId) return { learned: 0, accuracy: null, tomorrow: 0 }

  const deckIds = await getDeckIds(lang)
  if (deckIds.length === 0) return { learned: 0, accuracy: null, tomorrow: 0 }

  const { data } = await supabase
    .from('review_states')
    .select('state, reps, lapses, due, cards!inner(deck_id)')
    .eq('user_id', userId)
    .in('cards.deck_id', deckIds)

  const rows = data ?? []
  const learned = rows.filter((r) => r.state === 'review').length

  // Истории отдельных оценок мы не храним, поэтому точность считаем как долю
  // повторений, прошедших без срыва: (все reps − все lapses) / все reps.
  const reps = rows.reduce((n, r) => n + ((r.reps as number) ?? 0), 0)
  const lapses = rows.reduce((n, r) => n + ((r.lapses as number) ?? 0), 0)
  const accuracy = reps > 0 ? Math.round(((reps - lapses) / reps) * 100) : null

  const until = new Date()
  until.setDate(until.getDate() + 1)
  until.setHours(23, 59, 59, 999)
  const tomorrow = rows.filter((r) => new Date(r.due as string) <= until).length

  return { learned, accuracy, tomorrow }
}

export function ProgressPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { lang } = useLanguage()
  const [week, setWeek] = useState<WeekDay[]>([])
  const [streak, setStreak] = useState(0)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  useEffect(() => {
    getWeek().then(setWeek).catch(() => {})
    getStreak().then(setStreak).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setMetrics(null)
    Promise.all([loadMetrics(lang), getBestStreak()])
      .then(([m, best]) => alive && setMetrics({ ...m, best }))
      .catch(() => alive && setMetrics(null))
    return () => {
      alive = false
    }
  }, [lang])

  const activeDays = week.filter((d) => d.active).length
  const totalItems = week.reduce((n, d) => n + d.items, 0)
  const totalMinutes = week.reduce((n, d) => n + d.minutes, 0)
  const maxItems = Math.max(1, ...week.map((d) => d.items))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="lift -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--night-text-70)]"
        >
          <CaretLeftIcon size={20} />
        </button>
        <h1 className="text-2xl font-medium tracking-tight">Мой прогресс</h1>
      </header>

      {/* График недели */}
      <section
        className="animate-fade-up rounded-3xl border border-white/[0.08] bg-[var(--night-surface)] p-5"
        style={{ animationDelay: '.05s' }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium tracking-tight">Эта неделя</h2>
          <span className="text-sm text-[var(--night-text-40)]">
            {activeDays} {activeDays === 1 ? 'день' : activeDays < 5 ? 'дня' : 'дней'} ·{' '}
            {totalMinutes > 0 ? `${totalMinutes} мин` : `${totalItems} упр.`}
          </span>
        </div>

        <div className="mt-5 flex h-32 items-stretch gap-2">
          {week.map((d, i) => {
            const height = d.items > 0 ? Math.max(12, (d.items / maxItems) * 100) : 4
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                {/* flex-1 задаёт колонке высоту, столбик тянется от низа */}
                <div className="relative w-full flex-1">
                  <div
                    className={`animate-bar-grow absolute bottom-0 w-full rounded-lg ${
                      d.active ? 'bg-[var(--night-accent)]' : 'bg-white/[0.07]'
                    }`}
                    style={{ height: `${height}%`, animationDelay: `${0.1 + i * 0.06}s` }}
                    title={d.items ? `${d.items} упражнений` : 'нет занятий'}
                  />
                </div>
                <span
                  className={`text-[11px] ${
                    d.isToday ? 'text-[var(--night-accent-text)]' : 'text-[var(--night-text-40)]'
                  }`}
                >
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Метрики 2×2 */}
      <section className="grid grid-cols-2 gap-3">
        <Metric
          Icon={BookmarksIcon}
          label="Слов изучено"
          value={metrics ? String(metrics.learned) : '—'}
          hint="перешли в долгое повторение"
          delay=".12s"
        />
        <Metric
          Icon={TargetIcon}
          label="Точность"
          value={metrics?.accuracy === null || !metrics ? '—' : `${metrics.accuracy}%`}
          hint="повторений без срыва"
          delay=".18s"
        />
        <Metric
          Icon={TrophyIcon}
          label="Лучшая серия"
          value={metrics ? `${metrics.best}` : '—'}
          hint={streak > 0 ? `сейчас — ${streak}` : 'дней подряд'}
          delay=".24s"
        />
        <Metric
          Icon={CalendarCheckIcon}
          label="К завтрашнему дню"
          value={metrics ? String(metrics.tomorrow) : '—'}
          hint="карточек к повторению"
          delay=".3s"
        />
      </section>

      <button
        onClick={signOut}
        className="lift animate-fade-up mt-2 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] px-4 py-3.5 text-[var(--night-text-70)]"
        style={{ animationDelay: '.36s' }}
      >
        <SignOutIcon size={18} />
        Выйти из аккаунта
      </button>
    </div>
  )
}

function Metric({
  Icon: IconCmp,
  label,
  value,
  hint,
  delay,
}: {
  Icon: Icon
  label: string
  value: string
  hint: string
  delay: string
}) {
  return (
    <div
      className="animate-fade-up flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4"
      style={{ animationDelay: delay }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
        <IconCmp size={18} weight="fill" />
      </span>
      <span className="text-2xl font-medium tabular-nums">{value}</span>
      <span className="text-[13px] leading-tight">
        {label}
        <span className="block text-[11px] text-[var(--night-text-40)]">{hint}</span>
      </span>
    </div>
  )
}
