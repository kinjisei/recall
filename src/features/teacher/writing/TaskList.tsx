// ============================================================================
// Список письменных заданий (макет d9-1 `.ls8` + `.r9`, PLAN.md Ф2.17-4в-3):
// одна карточка, в строке — вид «IELTS · Task 2 · band 6.5» цветом акцента,
// вопрос в одну строку и сводка «1 сдано · 1 проверено · 1 назначено» («N
// сдано» — цветом «ждёт»). Выбранная — подложка и рамка фокуса, как у
// библиотеки материалов (LibraryList).
// ============================================================================
import type { WritingTask } from '../../../types'
import { kindLine, tallyLine, type Tally } from './writingFacts'

const NONE: Tally = { submitted: 0, reviewed: 0, assigned: 0 }

export function TaskList({
  tasks,
  tallies,
  selectedId,
  onOpen,
}: {
  tasks: WritingTask[]
  /** Сводка выдач по заданию; не пришла — строки без сводки, а не «не назначено». */
  tallies: ReadonlyMap<string, Tally> | null
  selectedId: string | null
  onOpen: (t: WritingTask) => void
}) {
  return (
    <nav aria-label="Письменные задания" className="flex min-h-full flex-col overflow-hidden rounded-card bg-surface py-2 shadow-card">
      {tasks.map((t, i) => {
        const sel = t.id === selectedId
        const line = i > 0 && tasks[i - 1]?.id !== selectedId && !sel
        const tl = tallies ? (tallies.get(t.id) ?? NONE) : null
        return (
          <button
            key={t.id}
            type="button"
            data-row
            aria-current={sel || undefined}
            onClick={() => onOpen(t)}
            className={`mx-2 flex flex-col gap-1 rounded-control-sm border-t p-3 text-left transition-colors duration-(--dur-1) ${
              sel ? 'border-transparent bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus' : `text-fg hover:bg-row-press active:bg-row-press ${line ? 'border-line' : 'border-transparent'}`
            }`}
          >
            <span className={`text-note font-semibold ${sel ? '' : 'text-accent-strong'}`}>{kindLine(t)}</span>
            <span lang={t.lang} className="truncate text-base font-medium">
              {t.prompt}
            </span>
            {tl && (
              <span className={`text-note ${sel ? '' : 'text-fg-muted'}`}>
                {tl.submitted > 0 ? (
                  <>
                    <b className={`font-semibold ${sel ? '' : 'text-warning-strong'}`}>{tl.submitted} сдано</b>
                    {tallyLine({ ...tl, submitted: 0 }) !== 'не назначено' && ` · ${tallyLine({ ...tl, submitted: 0 })}`}
                  </>
                ) : (
                  tallyLine(tl)
                )}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
