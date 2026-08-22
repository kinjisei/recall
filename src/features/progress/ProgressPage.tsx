// ============================================================================
// «Мой прогресс» (роут /progress) — не в нижней навигации: вход через аватар
// в шапке и ссылку в стрик-герое.
// График недели + четыре метрики из уже существующих данных (activity_log,
// review_states) + выход из аккаунта (перенесён сюда с Главной).
// ============================================================================
import { useEffect, useState } from 'react'
import { useSmartBack } from '../../components/SmartBack'
import {
  IconBack,
  IconMaterials,
  IconMcq,
  IconTrophy,
  IconBadgeCheck,
  IconSignOut,
  type IconProps,
} from '../../components/icons'
import { AppLink } from '../../components/AppLink'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase, currentUserId } from '../../lib/supabase'
import { getBestStreak, getStreak, getWeek, type WeekDay } from '../../lib/activity'
import { getDeckIds } from '../../lib/cards'
import { countDueCards } from '../../lib/fsrs'
import { statusOf, type StatusInput } from '../../lib/wordChecks'
import { getStudentDiagnostics } from '../../lib/diagnostics'
import { grammarCatalog } from '../../lib/diagnosticsBrief'

/**
 * «Над чем поработать» — своя диагностика ученика (блок «Режим самоучки»).
 * Те же данные, что видит преподаватель в карте ученика (lib/diagnostics), но
 * ПРО СЕБЯ и с ученическим языком. Никакого teacherOnly-пути: читается свой uid
 * под RLS (эти же данные ученик уже видит в прогрессе и «Моих ошибках»). 0 ⚡.
 */
interface WeakSpots {
  struggling: { front: string; back: string | null; lapses: number }[]
  weakTopics: { title: string; count: number }[]
}

async function loadWeakSpots(lang: 'en' | 'es'): Promise<WeakSpots | null> {
  const userId = await currentUserId()
  if (!userId) return null
  const [diag, cat] = await Promise.all([getStudentDiagnostics(userId), grammarCatalog(lang)])
  const titles = new Map(cat.topics.map((t) => [t.id, t.title]))
  const weakTopics = diag.mistakes
    .filter((m) => m.lang === lang)
    .map((m) => ({ title: titles.get(m.topicId) ?? `тема №${m.topicId}`, count: m.count }))
  return { struggling: diag.words.struggling, weakTopics }
}

interface Metrics {
  learned: number
  accuracy: number | null
  best: number
  tomorrow: number
}

/** Строка расписания в том виде, в каком её выбирает loadMetrics. */
type MetricRow = StatusInput & { reps: number | null; lapses: number | null }

/** Метрики по колоде текущего языка: выучено, точность, к повторению завтра. */
async function loadMetrics(lang: 'en' | 'es'): Promise<Omit<Metrics, 'best'>> {
  const userId = await currentUserId()
  if (!userId) return { learned: 0, accuracy: null, tomorrow: 0 }

  const deckIds = await getDeckIds(lang)
  if (deckIds.length === 0) return { learned: 0, accuracy: null, tomorrow: 0 }

  const { data } = await supabase
    .from('review_states')
    .select('state, reps, lapses, due, last_review, cards!inner(deck_id)')
    .eq('user_id', userId)
    .in('cards.deck_id', deckIds)

  const rows = (data ?? []) as unknown as MetricRow[]

  // «Изучено» — общий statusOf (review + интервал ≥ 21 дня). Своей формулы тут
  // быть не должно: раньше считалось любое слово в состоянии review, и ученик
  // на этом экране видел больше «изученных», чем преподаватель в его же
  // диагностической карте.
  const learned = rows.filter((r) => statusOf(r).status === 'learned').length

  // Истории отдельных оценок мы не храним, поэтому точность считаем как долю
  // повторений, прошедших без срыва: (все reps − все lapses) / все reps.
  const reps = rows.reduce((n, r) => n + (r.reps ?? 0), 0)
  const lapses = rows.reduce((n, r) => n + (r.lapses ?? 0), 0)
  const accuracy = reps > 0 ? Math.round(((reps - lapses) / reps) * 100) : null

  // «К завтрашнему дню» — тот же countDueCards, что и счётчик на Главной,
  // только с горизонтом до конца завтрашнего дня. Считать по одной таблице
  // review_states нельзя: совсем новые карточки в неё ещё не попали, и число
  // выходило меньше, чем на Главной.
  const until = new Date()
  until.setDate(until.getDate() + 1)
  until.setHours(23, 59, 59, 999)
  const tomorrow = await countDueCards(lang, until)

  return { learned, accuracy, tomorrow }
}

export function ProgressPage() {
  const goBack = useSmartBack('/')
  const { signOut } = useAuth()
  const { lang } = useLanguage()
  const [week, setWeek] = useState<WeekDay[]>([])
  const [streak, setStreak] = useState(0)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [weak, setWeak] = useState<WeakSpots | null>(null)

  useEffect(() => {
    getWeek().then(setWeek).catch(() => {})
    getStreak().then(setStreak).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setWeak(null)
    loadWeakSpots(lang)
      .then((w) => alive && setWeak(w))
      .catch(() => alive && setWeak(null))
    return () => {
      alive = false
    }
  }, [lang])

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
          onClick={goBack}
          aria-label="Назад"
          className="lift -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--night-text-70)]"
        >
          <IconBack size={20} />
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
          Icon={IconMaterials}
          label="Слов изучено"
          value={metrics ? String(metrics.learned) : '—'}
          hint="перешли в долгое повторение"
          delay=".12s"
        />
        <Metric
          Icon={IconMcq}
          label="Точность"
          value={metrics?.accuracy === null || !metrics ? '—' : `${metrics.accuracy}%`}
          hint="повторений без срыва"
          delay=".18s"
        />
        <Metric
          Icon={IconTrophy}
          label="Лучшая серия"
          value={metrics ? `${metrics.best}` : '—'}
          hint={streak > 0 ? `сейчас — ${streak}` : 'дней подряд'}
          delay=".24s"
        />
        <Metric
          Icon={IconBadgeCheck}
          label="К завтрашнему дню"
          value={metrics ? String(metrics.tomorrow) : '—'}
          hint="карточек к повторению"
          delay=".3s"
        />
      </section>

      {/* Над чем поработать — своя диагностика (Режим самоучки). Показываем
          только когда есть что показать; пусто → короткая похвала, а не пустой
          блок. */}
      {weak && (weak.struggling.length > 0 || weak.weakTopics.length > 0) && (
        <section
          className="animate-fade-up flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-[var(--night-surface)] p-5"
          style={{ animationDelay: '.34s' }}
        >
          <h2 className="text-lg font-medium tracking-tight">Над чем поработать</h2>

          {weak.struggling.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-[var(--night-text-70)]">Слова, что буксуют</p>
              <ul className="flex flex-col gap-1.5">
                {weak.struggling.map((w) => (
                  <li key={w.front} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{w.front}</span>
                      {w.back && <span className="text-[var(--night-text-40)]"> — {w.back}</span>}
                    </span>
                    <span className="flex-none text-xs text-[var(--night-text-40)]">
                      срывов {w.lapses}
                    </span>
                  </li>
                ))}
              </ul>
              <AppLink
                to="/practice?m=review"
                className="text-sm text-[var(--night-accent-text)] hover:underline"
              >
                Повторить эти слова →
              </AppLink>
            </div>
          )}

          {weak.weakTopics.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-[var(--night-text-70)]">Слабые темы грамматики</p>
              <ul className="flex flex-col gap-1.5">
                {weak.weakTopics.map((t) => (
                  <li key={t.title} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">{t.title}</span>
                    <span className="flex-none text-xs text-[var(--night-text-40)]">
                      ошибок {t.count}
                    </span>
                  </li>
                ))}
              </ul>
              <AppLink
                to="/grammar?mistakes=1"
                className="text-sm text-[var(--night-accent-text)] hover:underline"
              >
                Разобрать мои ошибки →
              </AppLink>
            </div>
          )}
        </section>
      )}

      <button
        onClick={signOut}
        className="lift animate-fade-up mt-2 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] px-4 py-3.5 text-[var(--night-text-70)]"
        style={{ animationDelay: '.36s' }}
      >
        <IconSignOut size={18} />
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
  Icon: (p: IconProps) => React.JSX.Element
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
        <IconCmp size={18} />
      </span>
      <span className="text-2xl font-medium tabular-nums">{value}</span>
      <span className="text-[13px] leading-tight">
        {label}
        <span className="block text-[11px] text-[var(--night-text-40)]">{hint}</span>
      </span>
    </div>
  )
}
