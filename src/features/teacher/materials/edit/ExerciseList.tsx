// ============================================================================
// Упражнения с правкой (макет d17, PLAN.md Ф2.25-3, -4б): у каждого
// «Изменить · ↻ Заменить · Убрать», форма открывается на месте упражнения;
// «+ Упражнение» — выбор вида тремя группами (d17-3), «Составит AI» и
// «Напишу сам» — пустая форма в конце (d17-3б). Замена через AI — пока AI
// пишет, скелетон строки (d17-2); кончились — плашка (d17-3в).
//
// «Готово» проверяет форму тем же фильтром, что ответ AI (`checkEdit`,
// domains/materials): причина — у поля, после первого нажатия обновляется
// на ходу. Открытая форма — черновиком (`draftScope`): переживает
// перезагрузку; черновик чужого упражнения (текст перегенерирован) забыт.
// Мастер меняет шаг «Текст» сразу; библиотека пишет в базу (Ф2.25-3б) —
// `onChange` ждём, и не сохранилось — форма остаётся открытой.
//
// Правки ложатся ПО ОЧЕРЕДИ и в список на момент записи (`commit`): ответ AI
// приходит позже нажатия, учитель тем временем правит другое упражнение, —
// иначе одна запись затёрла бы другую (а в библиотеке — устаревшая версия).
// ============================================================================
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { blankDraft, checkEdit, exerciseProblems, toDraft, type ExerciseDraft } from '../../../../domains/materials'
import { formatById, formatOf, formatTitle } from '../../../../lib/exerciseFormats'
import { loadIrregular } from '../../../../lib/wordForms'
import { useDraft } from '../../../../shared/lib/useDraft'
import { useConfirm } from '../../../../shared/ui/ConfirmDialog'
import { ErrorText } from '../../../../shared/ui/ErrorText'
import { IconPencil, IconRefresh, IconTrash } from '../../../../shared/ui/icons'
import type { ExerciseFormatId, MaterialExercise } from '../../../../types'
import type { EditText } from './editText'
import { ExerciseRow, rowLabel } from '../detailParts'
import { useIrregular } from '../useIrregular'
import { ExerciseEditor } from './ExerciseEditor'
import { AddExercise, RowAction } from './listParts'
import { SwapSkeleton, SwapsOut } from './swapParts'
import { aiButtonNote, canSwap, hasStrong, keyOf, strongOf, type SwapPlan } from './swapPlan'
import { NEW, useExerciseSwap, type CommitResult } from './useExerciseSwap'
import type { SwapBudget } from './useSwapBudget'

export type { EditText } from './editText'

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
  ai,
  onSwapping,
}: {
  exercises: MaterialExercise[]
  /** Новые упражнения. Библиотека пишет в базу: `false` — не сохранилось, форма остаётся (причину показывает экран). */
  onChange: (next: MaterialExercise[]) => void | Promise<boolean>
  text: EditText
  /** Черновик открытой формы: мастер — `material-exercise-edit`. */
  draftScope: string
  disabled?: boolean
  /** Номер упражнения с правкой без «Готово» (null — такой нет): «Сохранить» спросит, а не потеряет её молча. */
  onPending?: (n: number | null) => void
  /** Замена через AI: остаток и план материала; нет — только правка руками. */
  ai?: { budget: SwapBudget; plan: SwapPlan }
  /** Номер упражнения, которое пишет AI (null — никакое): мастер не уходит с шага, «Сохранить» спросит. */
  onSwapping?: (n: number | null) => void
}) {
  const [stored, setOpen] = useDraft<Open | null>(draftScope, null)
  const open = stored && fits(stored, exercises) ? stored : null
  const irregular = useIrregular(text.lang)
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<ExerciseFormatId | null>(null)
  const { confirm, dialog } = useConfirm()

  // список и запись — на момент записи, а не отрисовки; правки — по очереди
  const latest = useRef(exercises)
  const write = useRef(onChange)
  useLayoutEffect(() => {
    latest.current = exercises
    write.current = onChange
  })
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const commit = (make: (list: MaterialExercise[]) => MaterialExercise[] | null): Promise<CommitResult> => {
    const run = queue.current.then(async (): Promise<CommitResult> => {
      const before = latest.current.length
      const next = make(latest.current)
      if (!next) return 'missing'
      if ((await write.current(next)) === false) return 'failed'
      latest.current = next
      // AI добавил упражнение, а форма «Напишу сам» открыта — она остаётся своей
      if (next.length > before) setOpen((o) => (o?.at === 'new' && o.count === before ? { ...o, count: next.length } : o))
      return 'saved'
    })
    queue.current = run.catch(() => {})
    return run
  }

  const plan = ai?.plan ?? { words: [], grammar: '', rows: [] }
  const swap = useExerciseSwap({
    text,
    plan,
    budget: ai?.budget as SwapBudget,
    latest: () => latest.current,
    commit,
    // библиотека не сохранила ответ AI — он открывается формой и не пропадает (не сохранилось — форма остаётся)
    onUnsaved: (ex, key) =>
      setOpen((cur) => {
        const list = latest.current
        if (cur && fits(cur, list)) return cur
        if (!key) return { at: 'new', draft: toDraft(ex), was: null, count: list.length, tried: false }
        const i = list.findIndex((e) => keyOf(e) === key)
        return i < 0 ? cur : { at: i, draft: toDraft(ex), was: list[i] ?? null, tried: false }
      }),
  })
  const newRuns = swap.running.filter((r) => r.key === null)
  const n = (o: Open) => (o.at === 'new' ? exercises.length + newRuns.length + 1 : o.at + 1)
  const pending = open && changed(open) ? n(open) : null
  useEffect(() => onPending?.(pending), [pending, onPending])
  const keys = exercises.map(keyOf)
  const first = swap.running[0]
  const swapping = !first ? null : first.key === null ? exercises.length + 1 : keys.indexOf(first.key) + 1 || null
  useEffect(() => onSwapping?.(swapping), [swapping, onSwapping])

  const c = ai?.budget.counters ?? null
  const strongHere = !!ai && (hasStrong(plan, exercises) || (adding && picked !== null && strongOf(plan, picked)))
  const out = !c ? null : c.left === 0 ? 'all' : c.strongLeft === 0 && strongHere ? 'strong' : null

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
    const key = keys[i]
    setBusy(true)
    const saved = await commit((list) => {
      const j = list.findIndex((e) => keyOf(e) === key)
      return j < 0 ? null : list.filter((_, x) => x !== j)
    })
    setBusy(false)
    if (saved !== 'saved') return
    // открытая форма ниже убранного — съезжает на одно место; новая — помнит, что упражнений стало меньше
    if (open?.at === 'new') setOpen({ ...open, count: latest.current.length })
    else if (open && open.at >= i) setOpen(open.at === i ? null : { ...open, at: open.at - 1 })
  }

  const done = async () => {
    if (!open) return
    setBusy(true)
    // слово «из текста» — и в форме из справочника (took ⇒ take): дождаться его
    const forms = await loadIrregular(text.lang).catch(() => undefined)
    const ctx = { ...text, irregular: forms }
    const r = checkEdit(open.draft, ctx, open.was ?? undefined)
    if (!r.ok) {
      setBusy(false)
      setOpen({ ...open, tried: true })
      setFatal(Object.keys(exerciseProblems(open.draft, ctx)).length ? null : (r.problems.prompt ?? null))
      return
    }
    const at = open.at
    const saved = await commit((list) => (at === 'new' ? [...list, r.exercise] : list.map((e, j) => (j === at ? r.exercise : e))))
    setBusy(false)
    if (saved !== 'saved') return
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

  const note = (key: string) => swap.notes.find((x) => x.key === key)
  return (
    <div className="@container flex flex-col gap-3" data-exercise-list>
      {exercises.map((ex, i) => {
        if (open?.at === i) return editor(open)
        const key = keys[i] ?? ''
        const running = swap.running.some((r) => r.key === key)
        const strong = strongOf(plan, formatOf(ex))
        const actions = disabled ? undefined : (
          <>
            <RowAction label="Изменить" n={i + 1} disabled={busy || running} onClick={() => void start({ at: i, draft: toDraft(ex), was: ex, tried: false })}>
              <IconPencil size={15} aria-hidden />
            </RowAction>
            {ai && (
              <RowAction
                label="Заменить"
                n={i + 1}
                disabled={busy || running || !canSwap(c, strong)}
                title={canSwap(c, strong) ? undefined : strong && c && c.left > 0 ? 'Сложные замены кончились — снова завтра с 00:00' : 'Замены кончились — снова завтра с 00:00'}
                onClick={() => swap.start({ replacing: ex })}
              >
                <IconRefresh size={15} aria-hidden />
              </RowAction>
            )}
            <RowAction
              label="Убрать"
              n={i + 1}
              quiet
              disabled={busy || running || exercises.length <= 1}
              title={exercises.length <= 1 ? 'Последнее упражнение не убрать' : undefined}
              onClick={() => void remove(i)}
            >
              <IconTrash size={15} aria-hidden />
            </RowAction>
          </>
        )
        const why = note(key)
        return (
          <Fragment key={i}>
            {running ? <SwapSkeleton n={i + 1} label={rowLabel(ex)} isNew={false} actions={actions} /> : <ExerciseRow n={i + 1} ex={ex} lang={text.lang} actions={actions} />}
            {why && <ErrorText className="-mt-1 px-1">{why.text}</ErrorText>}
          </Fragment>
        )
      })}
      {newRuns.map((r, k) => (
        <SwapSkeleton key={r.id} n={exercises.length + k + 1} label={formatTitle(formatById(r.format), text.level)} isNew />
      ))}
      {open?.at === 'new' && editor(open)}
      {note(NEW) && <ErrorText className="px-1">{note(NEW)?.text}</ErrorText>}
      {out && <SwapsOut strongOnly={out === 'strong'} left={c?.left ?? 0} />}
      {!disabled && (
        <AddExercise
          open={adding}
          onToggle={() => setAdding(!adding)}
          picked={picked}
          onPick={setPicked}
          onWrite={(format) => void start({ at: 'new', draft: blankDraft(format), was: null, count: exercises.length, tried: false })}
          ai={
            ai &&
            ((id) => {
              const strong = strongOf(plan, id)
              return { note: aiButtonNote(c, strong), can: !busy && canSwap(c, strong) }
            })
          }
          onAi={(format) => {
            setAdding(false)
            setPicked(null)
            swap.start({ format })
          }}
          text={text}
          has={new Set(exercises.map(formatOf))}
        />
      )}
      {dialog}
    </div>
  )
}
