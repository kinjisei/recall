// ============================================================================
// Выбор вида упражнения тремя группами («По тексту», «Словарь»,
// «Грамматика»): в плане материала (d16-2) и в «+ Упражнение» на шаге
// «Текст» и в библиотеке (d17-3). Вид из каталога `lib/exerciseFormats`.
// ============================================================================
import type { ReactNode } from 'react'
import { IconCheck } from '../../../shared/ui/icons'
import { FORMATS, GROUPS, MAX_ROWS, formatDoes } from '../../../lib/exerciseFormats'
import type { AppLang, ExerciseFormatId } from '../../../types'

/**
 * Выбор видов тремя группами. В плане (d16-2) вид, который уже есть, — «✓ в
 * плане» и не нажимается; в «+ Упражнение» (d17-3) — «✓ уже есть», но
 * выбрать его можно (второй вопрос того же вида), выбранный — подсвечен.
 */
export function FormatPicker({
  lang,
  level,
  inPlan,
  full = false,
  onPick,
  label = 'Добавить упражнения',
  tag = 'в плане',
  again = false,
  selected,
}: {
  lang: AppLang
  level: string
  inPlan: ReadonlySet<ExerciseFormatId | null>
  full?: boolean
  onPick: (id: ExerciseFormatId) => void
  label?: string
  /** Пометка вида, который уже есть. */
  tag?: string
  /** Вид, который уже есть, можно выбрать ещё раз (d17-3). */
  again?: boolean
  selected?: ExerciseFormatId | null
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-1 gap-2.5 rounded-control-lg bg-surface p-3 shadow-raised ring-1 ring-line @xl:grid-cols-3">
      {GROUPS.map((g) => (
        <div key={g.id} className="flex flex-col gap-1.5">
          <b className="mx-1.5 my-0.5 text-xs font-bold uppercase tracking-wide text-accent-strong">{g.label}</b>
          <small className="mx-1.5 -mt-1 mb-0.5 text-xs leading-snug text-fg-muted">{g.note}</small>
          {FORMATS.filter((f) => f.group === g.id).map((f) => {
            const added = inPlan.has(f.id)
            return (
              <PickOption
                key={f.id}
                added={added}
                tag={tag}
                on={selected === f.id}
                disabled={(added && !again) || full}
                onClick={() => onPick(f.id)}
                title={f.label}
                does={formatDoes(f, lang, level)}
              />
            )
          })}
        </div>
      ))}
      {full && <p className="text-note text-fg-muted @xl:col-span-3">В плане уже {MAX_ROWS} видов — чтобы добавить другой, убери один</p>}
    </div>
  )
}

const PICK_ON = 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus'
const PICK_HOVER = 'hover:bg-accent-soft hover:text-accent-soft-fg hover:inset-ring-2 hover:inset-ring-focus'

function PickOption({
  added,
  tag,
  on,
  disabled,
  onClick,
  title,
  does,
}: {
  added: boolean
  tag: string
  on: boolean
  disabled: boolean
  onClick: () => void
  title: string
  does: ReactNode
}) {
  const look = on
    ? PICK_ON
    : added
      ? `text-fg-secondary inset-ring-1 inset-ring-line ${disabled ? '' : PICK_HOVER}`
      : `bg-input text-fg ${PICK_HOVER} disabled:text-fg-faint disabled:hover:bg-input disabled:hover:inset-ring-0`
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on || undefined} data-pick={title} className={`flex flex-col gap-0.5 rounded-tile p-2.5 text-left text-sm leading-tight ${look}`}>
      <b className="flex items-center gap-1.5 font-semibold">
        {title}
        {added && (
          <span className="ml-auto inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-success-soft px-1.5 py-px text-caption font-semibold text-success-soft-fg">
            <IconCheck size={12} aria-hidden />
            {tag}
          </span>
        )}
      </b>
      <small className={`text-xs ${on ? 'text-accent-soft-fg' : 'text-fg-secondary'}`}>{does}</small>
    </button>
  )
}
