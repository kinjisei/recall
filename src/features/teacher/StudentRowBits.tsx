// ============================================================================
// Сводка «Нужно внимание» над списком «Учеников» (StudentsTab): кто
// просрочил домашку или пропал — без открытия карточки (журнал п.76 (5)).
// Вторая строка ученика с Ф2.17-4б-1 — ближайший урок (roster.tsx).
// Подписи — lib/studentSignals.
// ============================================================================
import type { StudentCard } from '../../domains/students'
import { byAttention, type StudentSignal } from '../../lib/studentSignals'
import type { StudentInfo } from '../../lib/teacher'

export interface StudentRow {
  card: StudentCard
  info: StudentInfo | null
  signal: StudentSignal | null
}

/** Человеческий срок последнего занятия. */
export function lastSeen(s: StudentInfo): string {
  const d = s.daysSinceActive
  if (d === null) return 'ещё не начинал'
  if (d === 0) return 'занимался сегодня'
  if (d === 1) return 'был вчера'
  return `не заходил ${d} ${d < 5 ? 'дня' : 'дней'}`
}

/** «Нужно внимание: N» над списком — кто просрочил домашку или пропал. */
export function AttentionSummary({ watched, count }: { watched: StudentRow[]; count: number }) {
  if (count <= 0) return null
  // компактно — сверх макета, над строками (журнал п.76 (5)): две строки, без пояснения
  return (
    <div className="rounded-control bg-warning-surface px-3 py-2.5 ring-1 ring-inset ring-warning-line" data-attention-summary>
      <p className="text-note font-semibold text-warning-soft-fg">Нужно внимание: {count}</p>
      <p className="mt-0.5 line-clamp-2 text-note text-fg-secondary">
        {byAttention(watched, (r) => r.signal as StudentSignal)
          .filter((r) => r.signal?.attention === 'overdue' || r.signal?.attention === 'lost')
          .map((r) => `${r.card.name} — ${r.signal?.overdue ? 'домашка просрочена' : lastSeen(r.info as StudentInfo)}`)
          .join(' · ')}
      </p>
    </div>
  )
}
