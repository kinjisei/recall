// ============================================================================
// «Упражнения» в плане материала (макет d16, PLAN.md Ф2.25-2): учитель сам
// выбирает виды и сколько каждого — без генерации. Строка: группа («По
// тексту», «Словарь», «Грамматика»), название и что возьмёт AI, «− 3 вопр. +»,
// корзина; у True / False — «Каверзные вопросы». Под строками — «Добавить
// упражнения»: выбор видов тремя группами, вид в плане — «✓ в плане».
// Пределы (журнал п.76 (8)): до 8 видов, до 10 заданий, пар 3–8. Тот же блок —
// в заявке «Моего текста» (d16-3): шага «План» там нет.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { NumberStepper } from '../../../shared/ui/NumberStepper'
import { useShellInsets } from '../../../shared/lib/shellInsets'
import { Switch } from '../../../shared/ui/Switch'
import { IconCheck, IconInfo, IconPlus, IconTrash } from '../../../shared/ui/icons'
import { FORMATS, GROUPS, MAX_ROWS, formatById, formatDoes, newRow, rowFormat, rowNote, totalsText, type RowContext } from '../../../lib/exerciseFormats'
import type { AppLang, ExerciseFormatId, PlanExercise } from '../../../types'
import { Hint } from './wizardBits'

export function ExercisePlan({
  rows,
  onChange,
  lang,
  ctx,
  disabled = false,
}: {
  rows: readonly PlanExercise[]
  onChange: (rows: PlanExercise[]) => void
  lang: AppLang
  /** Откуда слова и грамматика — подписи строк. */
  ctx: RowContext
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const t = totalsText(rows)
  const inPlan = new Set(rows.map(rowFormat))
  const full = rows.length >= MAX_ROWS
  const set = (i: number, patch: Partial<PlanExercise>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <section aria-label="Упражнения" className="@container flex flex-col gap-2.5" data-exercise-plan>
      <h3 className="mx-1 flex flex-wrap items-baseline gap-x-2">
        <b className="whitespace-nowrap text-body font-semibold">Упражнения · {t.kinds}</b>
        <span className="ml-auto whitespace-nowrap text-note font-normal tabular-nums text-fg-secondary">
          {t.tasks} · {t.points}
        </span>
      </h3>
      <p className="mx-1 mb-0.5 flex gap-2 text-sm leading-snug text-fg-secondary">
        <IconInfo size={16} aria-hidden className="mt-0.5 flex-none text-fg-muted" />
        Всё берётся из текста: словарь — его слова, грамматика — его конструкции, вопросы — по его смыслу
      </p>
      {rows.map((r, i) => (
        <PlanRow
          key={r.format ?? i}
          row={r}
          note={rowNote(r, ctx)}
          disabled={disabled}
          onCount={(count) => set(i, { count })}
          onTricky={(tricky) => set(i, { tricky: tricky || undefined })}
          onRemove={() => onChange(rows.filter((_, j) => j !== i))}
        />
      ))}
      {rows.length === 0 && <Hint warn>Добавь хотя бы один вид — без упражнений материал не собрать</Hint>}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-expanded={open}
          disabled={disabled || (full && !open)}
          onClick={() => setOpen(!open)}
          className={`inline-flex h-11 items-center gap-1.5 rounded-control-sm pl-2.5 pr-3.5 text-body font-semibold disabled:text-fg-faint ${
            open ? 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus' : 'text-accent-strong inset-ring-2 inset-ring-line active:bg-ghost-press'
          }`}
        >
          <IconPlus size={18} aria-hidden /> Добавить упражнения
        </button>
        <span className="text-note tabular-nums text-fg-muted">
          {rows.length} из {MAX_ROWS} видов
        </span>
      </div>
      {open && <FormatPicker lang={lang} level={ctx.level} inPlan={inPlan} full={full} onPick={(id) => onChange([...rows, newRow(id, ctx.words.length)])} />}
    </section>
  )
}

function PlanRow({
  row,
  note,
  disabled,
  onCount,
  onTricky,
  onRemove,
}: {
  row: PlanExercise
  note: string
  disabled: boolean
  onCount: (n: number) => void
  onTricky: (on: boolean) => void
  onRemove: () => void
}) {
  const id = rowFormat(row)
  if (!id) return null
  const f = formatById(id)
  const group = GROUPS.find((g) => g.id === f.group)?.label
  const atMax = row.count >= f.max
  return (
    <div className="flex flex-col gap-2 rounded-control bg-input py-2.5 pl-3.5 pr-2" data-plan-row={id}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 @lg:flex-nowrap">
        {/* accent-soft-fg, а не accent-strong кадра: на подложке input у «Заката» светлой тот не дотягивает до 4,5 : 1 */}
        <span className="w-full flex-none text-xs font-semibold leading-tight text-accent-soft-fg @lg:w-21">{group}</span>
        <span className="flex min-w-0 basis-full flex-col leading-tight @lg:basis-auto @lg:flex-1">
          <b className="text-body font-semibold text-fg">{f.label}</b>
          {note && <small className="text-xs text-fg-secondary">{note}</small>}
        </span>
        <NumberStepper variant="inline" label={`Сколько: ${f.label}`} value={row.count} min={f.min} max={f.max} unit={f.unit} onChange={onCount} disabled={disabled} />
        <button
          type="button"
          aria-label={`Убрать ${f.label}`}
          disabled={disabled}
          onClick={onRemove}
          className="ml-auto flex size-11 flex-none items-center justify-center rounded-tile text-fg-muted active:bg-ghost-press @lg:ml-0"
        >
          <IconTrash size={18} aria-hidden />
        </button>
      </div>
      {atMax && <p className="-mt-1 text-xs font-medium text-warning-strong @lg:ml-24">{f.type === 'match' ? `Максимум ${f.max} пар в одном упражнении` : `Максимум ${f.max} в одном виде`}</p>}
      {id === 'tfng' && (
        <div className="rounded-tile bg-surface px-2.5 @lg:ml-24">
          <Switch
            checked={!!row.tricky}
            onChange={onTricky}
            disabled={disabled}
            label={<b className="text-sm font-semibold">Каверзные вопросы</b>}
            hint="ответ есть в тексте, но его легко пропустить"
          />
        </div>
      )}
    </div>
  )
}

/** Выбор видов (d16-2): три группы, вид в плане — «✓ в плане» и не нажимается. */
function FormatPicker({
  lang,
  level,
  inPlan,
  full,
  onPick,
}: {
  lang: AppLang
  level: string
  inPlan: ReadonlySet<ExerciseFormatId | null>
  full: boolean
  onPick: (id: ExerciseFormatId) => void
}) {
  return (
    <div role="group" aria-label="Добавить упражнения" className="grid grid-cols-1 gap-2.5 rounded-control-lg bg-surface p-3 shadow-raised ring-1 ring-line @xl:grid-cols-3">
      {GROUPS.map((g) => (
        <div key={g.id} className="flex flex-col gap-1.5">
          <b className="mx-1.5 my-0.5 text-xs font-bold uppercase tracking-wide text-accent-strong">{g.label}</b>
          <small className="mx-1.5 -mt-1 mb-0.5 text-xs leading-snug text-fg-muted">{g.note}</small>
          {FORMATS.filter((f) => f.group === g.id).map((f) => {
            const added = inPlan.has(f.id)
            return (
              <PickOption key={f.id} added={added} disabled={added || full} onClick={() => onPick(f.id)} title={f.label} does={formatDoes(f, lang, level)} />
            )
          })}
        </div>
      ))}
      {full && <p className="text-note text-fg-muted @xl:col-span-3">В плане уже {MAX_ROWS} видов — чтобы добавить другой, убери один</p>}
    </div>
  )
}

function PickOption({ added, disabled, onClick, title, does }: { added: boolean; disabled: boolean; onClick: () => void; title: string; does: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-pick={title}
      className={`flex flex-col gap-0.5 rounded-tile p-2.5 text-left text-sm leading-tight ${
        added ? 'text-fg-secondary inset-ring-1 inset-ring-line' : 'bg-input text-fg hover:bg-accent-soft hover:text-accent-soft-fg hover:inset-ring-2 hover:inset-ring-focus disabled:text-fg-faint disabled:hover:bg-input disabled:hover:inset-ring-0'
      }`}
    >
      <b className="flex items-center gap-1.5 font-semibold">
        {title}
        {added && (
          <span className="ml-auto inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-success-soft px-1.5 py-px text-caption font-semibold text-success-soft-fg">
            <IconCheck size={12} aria-hidden />в плане
          </span>
        )}
      </b>
      <small className="text-xs text-fg-secondary">{does}</small>
    </button>
  )
}

/** Полоса итога внизу экрана на телефоне (d16-4): «4 вида · 11 заданий», «до 16 баллов» и главное действие. */
export function PlanBar({ rows, error, children }: { rows: readonly PlanExercise[]; error?: ReactNode; children: ReactNode }) {
  const t = totalsText(rows)
  const { bottom } = useShellInsets()
  return (
    <div style={{ bottom }} className="sticky z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-surface px-4 py-3 shadow-raised" data-plan-bar>
      {error && <div className="basis-full">{error}</div>}
      <span className="flex flex-col leading-tight">
        <b className="text-base font-bold tabular-nums text-fg">
          {t.kinds} · {t.tasks}
        </b>
        <small className="text-xs text-fg-secondary">{t.points}</small>
      </span>
      <span className="flex-1 *:w-full">{children}</span>
    </div>
  )
}
