// ============================================================================
// «Мои уроки» ученика (PLAN.md Ф2.9; макет u2; журнал п.32, 33, 43):
// ближайшие уроки и ссылка на урок, прошедшие — свёрнуты, внизу тихая строка
// остатка без акцента. Вход — «Все уроки» на Главной и уведомления об уроках
// (?lesson= — подсветить урок, на который вело уведомление, макет u3-1).
// Без связи — LoadError с «Повторить», а не «Уроков пока нет» (Ф1.13).
// ============================================================================
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  balanceLines,
  joinLessonId,
  loadMyLessonBalances,
  loadMyLessons,
  MY_LESSONS_AHEAD_DAYS,
  MY_LESSONS_BACK_DAYS,
  splitMyLessons,
} from '../../domains/schedule'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useNow } from '../../shared/lib/useNow'
import { BackButton } from '../../shared/ui/BackButton'
import { EmptyState } from '../../shared/ui/EmptyState'
import { IconCalendar, IconCaretDown, IconTicket } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { LessonRow } from './LessonRow'

const DAY_MS = 86_400_000

async function loadMine() {
  const now = Date.now()
  const [lessons, balances] = await Promise.all([
    loadMyLessons(new Date(now - MY_LESSONS_BACK_DAYS * DAY_MS), new Date(now + MY_LESSONS_AHEAD_DAYS * DAY_MS)),
    loadMyLessonBalances(),
  ])
  return { lessons, balances }
}

/** Тихая строка остатка (журнал п.33): мелко, приглушённо, без красного и кнопок. */
function BalanceLines({ lines }: { lines: string[] }) {
  if (!lines.length) return null
  return (
    <div data-balance-line className="flex flex-col items-center gap-1 text-note text-fg-muted">
      {lines.map((l) => (
        <p key={l} className="flex items-center gap-1.5">
          <IconTicket size={14} aria-hidden />
          {l}
        </p>
      ))}
    </div>
  )
}

export function MyLessonsPage() {
  const [params] = useSearchParams()
  const highlight = params.get('lesson')
  const now = useNow()
  const { data, error, loading, reload } = useAsyncData(loadMine, [], 'Не удалось загрузить уроки — похоже, пропала связь.')
  // «Прошедшие» свёрнуты; урок из уведомления среди прошедших — раскрыты сами
  const [pastToggled, setPastToggled] = useState<boolean | null>(null)

  const split = data ? splitMyLessons(data.lessons, now) : null
  const joinId = data ? joinLessonId(data.lessons, now) : null
  const lines = data ? balanceLines(data.balances) : []
  const highlightedPast = !!highlight && !!split?.past.some((l) => l.id === highlight)
  const pastOpen = pastToggled ?? highlightedPast

  // урок из уведомления — прокрутить к нему
  useEffect(() => {
    if (!highlight || !data) return
    requestAnimationFrame(() => document.getElementById(`lesson-${highlight}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [highlight, data])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <BackButton fallback="/" label="На главную" />
        <h1 className="text-2xl font-medium tracking-tight">Мои уроки</h1>
      </header>

      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !data && <RowsSkeleton count={4} />}

      {split && split.upcoming.length === 0 && split.past.length === 0 && (
        <EmptyState Icon={IconCalendar} title="Уроков пока нет">
          Их добавляет преподаватель — как только появятся, будут здесь.
        </EmptyState>
      )}

      {split && split.upcoming.length > 0 && (
        <section aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="mb-2 px-1 text-caption font-semibold uppercase tracking-wider text-fg-muted">
            Ближайшие
          </h2>
          <ul className="divide-y divide-tint/[0.06] rounded-2xl border border-tint/[0.08] bg-surface shadow-card">
            {split.upcoming.map((l) => (
              <LessonRow key={l.id} lesson={l} now={now} join={l.id === joinId} highlighted={l.id === highlight} />
            ))}
          </ul>
        </section>
      )}

      {split && split.upcoming.length === 0 && split.past.length > 0 && (
        <p className="px-1 text-sm text-fg-secondary">Ближайших уроков нет — их добавляет преподаватель.</p>
      )}

      {split && split.past.length > 0 && (
        <section>
          <button
            type="button"
            aria-expanded={pastOpen}
            onClick={() => setPastToggled(!pastOpen)}
            className="flex min-h-12 w-full select-none items-center justify-between rounded-2xl border border-tint/[0.08] bg-surface px-4 text-left shadow-card active:scale-[0.99]"
          >
            <span className="font-semibold text-fg">Прошедшие</span>
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              {split.past.length}
              <IconCaretDown size={16} aria-hidden className={`transition-transform duration-200 ${pastOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {pastOpen && (
            <ul className="mt-2 divide-y divide-tint/[0.06] rounded-2xl border border-tint/[0.08] bg-surface">
              {split.past.map((l) => (
                <LessonRow key={l.id} lesson={l} now={now} join={false} highlighted={l.id === highlight} />
              ))}
            </ul>
          )}
        </section>
      )}

      {data && <BalanceLines lines={lines} />}
    </div>
  )
}
