// ============================================================================
// Упражнение на правке (макет d17-1, d17-2, d17-3б): форма на месте
// упражнения — вопрос, варианты с кружком у верного, пары, ответ «вставь»,
// предложение «собери»; ошибка — у поля; внизу «Готово · Отмена» и правило
// вида («Без верного варианта не сохранить»). Поля по виду задаёт
// `editSpec` (domains/materials), проверку делает тот, кто открыл форму.
//
// Телефон (заметка d17): «Готово» и «Отмена» закреплены внизу экрана, пока
// форма открыта, — над клавиатурой (`useKeyboardInset`), без неё — над
// нижним меню.
// ============================================================================
import { editSpec, type EditProblems, type EditTarget, type ExerciseDraft } from '../../../../domains/materials'
import { useKeyboardInset } from '../../../../lib/useKeyboardInset'
import { useShellInsets } from '../../../../shared/lib/shellInsets'
import { ErrorText } from '../../../../shared/ui/ErrorText'
import { ExerciseHead } from '../detailParts'
import { AddButton, ChoiceRow, Field, OptionList, PairList, TextBox } from './editFields'

export function ExerciseEditor({
  n,
  label,
  isNew,
  draft,
  onChange,
  problems,
  fatal,
  target,
  busy,
  onDone,
  onCancel,
}: {
  n: number
  /** Вид: «Выбери ответ». */
  label: string
  isNew: boolean
  draft: ExerciseDraft
  onChange: (d: ExerciseDraft) => void
  /** Причины по полям — после первого «Готово». */
  problems: EditProblems
  /** Фильтр отверг то, что прошло проверку полей, — строка над кнопками. */
  fatal: string | null
  target: EditTarget
  busy: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const spec = editSpec(draft.format, target)
  const kb = useKeyboardInset()
  const { bottom } = useShellInsets()
  const set = (patch: Partial<ExerciseDraft>) => onChange({ ...draft, ...patch })
  const lang = target.lang
  const rightLang = draft.format === 'match_definition' ? lang : undefined

  return (
    <div role="group" aria-label={`Упражнение ${n} — ${isNew ? 'новое' : 'правка'}`} className="flex flex-col gap-2 rounded-control bg-surface py-3 pl-3.5 pr-3 inset-ring-2 inset-ring-focus" data-exercise-edit={n}>
      <ExerciseHead n={n} label={`${label} · ${isNew ? 'новое' : 'правка'}`} editing />
      {spec.prompt && (
        <Field label={spec.prompt.label} error={problems.prompt}>
          {({ id, invalid }) => <TextBox id={id} name="prompt" lang={lang} autoFocus value={draft.prompt} onChange={(prompt) => set({ prompt })} placeholder={spec.prompt?.placeholder ?? ''} invalid={invalid} />}
        </Field>
      )}
      {spec.options && (
        <>
          <Field label={spec.options.label} error={problems.options ?? problems.answer} inside>
            {({ id }) => (
              <OptionList
                id={id}
                lang={lang}
                items={draft.options}
                answer={draft.answer}
                item={spec.options?.item ?? String}
                error={problems.options ?? problems.answer}
                onChange={(options, answer) => set({ options, answer })}
              />
            )}
          </Field>
          {draft.options.length < spec.options.max && <AddButton onClick={() => set({ options: [...draft.options, ''] })}>{spec.options.add}</AddButton>}
        </>
      )}
      {spec.buttons && (
        <Field label={spec.buttons.label} error={problems.answer} inside>
          {({ id }) => <ChoiceRow id={id} lang={lang} items={spec.buttons?.items ?? []} answer={draft.answer} error={problems.answer} onAnswer={(answer) => set({ answer })} />}
        </Field>
      )}
      {spec.text && (
        <Field label={spec.text.label} error={problems.text}>
          {({ id, invalid }) => <TextBox id={id} name="text" lang={lang} value={draft.text} onChange={(text) => set({ text })} placeholder={spec.text?.placeholder ?? ''} invalid={invalid} />}
        </Field>
      )}
      {spec.pairs && (
        <>
          <Field label={spec.pairs.label} error={problems.pairs} inside>
            {({ id }) => (
              <PairList
                id={id}
                lang={lang}
                rightLang={rightLang}
                pairs={draft.pairs}
                left={spec.pairs?.left ?? ''}
                right={spec.pairs?.right ?? ''}
                error={problems.pairs}
                onChange={(pairs) => set({ pairs })}
              />
            )}
          </Field>
          {draft.pairs.length < spec.pairs.max && <AddButton onClick={() => set({ pairs: [...draft.pairs, { left: '', right: '' }] })}>{spec.pairs.add}</AddButton>}
        </>
      )}
      {spec.extra && (
        <Field label={spec.extra.label} error={problems.extra}>
          {({ id, invalid }) => (
            <TextBox id={id} name="extra" lang={rightLang} value={draft.extra[0] ?? ''} onChange={(v) => set({ extra: [v, ...draft.extra.slice(1)] })} placeholder={spec.extra?.placeholder ?? ''} invalid={invalid} />
          )}
        </Field>
      )}
      {spec.note && (
        <Field label={spec.note.label}>
          {({ id }) => <TextBox id={id} name="note" value={draft.note} onChange={(note) => set({ note })} placeholder={spec.note?.placeholder ?? ''} invalid={false} />}
        </Field>
      )}
      {fatal && <ErrorText>{fatal}</ErrorText>}
      <div style={{ bottom: kb > 0 ? `${kb}px` : bottom }} className="flex flex-wrap items-center gap-2 bg-surface pt-1 max-rail:sticky max-rail:z-10 max-rail:-mb-3 max-rail:pb-3" data-edit-footer>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="h-11 rounded-tile bg-accent-soft px-4 text-sm font-semibold text-accent-soft-fg active:bg-accent-soft-press disabled:opacity-60 rail:-my-0.5"
        >
          Готово
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-tile px-3 text-sm font-medium text-fg-secondary active:bg-ghost-press rail:-my-0.5">
          Отмена
        </button>
        {!isNew && <small className="ml-auto text-xs text-fg-muted">{spec.footnote}</small>}
      </div>
    </div>
  )
}
