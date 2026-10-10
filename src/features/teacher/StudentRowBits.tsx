// ============================================================================
// Вторая строка ученика в списке и сводка «Нужно внимание» (вкладка
// «Ученики», StudentsTab): ответ на вопрос «кем заняться» без открытия
// карточки. Вынесено из StudentsTab — вкладка упиралась в предел размера.
// Подписи и порядок — lib/studentSignals.
// ============================================================================
import type { StudentCard } from '../../domains/students'
import { byAttention, type StudentSignal } from '../../lib/studentSignals'
import type { StudentInfo } from '../../lib/teacher'
import { Card } from '../../shared/ui/Card'

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

/** Вторая строка: у ученика в приложении — домашка и регулярность, без приложения — контакт. */
export function RowDetail({ row, card }: { row: StudentRow | undefined; card: StudentCard }) {
  if (row?.info && row.signal) {
    const s = row.signal
    return (
      <>
        {/* Домашка — первое, что нужно перед уроком: «3 из 5 · до вторника». */}
        <span className={`block truncate text-sm ${s.overdue ? 'text-warning-soft-fg' : 'text-fg-secondary'}`}>
          {s.homeworkText ? `${s.homeworkText} · ${s.dueText}` : 'Домашка не выдана'}
        </span>
        {/* ⚠️ Регулярность, а не объём: «занимался 5 дней из 7» — привычка. */}
        <span className="block truncate text-sm text-fg-muted">
          занимался {s.regularity} · <span className={s.lost ? 'text-warning-soft-fg' : ''}>{lastSeen(row.info)}</span>
        </span>
      </>
    )
  }
  return <span className="block truncate text-sm text-fg-muted">{card.contact || 'без приложения'}</span>
}

/** «Нужно внимание: N» над списком — кто просрочил домашку или пропал. */
export function AttentionSummary({ watched, count }: { watched: StudentRow[]; count: number }) {
  if (count <= 0) return null
  return (
    <Card tone="warning">
      <p className="text-sm font-semibold text-warning-soft-fg">Нужно внимание: {count}</p>
      <p className="mt-1 text-sm text-fg-secondary">
        {byAttention(watched, (r) => r.signal as StudentSignal)
          .filter((r) => r.signal?.attention === 'overdue' || r.signal?.attention === 'lost')
          .map((r) => `${r.card.name} — ${r.signal?.overdue ? 'домашка просрочена' : lastSeen(r.info as StudentInfo)}`)
          .join(' · ')}
      </p>
      <p className="mt-2 text-xs text-fg-muted">
        {watched.some((r) => r.signal?.lost)
          ? 'Неделя без занятий — обычно момент, когда стоит написать самому.'
          : 'Срок домашки прошёл, а сделано не всё.'}
      </p>
    </Card>
  )
}
