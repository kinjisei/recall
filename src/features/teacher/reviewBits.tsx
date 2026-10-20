// ============================================================================
// Куски проверки задания по материалу (макет d7-2, PLAN.md Ф2.17-4в-1): текст
// материала свёрнутой строкой, полоса «AI предлагает…», карточка упражнения с
// ответом ученика и вердиктом «Правильно / Ошибка», итог справа.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { Reveal } from '../../shared/ui/Reveal'
import { Card } from '../../shared/ui/Card'
import { IconBook, IconCaretDown, IconCheck, IconClose, IconSparkle } from '../../shared/ui/icons'
import { plural } from '../../shared/lib/plural'
import { wordCount } from '../writing'

/** «Текст материала "My morning" · свёрнут · 120 слов» — раскрывается на месте (d7-2 `.mat`). */
export function MaterialText({ title, body, lang }: { title: string; body: string; lang: string }) {
  const [open, setOpen] = useState(false)
  const words = wordCount(body)
  return (
    <section className="overflow-hidden rounded-control-lg bg-surface shadow-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-row-press"
      >
        <IconBook size={20} aria-hidden className="flex-none text-accent-strong" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-medium text-fg">Текст материала «{title}»</span>
          <span className="text-note text-fg-muted">
            {open ? '' : 'свёрнут · '}
            {words} {plural(words, 'слово', 'слова', 'слов')}
          </span>
        </span>
        <IconCaretDown size={18} aria-hidden className={`flex-none text-fg-muted transition-transform duration-(--dur-2) ${open ? 'rotate-180' : ''}`} />
      </button>
      <Reveal open={open}>
        <p lang={lang} className="whitespace-pre-wrap border-t border-line px-4 py-3.5 text-body leading-relaxed text-fg-secondary">
          {body}
        </p>
      </Reveal>
    </section>
  )
}

/** Полоса AI на мягкой подложке (d7-2 `.aiban`): «AI предлагает засчитать 1 из 2 — проверь вердикты». */
export function AiBanner({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 rounded-control bg-accent-soft px-4 py-3 text-body font-medium text-accent-soft-fg">
      <IconSparkle size={18} aria-hidden className="flex-none" />
      <span>{children}</span>
    </p>
  )
}

/** Вердикт по упражнению (d7-2 `.vd`): «✓ Правильно | × Ошибка», выбранный — цветом статуса. */
export function Verdict({ ok, onChange }: { ok: boolean; onChange: (ok: boolean) => void }) {
  // кнопки 44 (цель касания; в макете 34 внутри полосы 40) — полоса без своих полей
  const btn = 'flex min-h-11 items-center gap-1.5 rounded-control-sm px-3 text-sm font-medium transition-colors duration-(--dur-1)'
  return (
    <div role="radiogroup" aria-label="Вердикт" className="flex gap-0.5 self-start rounded-control-sm bg-input">
      <button
        type="button"
        role="radio"
        aria-checked={ok}
        onClick={() => onChange(true)}
        className={`${btn} ${ok ? 'bg-success-soft font-semibold text-success-strong inset-ring-2 inset-ring-success' : 'text-fg-muted'}`}
      >
        <IconCheck size={16} aria-hidden /> Правильно
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!ok}
        onClick={() => onChange(false)}
        className={`${btn} ${!ok ? 'bg-danger-soft font-semibold text-danger-strong inset-ring-2 inset-ring-danger' : 'text-fg-muted'}`}
      >
        <IconClose size={16} aria-hidden /> Ошибка
      </button>
    </div>
  )
}

/** Ответ ученика (d7-2 `.ans`): полоска слева цветом вердикта, под неверным — правильный. */
export function AnswerBox({ who, given, correct, ok, lang }: { who: string; given: string; correct: string; ok: boolean; lang: string }) {
  return (
    <div
      className={`relative flex flex-col gap-1 overflow-hidden rounded-control-sm bg-input py-2.5 pl-4 pr-3.5 text-body before:absolute before:inset-y-0 before:left-0 before:w-0.75 ${
        ok ? 'before:bg-success' : 'before:bg-danger'
      }`}
    >
      <small className="text-xs text-fg-muted">Ответ {who}</small>
      <span lang={lang} className="text-fg">
        {given}
      </span>
      {!ok && correct && (
        <>
          <small className="mt-1 text-xs text-fg-muted">Правильно</small>
          <span lang={lang} className="font-semibold text-success-strong">
            {correct}
          </span>
        </>
      )}
    </div>
  )
}

/** Карточка упражнения (d7-2 `.exc`): номер и задание, ответ, вердикт, комментарий. */
export function ExerciseCard({ n, prompt, children }: { n: number; prompt: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-4.5!">
      <p className="flex gap-2.5 text-body font-medium text-fg">
        <span className="flex size-6.5 flex-none items-center justify-center rounded-lg bg-input text-note font-semibold text-fg-secondary">{n}</span>
        <span className="pt-0.5">{prompt}</span>
      </p>
      {children}
    </Card>
  )
}

/** Итог справа (d7-2 `.side7`): «1 из 2», правильно и ошибки, главное действие, «Дальше откроется». */
export function ReviewSummary({
  ok,
  total,
  action,
  next,
}: {
  ok: number
  total: number
  action: ReactNode
  /** «Айгерим Нурланова · IELTS Task 2» — что откроется после «Завершить». */
  next?: string | null
}) {
  return (
    <section aria-label="Итог проверки" className="flex flex-col gap-3 rounded-card bg-surface p-4.5 shadow-card">
      <span className="text-note text-fg-muted">Итог</span>
      <span className="text-3xl font-semibold tabular-nums text-fg">
        {ok} из {total}
      </span>
      <div className="flex justify-between text-sm text-fg-secondary">
        <span>Правильно</span>
        <b className="font-semibold text-fg tabular-nums">{ok}</b>
      </div>
      <div className="flex justify-between text-sm text-fg-secondary">
        <span>Ошибка</span>
        <b className="font-semibold text-fg tabular-nums">{total - ok}</b>
      </div>
      {action}
      {next && (
        <p className="flex flex-col gap-0.5 border-t border-line pt-2.5 text-note text-fg-muted">
          <span>Дальше откроется</span>
          <b className="text-sm font-medium text-fg">{next}</b>
        </p>
      )}
    </section>
  )
}
