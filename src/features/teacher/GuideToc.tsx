// Описание: src/features/teacher/CLAUDE.md
// ============================================================================
// Оглавление методички (макет d9-3 `.toc`): «Содержание», разделы с номером
// (пройденный — галочкой), текущий — подложкой и с подразделами, где текущий
// отмечен чертой слева; внизу — «Прочитано 38% · место запомнится». На
// компьютере стоит справа от текста и держится в окне, на телефоне —
// раскрывается над текстом (GuideSection).
// ============================================================================
import { IconCheck } from '../../shared/ui/icons'

export interface TocSection {
  id: string
  /** Номер раздела; у вступления нет. */
  num?: number
  title: string
  blocks: string[]
}

export function GuideToc({
  sections,
  at,
  block,
  read,
  progress,
  onGo,
}: {
  sections: TocSection[]
  at: number
  block: number
  read: string[]
  progress: number
  /** Перейти к разделу или его подразделу. */
  onGo: (id: string, block?: number) => void
}) {
  return (
    <nav aria-label="Содержание" className="flex flex-col gap-0.5 rounded-card bg-surface px-2.5 pb-3.5 pt-4 shadow-card">
      <h2 className="px-2.5 pb-2 text-note font-semibold text-fg-muted">Содержание</h2>
      {sections.map((s, i) => {
        const cur = i === at
        const done = !cur && read.includes(s.id)
        return (
          <div key={s.id} className="flex flex-col">
            <button
              type="button"
              aria-current={cur ? 'location' : undefined}
              onClick={() => onGo(s.id)}
              className={`flex min-h-11 items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm leading-snug ${
                cur ? 'bg-accent-soft font-semibold text-accent-soft-fg' : done ? 'text-fg-muted hover:bg-row-press' : 'text-fg-secondary hover:bg-row-press'
              }`}
            >
              <span aria-hidden className={`w-4 flex-none font-semibold tabular-nums ${cur ? '' : done ? 'text-success-strong' : 'text-fg-muted'}`}>
                {done || (!s.num && !cur) ? <IconCheck size={14} className={done ? 'mt-0.5' : 'invisible'} /> : s.num}
              </span>
              {s.title}
            </button>
            {cur && s.blocks.length > 0 && (
              <div className="mb-1 ml-6.5 mt-0.5 flex flex-col border-l-2 border-line">
                {s.blocks.map((b, j) => (
                  <button
                    key={b}
                    type="button"
                    aria-current={j === block ? 'location' : undefined}
                    onClick={() => onGo(s.id, j)}
                    className={`-ml-0.5 min-h-11 rounded-r-lg border-l-2 py-1.5 pl-3.5 pr-2.5 text-left text-note leading-snug ${
                      j === block ? 'border-focus font-semibold text-accent-soft-fg' : 'border-transparent text-fg-secondary hover:bg-row-press'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <div className="mx-2.5 mt-2.5 flex flex-col gap-1.5 border-t border-line pt-3 text-note text-fg-secondary">
        <span className="tabular-nums">Прочитано {progress}% · место запомнится</span>
        <span className="h-1.5 overflow-hidden rounded-full bg-input">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </span>
      </div>
    </nav>
  )
}
