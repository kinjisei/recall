// ============================================================================
// Упражнения с правкой руками (макет d17, PLAN.md Ф2.25-3): у каждого
// «Изменить · Убрать», форма открывается на месте упражнения; «+ Упражнение»
// — выбор вида тремя группами (d17-3) и «Напишу сам» — пустая форма в конце
// (d17-3б). «↻ Заменить» и «Составит AI» — Ф2.25-4: их здесь нет.
//
// «Готово» проверяет форму тем же фильтром, что ответ AI (`checkEdit`,
// domains/materials): причина — у поля, после первого нажатия обновляется
// на ходу. Открытая форма — черновиком (`draftScope`): переживает
// перезагрузку; черновик чужого упражнения (текст перегенерирован) забыт.
// ============================================================================
import { useEffect, useState } from 'react'
import { blankDraft, checkEdit, exerciseProblems, toDraft, type ExerciseDraft } from '../../../../domains/materials'
import { formatById, formatOf, formatTitle, GROUPS } from '../../../../lib/exerciseFormats'
import { loadIrregular } from '../../../../lib/wordForms'
import { useDraft } from '../../../../shared/lib/useDraft'
import { useConfirm } from '../../../../shared/ui/ConfirmDialog'
import { IconPencil, IconPlus, IconTrash } from '../../../../shared/ui/icons'
import type { AppLang, ExerciseFormatId, MaterialExercise } from '../../../../types'
import { ExerciseRow } from '../detailParts'
import { FormatPicker } from '../FormatPicker'
import { useIrregular } from '../useIrregular'
import { ExerciseEditor } from './ExerciseEditor'

/** Текст, к которому упражнения: слова «из текста», кнопки True / False по языку и уровню. */
export interface EditText {
  body: string
  lang: AppLang
  level: string
}

/** Черновик открытой формы на шаге «Текст» мастера; «Очистить» мастера стирает и его. */
export const EXERCISE_EDIT_DRAFT = 'material-exercise-edit'

/** Открытая форма: какое упражнение (или новое), что в форме, было ли «Готово». */
interface Open {
  at: number | 'new'
  draft: ExerciseDraft
  /** Упражнение до правки — по нему черновик узнаёт своё после перезагрузки. */
  was: MaterialExercise | null
  /** Новое: сколько упражнений было, когда открыли, — к другому списку черновик не прилипнет. */
  count?: number
  tried: boolean
}

const json = (v: unknown) => JSON.stringify(v)
const fits = (o: Open, list: MaterialExercise[]) => (o.at === 'new' ? o.count === list.length : o.at < list.length && json(list[o.at]) === json(o.was))
const changed = (o: Open) => json(o.draft) !== json(o.was ? toDraft(o.was) : blankDraft(o.draft.format))

export function ExerciseList({
  exercises,
  onChange,
  text,
  draftScope,
  disabled = false,
  onPending,
}: {
  exercises: MaterialExercise[]
  onChange: (next: MaterialExercise[]) => void
  text: EditText
  /** Черновик открытой формы: мастер — `material-exercise-edit`. */
  draftScope: string
  disabled?: boolean
  /** Номер упражнения с правкой без «Готово» (null — такой нет): «Сохранить» спросит, а не потеряет её молча. */
  onPending?: (n: number | null) => void
}) {
  const [stored, setOpen] = useDraft<Open | null>(draftScope, null)
  const open = stored && fits(stored, exercises) ? stored : null
  const irregular = useIrregular(text.lang)
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<ExerciseFormatId | null>(null)
  const { confirm, dialog } = useConfirm()
  const n = (o: Open) => (o.at === 'new' ? exercises.length + 1 : o.at + 1)
  const pending = open && changed(open) ? n(open) : null
  useEffect(() => onPending?.(pending), [pending, onPending])

  /** Открыта другая форма с правками — спросить, бросить ли их. */
  const leave = async () =>
    !open ||
    !changed(open) ||
    confirm({ title: `Бросить правку упражнения ${n(open)}?`, body: 'Что ты в нём поменял, не сохранится.', action: 'Бросить', cancel: 'Продолжить правку' })

  const start = async (next: Open) => {
    if (!(await leave())) return
    setFatal(null)
    setAdding(false)
    setPicked(null)
    setOpen(next)
  }

  const remove = async (i: number) => {
    const ok = await confirm({ title: `Убрать упражнение ${i + 1}?`, body: 'Его не будет в материале.', action: 'Убрать', cancel: 'Оставить', danger: true })
    if (!ok) return
    onChange(exercises.filter((_, j) => j !== i))
    // открытая форма ниже убранного — съезжает на одно место; новая — помнит, что упражнений стало меньше
    if (open?.at === 'new') setOpen({ ...open, count: exercises.length - 1 })
    else if (open && open.at >= i) setOpen(open.at === i ? null : { ...open, at: open.at - 1 })
  }

  const done = async () => {
    if (!open) return
    setBusy(true)
    // слово «из текста» — и в форме из справочника (took ⇒ take): дождаться его
    const forms = await loadIrregular(text.lang).catch(() => undefined)
    setBusy(false)
    const ctx = { ...text, irregular: forms }
    const r = checkEdit(open.draft, ctx, open.was ?? undefined)
    if (!r.ok) {
      setOpen({ ...open, tried: true })
      setFatal(Object.keys(exerciseProblems(open.draft, ctx)).length ? null : (r.problems.prompt ?? null))
      return
    }
    onChange(open.at === 'new' ? [...exercises, r.exercise] : exercises.map((e, j) => (j === open.at ? r.exercise : e)))
    setFatal(null)
    setOpen(null)
  }

  const editor = (o: Open) => (
    <ExerciseEditor
      key={o.at === 'new' ? 'new' : o.at}
      n={n(o)}
      label={formatTitle(formatById(o.draft.format), text.level)}
      isNew={o.at === 'new'}
      draft={o.draft}
      onChange={(draft) => {
        setFatal(null)
        setOpen({ ...o, draft })
      }}
      problems={o.tried ? exerciseProblems(o.draft, { ...text, irregular }) : {}}
      fatal={fatal}
      target={text}
      busy={busy || disabled}
      onDone={() => void done()}
      onCancel={() => {
        setFatal(null)
        setOpen(null)
      }}
    />
  )

  return (
    <div className="@container flex flex-col gap-3" data-exercise-list>
      {exercises.map((ex, i) =>
        open?.at === i ? (
          editor(open)
        ) : (
          <ExerciseRow
            key={i}
            n={i + 1}
            ex={ex}
            lang={text.lang}
            actions={
              disabled ? undefined : (
                <>
                  <RowAction label="Изменить" n={i + 1} onClick={() => void start({ at: i, draft: toDraft(ex), was: ex, tried: false })}>
                    <IconPencil size={15} aria-hidden />
                  </RowAction>
                  <RowAction label="Убрать" n={i + 1} quiet disabled={exercises.length <= 1} onClick={() => void remove(i)}>
                    <IconTrash size={15} aria-hidden />
                  </RowAction>
                </>
              )
            }
          />
        ),
      )}
      {open?.at === 'new' && editor(open)}
      {!disabled && (
        <AddExercise
          open={adding}
          onToggle={() => setAdding(!adding)}
          picked={picked}
          onPick={setPicked}
          onWrite={(format) => void start({ at: 'new', draft: blankDraft(format), was: null, count: exercises.length, tried: false })}
          text={text}
          has={new Set(exercises.map(formatOf))}
        />
      )}
      {dialog}
    </div>
  )
}

/** «✎ Изменить», «🗑 Убрать» в шапке упражнения (d17 `.ac17`); на телефоне — 44. */
function RowAction({ label, n, quiet = false, disabled = false, onClick, children }: { label: string; n: number; quiet?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={`${label} упражнение ${n}`}
      title={disabled ? 'Последнее упражнение не убрать' : undefined}
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

/** «+ Упражнение» (d17-3): вид тремя группами, «Выбрано: Грамматика · …» и «Напишу сам». */
function AddExercise({
  open,
  onToggle,
  picked,
  onPick,
  onWrite,
  text,
  has,
}: {
  open: boolean
  onToggle: () => void
  picked: ExerciseFormatId | null
  onPick: (id: ExerciseFormatId) => void
  onWrite: (id: ExerciseFormatId) => void
  text: EditText
  has: ReadonlySet<ExerciseFormatId>
}) {
  const f = picked ? formatById(picked) : null
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
        <div className="flex flex-wrap items-center gap-2 rounded-control bg-surface p-3 inset-ring-1 inset-ring-line">
          <span className="grow text-sm text-fg-secondary">
            Выбрано:{' '}
            <b className="font-semibold text-fg">
              {GROUPS.find((g) => g.id === f.group)?.label} · {formatTitle(f, text.level)}
            </b>
          </span>
          <button type="button" onClick={() => onWrite(f.id)} className="inline-flex h-11 items-center gap-1.5 rounded-tile bg-surface px-3.5 text-sm font-semibold text-fg inset-ring-1 inset-ring-line active:bg-ghost-press">
            <IconPencil size={16} aria-hidden /> Напишу сам
          </button>
        </div>
      )}
    </div>
  )
}
