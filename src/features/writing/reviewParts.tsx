// ============================================================================
// Куски проверки письма учителем (макеты d7-3, d7-4; PLAN.md Ф2.17-4в-1):
// текст ученика с пронумерованными правками AI, оценка AI, правки по видам с
// «Оставить / Убрать», выбор итогового балла. Номер правки — по панели (вид,
// внутри — по месту в тексте): нажал цифру в тексте — правка справа, и наоборот.
// ============================================================================
import type { ReactNode } from 'react'
import { ERROR_KINDS, errorKind } from '../../lib/writingGrade'
import type { WritingGrade, WritingTask } from '../../types'
import { ChartView } from '../../components/ChartView'
import { Card } from '../../shared/ui/Card'
import { IconCheck, IconClose } from '../../shared/ui/icons'
import { essayParagraphs, type EssayMark } from './essayMarks'

type Fix = NonNullable<WritingGrade['errors']>[number]

/** Карточка панели (d7-3 `.bandc`): заголовок с тихой подписью справа. */
export function PanelCard({ title, note, children, mine = false }: { title: string; note?: string; children: ReactNode; mine?: boolean }) {
  return (
    <Card className={`flex flex-col gap-3 p-4.5! ${mine ? 'inset-ring-2 inset-ring-ring' : ''}`}>
      <header className="flex items-center justify-between gap-2">
        <h2 className={mine ? 'text-base font-semibold text-fg' : 'text-body font-semibold text-fg'}>{title}</h2>
        {note && <span className="text-xs text-fg-muted">{note}</span>}
      </header>
      {children}
    </Card>
  )
}

/** Текст ученика (d7-3 `.ess`): тема, строка «Айгерим · 251 слов · …», абзацы с пометками правок. */
export function EssayCard({
  task,
  essay,
  meta,
  marks,
  number,
  kept,
  selected,
  onSelect,
}: {
  task: WritingTask
  essay: string
  meta: string
  marks: readonly EssayMark[]
  number: readonly number[]
  kept: readonly boolean[]
  selected: number | null
  onSelect: (i: number) => void
}) {
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface px-6 py-5.5 shadow-card">
      <div className="rounded-control-sm bg-input px-3.5 py-3 text-sm leading-normal text-fg-secondary">
        <b className="mb-0.5 block text-xs font-semibold text-fg-muted">Тема</b>
        <span lang={task.lang}>{task.prompt}</span>
        {task.settings?.chart && (
          <div className="mt-3 rounded-control-sm bg-surface p-3">
            <ChartView chart={task.settings.chart} />
          </div>
        )}
      </div>
      <span className="text-note text-fg-muted">{meta}</span>
      {essay.trim() ? (
        essayParagraphs(essay, marks).map((pieces, p) => (
          <p key={p} lang={task.lang} className="text-lg leading-relaxed text-fg">
            {pieces.map((x, k) =>
              x.mark === undefined ? (
                x.text
              ) : (
                // строчный элемент, а не <button>: кнопка в тексте — сплошной
                // блок, и длинная цитата на телефоне не переносилась по строкам
                <span
                  key={k}
                  role="button"
                  tabIndex={0}
                  data-mark={x.mark}
                  onClick={() => onSelect(x.mark!)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(x.mark!)
                    }
                  }}
                  aria-label={`Правка ${number[x.mark]}: ${x.text}`}
                  className={`cursor-pointer rounded-mark px-0.5 box-decoration-clone focus-visible:outline-2 focus-visible:outline-focus ${
                    selected === x.mark
                      ? 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus'
                      : kept[x.mark]
                        ? 'border-b-2 border-warning bg-warning-soft'
                        : 'line-through decoration-fg-faint'
                  }`}
                >
                  {x.text}
                  <sup
                    className={`relative -top-0.5 ml-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-caption font-bold not-italic no-underline ${
                      selected === x.mark ? 'bg-primary text-primary-fg' : kept[x.mark] ? 'bg-warning text-warning-fg' : 'bg-surface text-fg-muted inset-ring-1 inset-ring-line'
                    }`}
                  >
                    {number[x.mark]}
                  </sup>
                </span>
              ),
            )}
          </p>
        ))
      ) : (
        <p className="text-sm text-fg-muted">(пусто)</p>
      )}
    </article>
  )
}

/** Оценка AI (d7-3): IELTS — band и четыре критерия, эссе — уровень и целевые слова. */
export function AiGrade({ grade, mode }: { grade: WritingGrade; mode: WritingTask['mode'] }) {
  if (mode === 'ielts') {
    const crit: [string, number | undefined][] = [
      ['Task', grade.criteria?.task],
      ['Cohesion', grade.criteria?.coherence],
      ['Lexis', grade.criteria?.lexis],
      ['Grammar', grade.criteria?.grammar],
    ]
    return (
      <PanelCard title="Оценка AI" note="черновик">
        <p className="flex items-baseline gap-2">
          <b className="text-display tabular-nums text-fg">{grade.band ?? '—'}</b>
          <span className="text-sm text-fg-secondary">Band · общий</span>
        </p>
        {grade.criteria && (
          <div className="grid grid-cols-4 gap-1.5">
            {crit.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 rounded-control-sm bg-input px-2.5 py-2">
                <small className="text-xs text-fg-muted">{k}</small>
                <b className="text-base font-semibold tabular-nums text-fg">{v ?? '—'}</b>
              </div>
            ))}
          </div>
        )}
      </PanelCard>
    )
  }
  const chips = [...(grade.targetWords ?? []).map((w) => ({ t: w.w, ok: w.used })), ...(grade.targetGrammar ?? []).map((g) => ({ t: g.t, ok: g.used }))]
  return (
    <PanelCard title="Оценка AI" note="черновик">
      <p className="flex items-baseline gap-2">
        <b className="text-display text-fg">{grade.level || '—'}</b>
        <span className="text-sm text-fg-secondary">Уровень текста</span>
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span key={i} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${c.ok ? 'bg-success-soft text-success-soft-fg' : 'bg-input text-fg-muted'}`}>
              {c.ok ? <IconCheck size={12} aria-hidden /> : <IconClose size={12} aria-hidden />}
              {c.t}
            </span>
          ))}
        </div>
      )}
    </PanelCard>
  )
}

/** Правки по видам в порядке ERROR_KINDS, внутри — по номеру в тексте; вид не узнали — «Другое» в конце. */
export function groupFixes(fixes: readonly Fix[], number: readonly number[]): { label: string; items: number[] }[] {
  const order = [...ERROR_KINDS.map((k) => k.id as string), 'other']
  const labels: Record<string, string> = Object.fromEntries([...ERROR_KINDS.map((k) => [k.id, k.label]), ['other', 'Другое']])
  const groups = new Map<string, number[]>()
  fixes.forEach((f, i) => {
    const k = errorKind(f.type) ?? 'other'
    groups.set(k, [...(groups.get(k) ?? []), i])
  })
  return order
    .filter((k) => groups.has(k))
    .map((k) => ({ label: labels[k] ?? k, items: (groups.get(k) ?? []).sort((a, b) => (number[a] ?? 0) - (number[b] ?? 0)) }))
}

/** Одна правка (d7-3 `.fx`): номер, «было → стало», почему; «Оставить / Убрать». */
export function FixRow({
  fix,
  n,
  kept,
  selected,
  lang,
  onSelect,
  onKeep,
}: {
  fix: Fix
  n: number
  kept: boolean
  selected: boolean
  lang: string
  onSelect: () => void
  onKeep: (keep: boolean) => void
}) {
  // в подложке 14 с полем 2 — кнопки 12: углы концентричны (макет d7: 10 и 8)
  const seg = 'min-h-11 rounded-tile px-2.5 text-note font-medium transition-colors duration-(--dur-1)'
  return (
    <div
      data-fix={n}
      // убранная — приглушённым текстом, а не прозрачностью, как .fx.off в
      // макете: полупрозрачный текст не держит 4,5 : 1 (UX-аудит)
      className={`flex flex-col items-start gap-2 rounded-control-sm px-3 py-2.5 text-sm leading-normal ${
        selected ? 'bg-accent-soft inset-ring-2 inset-ring-focus' : 'bg-input'
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-h-11 w-full min-w-0 items-start gap-2.5 text-left">
        <span
          className={`flex size-5.5 flex-none items-center justify-center rounded-full text-xs font-bold ${
            selected ? 'bg-primary text-primary-fg' : kept ? 'bg-warning text-warning-fg' : 'bg-surface text-fg-muted inset-ring-1 inset-ring-line'
          }`}
        >
          {n}
        </span>
        <span className="min-w-0">
          <s lang={lang} className={kept ? 'text-fg-secondary decoration-danger' : 'text-fg-muted decoration-fg-faint'}>
            {fix.was}
          </s>
          {' → '}
          <span lang={lang} className={`font-semibold ${kept ? 'text-success-strong' : 'text-fg-muted'}`}>
            {fix.fix}
          </span>
          {fix.why && <span className={`block text-note ${kept ? 'text-fg-secondary' : 'text-fg-muted'}`}>{fix.why}</span>}
        </span>
      </button>
      <span role="radiogroup" aria-label={`Правка ${n}`} className="ml-8 flex flex-none gap-0.5 rounded-control-sm bg-surface p-0.5">
        <button type="button" role="radio" aria-checked={kept} onClick={() => onKeep(true)} className={`${seg} ${kept ? 'bg-accent-soft font-semibold text-accent-soft-fg' : 'text-fg-muted'}`}>
          Оставить
        </button>
        <button type="button" role="radio" aria-checked={!kept} onClick={() => onKeep(false)} className={`${seg} ${!kept ? 'bg-accent-soft font-semibold text-accent-soft-fg' : 'text-fg-muted'}`}>
          Убрать
        </button>
      </span>
    </div>
  )
}

/** Итоговый балл (d7-3 `.bsel`): band — AI ±1 шагом 0,5; уровень — A1…C2. */
export function bandChoices(mode: WritingTask['mode'], ai: string, current: string): string[] {
  if (mode !== 'ielts') return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const center = Number(ai) || Number(current) || 6
  const around = [-1, -0.5, 0, 0.5, 1].map((d) => center + d).filter((b) => b >= 0 && b <= 9)
  const cur = Number(current)
  if (current && Number.isFinite(cur) && !around.includes(cur)) around.push(cur)
  return around.sort((a, b) => a - b).map(String)
}

export function BandPicker({ options, value, onChange, label }: { options: string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`min-h-11 flex-1 rounded-control-sm text-body font-semibold tabular-nums transition-colors duration-(--dur-1) ${
            value === o ? 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus' : 'bg-input text-fg'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
