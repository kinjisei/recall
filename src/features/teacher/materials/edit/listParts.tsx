// ============================================================================
// Кнопки списка упражнений (макет d17): «✎ Изменить · ↻ Заменить · 🗑 Убрать»
// в шапке упражнения и «+ Упражнение» — вид тремя группами, «Выбрано: …»,
// «✦ Составит AI · ещё 23 сегодня» и «Напишу сам» (d17-3).
// ============================================================================
import { formatById, formatTitle, GROUPS } from '../../../../lib/exerciseFormats'
import { IconPencil, IconPlus, IconSparkle } from '../../../../shared/ui/icons'
import type { ExerciseFormatId } from '../../../../types'
import { FormatPicker } from '../FormatPicker'
import type { EditText } from './editText'

/** «✎ Изменить», «↻ Заменить», «🗑 Убрать» в шапке упражнения (d17 `.ac17`); на телефоне — 44. */
export function RowAction({
  label,
  n,
  quiet = false,
  disabled = false,
  title,
  onClick,
  children,
}: {
  label: string
  n: number
  quiet?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={`${label} упражнение ${n}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
      // цель 44 и на компьютере, в раскладке — 32, как в кадре; accent-soft-fg, а не
      // accent-strong кадра: на подложке input у «Заката» светлой тот — 4,47 : 1 (п.76 (20))
      className={`inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-tag px-2.5 text-note font-medium active:bg-ghost-press disabled:text-fg-faint rail:-my-1.5 ${quiet ? 'text-fg-secondary' : 'text-accent-soft-fg'}`}
    >
      {children}
      {label}
    </button>
  )
}

/** «Составит AI» для выбранного вида: подпись остатка и можно ли сейчас; нет — кнопки нет. */
export type AiFor = (id: ExerciseFormatId) => { note: string | null; can: boolean }

/** «+ Упражнение» (d17-3): вид тремя группами, «Выбрано: Грамматика · …», «Составит AI» и «Напишу сам». */
export function AddExercise({
  open,
  onToggle,
  picked,
  onPick,
  onWrite,
  ai,
  onAi,
  text,
  has,
}: {
  open: boolean
  onToggle: () => void
  picked: ExerciseFormatId | null
  onPick: (id: ExerciseFormatId) => void
  onWrite: (id: ExerciseFormatId) => void
  ai?: AiFor
  onAi: (id: ExerciseFormatId) => void
  text: EditText
  has: ReadonlySet<ExerciseFormatId>
}) {
  const f = picked ? formatById(picked) : null
  const a = f && ai ? ai(f.id) : null
  return (
    <div className="flex flex-col gap-2.5" data-add-exercise>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`inline-flex h-11 items-center gap-1.5 self-start rounded-control-sm pl-2.5 pr-3.5 text-body font-semibold ${
          open ? 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus' : 'text-accent-strong inset-ring-2 inset-ring-line active:bg-ghost-press'
        }`}
      >
        <IconPlus size={18} aria-hidden /> Упражнение
      </button>
      {open && <FormatPicker label="Новое упражнение" lang={text.lang} level={text.level} inPlan={has} tag="уже есть" again selected={picked} onPick={onPick} />}
      {open && f && (
        <div className="flex flex-col gap-2.5 rounded-control bg-surface p-3 inset-ring-1 inset-ring-line">
          <span className="text-sm text-fg-secondary">
            Выбрано:{' '}
            <b className="font-semibold text-fg">
              {GROUPS.find((g) => g.id === f.group)?.label} · {formatTitle(f, text.level)}
            </b>
          </span>
          <span className="flex flex-wrap gap-2">
            {a && (
              <button
                type="button"
                disabled={!a.can}
                onClick={() => onAi(f.id)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-tile bg-primary px-3.5 text-left text-sm font-semibold text-primary-fg shadow-card active:bg-primary-press disabled:bg-input disabled:text-fg-faint disabled:shadow-none"
              >
                <IconSparkle size={16} aria-hidden className="flex-none" />
                <span>Составит AI{a.note && ` · ${a.note}`}</span>
              </button>
            )}
            <button type="button" onClick={() => onWrite(f.id)} className="inline-flex h-11 items-center gap-1.5 rounded-tile bg-surface px-3.5 text-sm font-semibold text-fg inset-ring-1 inset-ring-line active:bg-ghost-press">
              <IconPencil size={16} aria-hidden /> Напишу сам
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
