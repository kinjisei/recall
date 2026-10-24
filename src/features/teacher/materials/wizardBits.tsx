// ============================================================================
// Куски мастера нового материала (макеты d8-2…d8-5, PLAN.md Ф2.17-4в-2б):
// шапка «‹ Материалы · Новый материал» со шагами «① Заявка — ② План —
// ③ Текст», карточка формы, поле с подписью, подсказка под полем и «Итог»
// справа (на телефоне — под формой). Пройденный шаг — ссылка: «назад» к нему
// без потерь (wizard.ts), готовый шаг впереди — тоже.
// ============================================================================
import type { ReactNode } from 'react'
import { ScreenTop } from '../../../shared/ui/BackButton'
import { IconAlert, IconCheck, IconInfo } from '../../../shared/ui/icons'
import { lengthLabel } from '../../../lib/materialLengths'
import type { AppLang, CEFRLevel } from '../../../types'
import { assignNote, namesLine } from './audience'

export type WizardStepId = 'form' | 'plan' | 'text'
const STEP_LABEL: Record<WizardStepId, string> = { form: 'Заявка', plan: 'План', text: 'Текст' }

/** Как дойти до шага: null — сейчас тут или он ещё не готов. */
export type StepGo = Partial<Record<WizardStepId, (() => void) | null>>

function Stepper({ steps, current, go }: { steps: WizardStepId[]; current: WizardStepId; go: StepGo }) {
  const at = steps.indexOf(current)
  return (
    <ol aria-label="Шаги" className="flex items-center gap-1 rounded-control-sm bg-surface p-1 shadow-card">
      {steps.map((id, i) => {
        const cur = id === current
        const onGo = cur ? null : go[id] ?? null
        const done = i < at
        const mark = done ? <IconCheck size={14} aria-hidden /> : i + 1
        const circle = cur
          ? 'bg-primary text-primary-fg'
          : onGo
            ? 'bg-accent-soft text-accent-soft-fg'
            : 'text-fg-muted inset-ring-2 inset-ring-fg-faint'
        const body = (
          <>
            <span className={`flex size-6 flex-none items-center justify-center rounded-full text-xs font-bold ${circle}`}>{mark}</span>
            {STEP_LABEL[id]}
          </>
        )
        return (
          <li key={id} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-line" />}
            {onGo ? (
              <button
                type="button"
                onClick={onGo}
                className="flex min-h-11 items-center gap-2 rounded-control-sm pl-1.5 pr-3 text-sm font-medium text-accent-strong underline decoration-1 underline-offset-3 active:bg-ghost-press"
              >
                {body}
              </button>
            ) : (
              <span
                aria-current={cur ? 'step' : undefined}
                className={`flex min-h-9 items-center gap-2 rounded-tile pl-1.5 pr-3 text-sm ${cur ? 'bg-accent-soft font-semibold text-accent-soft-fg' : 'font-medium text-fg-muted'}`}
              >
                {body}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** «‹ Материалы  Новый материал  ① Заявка — ② План — ③ Текст» (d8-2 `.t8`). «Мой текст» — без плана. */
export function WizardTop({ current, own = false, go, onExit }: { current: WizardStepId; own?: boolean; go: StepGo; onExit: () => void }) {
  const steps: WizardStepId[] = own ? ['form', 'text'] : ['form', 'plan', 'text']
  return <ScreenTop back={{ label: 'Материалы', onClick: onExit }} title="Новый материал" trailing={<Stepper steps={steps} current={current} go={go} />} />
}

/** Карточка формы (d8-2 `.fcard`): поля через 18. */
export function FormCard({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section aria-label={label} className="flex flex-col gap-4.5 rounded-card bg-surface px-5.5 pb-5.5 pt-5 shadow-card">
      {children}
    </section>
  )
}

/** Подпись поля (d8-2 `.lab`): «Грамматика · необязательно». */
export function FieldLabel({ children, opt = false, aside }: { children: ReactNode; opt?: boolean; aside?: ReactNode }) {
  return (
    <div className="mx-1 mb-2 flex min-h-5 items-center justify-between gap-2 text-note font-medium text-fg-muted">
      <span>
        {children}
        {opt && <span className="font-normal"> · необязательно</span>}
      </span>
      {aside}
    </div>
  )
}

/** Подсказка под полем (d8-2 `.hn`): «i» или предупреждение жёлтым значком. */
export function Hint({ warn = false, children }: { warn?: boolean; children: ReactNode }) {
  const Icon = warn ? IconAlert : IconInfo
  return (
    <p className="mx-1 mt-2 flex items-start gap-1.5 text-sm leading-snug text-fg-secondary">
      <Icon size={16} aria-hidden className={`mt-0.5 flex-none ${warn ? 'text-warning-strong' : 'text-fg-muted'}`} />
      <span>{children}</span>
    </p>
  )
}

export interface SummaryItem {
  label: string
  value: ReactNode
  note?: ReactNode
}

/** «Итог» справа (d8-2 `.sum8`): что получится, сколько генераций, главное действие. */
export function Summary({ items, gen, children }: { items: SummaryItem[]; gen?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label="Итог" className="flex flex-col gap-3.5 rounded-card bg-surface p-4.5 shadow-card">
      <h2 className="text-note font-semibold text-fg-muted">Итог</h2>
      <dl className="flex flex-col gap-3">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="text-xs text-fg-muted">{it.label}</dt>
            <dd className="mt-0.5 text-body leading-snug text-fg">
              {it.value}
              {it.note && <small className="block text-note text-fg-secondary">{it.note}</small>}
            </dd>
          </div>
        ))}
      </dl>
      {gen && <p className="rounded-control-sm bg-input px-3 py-2.5 text-sm leading-snug text-fg-secondary tabular-nums">{gen}</p>}
      <div className="flex flex-col gap-2 pt-1">{children}</div>
    </section>
  )
}

/** «Для кого» и «Уровень» итога — одни и те же на заявке и плане (d8-2, d8-3). */
export function audienceItems(names: string[], level: CEFRLevel, levelNote?: string): SummaryItem[] {
  return [
    { label: 'Для кого', value: names.length ? namesLine(names) : 'Общий материал', note: assignNote(names.length) },
    { label: 'Уровень', value: level, note: levelNote },
  ]
}

export const LANG_NAME: Record<AppLang, string> = { en: 'английский', es: 'испанский' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «Рассказ, ~120 слов, английский» — что получится (d8-2, d8-3). */
export const materialLine = (format: string, length: string, lang: AppLang) => `${cap(format)}, ${lengthLabel(length)}, ${LANG_NAME[lang]}`

/** Остаток генераций строкой: «останется 24 из 25» / «осталось 24 из 25». */
export function gensAfter(gens: { left: number; limit: number } | null, spend: number, word: 'останется' | 'осталось' = 'останется'): string {
  if (!gens) return ''
  return `${word} ${Math.max(0, gens.left - spend)} из ${gens.limit}`
}
