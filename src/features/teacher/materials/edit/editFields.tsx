// ============================================================================
// Поля формы правки упражнения (макет d17 `.fl17`, `.ops17`, `.pr17`): поле с
// подписью и ошибкой у него, варианты с кружком верного и «×», кнопки True /
// False, пары «слово — перевод». На телефоне цели касания 44 (заметка d17
// «Телефон»), шрифт полей 16 — иначе iPhone приближает страницу при вводе.
// ============================================================================
import { useId, type ReactNode } from 'react'
import { FieldNote } from '../../../../shared/ui/TextField'
import { IconClose, IconPlus } from '../../../../shared/ui/icons'

// своё кольцо фокуса — внутри поля, как в кадре (`.in17.foc`); общее кольцо со
// сдвигом (index.css) рисовало бы второе вокруг
export const INPUT =
  'min-h-11 w-full rounded-tile bg-input px-3 text-base text-fg placeholder:text-fg-muted focus:outline-none! focus:inset-ring-2 focus:inset-ring-focus rail:text-body'
// многострочное поле: длинный вариант переносится, а не обрезается (телефон)
const AREA = 'field-sizing-content resize-none py-2.5 leading-snug'
const BAD = 'inset-ring-2 inset-ring-danger'
const BOX_BAD = 'bg-danger-soft inset-ring-1 inset-ring-danger'

/** Подпись поля (d17 `.lb7x`), поле и ошибка под ним; у списков (`inside`) ошибка — внутри их рамки. */
export function Field({ label, error, inside = false, children }: { label: string; error?: string; inside?: boolean; children: (a: { id: string; invalid: boolean }) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-l`} className="text-xs font-semibold text-fg-muted">
        {label}
      </span>
      {children({ id, invalid: !!error })}
      {error && !inside && <FieldNote id={`${id}-e`} error={error} />}
    </div>
  )
}

/** Строка текста: вопрос, предложение, ответ. Длинное переносится и растит поле. */
export function TextBox({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  lang,
  autoFocus,
  name,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  invalid: boolean
  lang?: string
  autoFocus?: boolean
  name: string
}) {
  return (
    <textarea
      rows={1}
      lang={lang}
      name={name}
      aria-labelledby={`${id}-l`}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-e` : undefined}
      // форма открыта нажатием «Изменить»: фокус — в её первое поле
      autoFocus={autoFocus}
      className={`${INPUT} ${AREA} ${invalid ? BAD : ''}`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function Radio({ on }: { on: boolean }) {
  return <span aria-hidden className={`size-5.5 flex-none rounded-full bg-surface ${on ? 'inset-ring-7 inset-ring-success-strong' : 'inset-ring-2 inset-ring-fg-faint'}`} />
}

// цель 44 и на компьютере (аудит и решение п.76 (20)); в раскладке — 36, как в кадре
const removeBtn = 'flex size-11 flex-none items-center justify-center rounded-tile text-fg-muted active:bg-ghost-press rail:-m-1'

/** «+ форма», «+ пара» (d17 `.ad17`). */
export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-11 items-center gap-1.5 self-start rounded-tile px-2.5 text-sm font-semibold text-accent-strong active:bg-ghost-press rail:-my-1">
      <IconPlus size={16} aria-hidden />
      {children}
    </button>
  )
}

/** Варианты с кружком у верного (d17-1 `.ops17`): убрать отмеченный — верный снова не отмечен. */
export function OptionList({
  id,
  items,
  answer,
  onChange,
  item,
  error,
  lang,
}: {
  id: string
  items: string[]
  answer: number | null
  onChange: (items: string[], answer: number | null) => void
  item: (n: number) => string
  error?: string
  lang: string
}) {
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i), answer === null || answer === i ? null : answer > i ? answer - 1 : answer)
  return (
    <div role="radiogroup" aria-labelledby={`${id}-l`} aria-describedby={error ? `${id}-e` : undefined} className={`flex flex-col gap-1.5 rounded-control-sm p-2 ${error ? BOX_BAD : ''}`}>

      {items.map((text, i) => (
        <div key={i} className="flex items-center gap-1">
          <button type="button" role="radio" aria-checked={answer === i} aria-label={`Верный: ${text || item(i + 1)}`} onClick={() => onChange(items, i)} className="-ml-2.5 flex size-11 flex-none items-center justify-center">
            <Radio on={answer === i} />
          </button>
          <textarea
            rows={1}
            lang={lang}
            aria-label={item(i + 1)}
            className={`${INPUT} ${AREA}`}
            placeholder={item(i + 1)}
            value={text}
            onChange={(e) => onChange(items.map((t, j) => (j === i ? e.target.value : t)), answer)}
          />
          <button type="button" aria-label={`Убрать: ${text || item(i + 1)}`} onClick={() => remove(i)} className={removeBtn}>
            <IconClose size={16} aria-hidden />
          </button>
        </div>
      ))}
      {/* ошибка — внутри рамки, под вариантами (d17-1 `.ops17.err .er17`) */}
      {error && <FieldNote id={`${id}-e`} error={error} />}
    </div>
  )
}

/** Ответ True / False (/ Not given): кнопки на языке текста — кружком, как варианты. */
export function ChoiceRow({ id, items, answer, onAnswer, error, lang }: { id: string; items: string[]; answer: number | null; onAnswer: (i: number) => void; error?: string; lang: string }) {
  return (
    <div role="radiogroup" aria-labelledby={`${id}-l`} aria-describedby={error ? `${id}-e` : undefined} className={`flex flex-wrap gap-x-5 rounded-control-sm px-2 ${error ? BOX_BAD : ''}`}>
      {items.map((label, i) => (
        <button key={label} type="button" role="radio" aria-checked={answer === i} onClick={() => onAnswer(i)} className="flex min-h-11 items-center gap-2.5 text-body text-fg">
          <Radio on={answer === i} />
          <span lang={lang}>{label}</span>
        </button>
      ))}
      {error && (
        <span className="basis-full pb-2">
          <FieldNote id={`${id}-e`} error={error} />
        </span>
      )}
    </div>
  )
}

/** Пары «слово — перевод» (d17-2 `.pr17`): слово на языке текста, справа перевод или объяснение. */
export function PairList({
  id,
  pairs,
  onChange,
  left,
  right,
  error,
  lang,
  rightLang,
}: {
  id: string
  pairs: { left: string; right: string }[]
  onChange: (pairs: { left: string; right: string }[]) => void
  left: string
  right: string
  error?: string
  lang: string
  rightLang?: string
}) {
  const set = (i: number, patch: Partial<{ left: string; right: string }>) => onChange(pairs.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  return (
    <div role="group" aria-labelledby={`${id}-l`} aria-describedby={error ? `${id}-e` : undefined} className={`flex flex-col gap-1.5 rounded-control-sm ${error ? `${BOX_BAD} p-2` : ''}`}>
      {pairs.map((p, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5">
          <textarea rows={1} lang={lang} aria-label={`${left} ${i + 1}`} className={`${INPUT} ${AREA}`} placeholder={left} value={p.left} onChange={(e) => set(i, { left: e.target.value })} />
          <span aria-hidden className="text-fg-muted">
            —
          </span>
          <textarea
            rows={1}
            lang={rightLang}
            aria-label={`${right} ${i + 1}`}
            className={`${INPUT} ${AREA}`}
            placeholder={right}
            value={p.right}
            onChange={(e) => set(i, { right: e.target.value })}
          />
          <button type="button" aria-label={`Убрать пару ${p.left || i + 1}`} onClick={() => onChange(pairs.filter((_, j) => j !== i))} className={removeBtn}>
            <IconClose size={16} aria-hidden />
          </button>
        </div>
      ))}
      {error && <FieldNote id={`${id}-e`} error={error} />}
    </div>
  )
}
