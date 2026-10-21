// ============================================================================
// Слова чипами (макеты d8-2 `.wch`, d8-3): «delay × luggage × boarding pass ×»
// и поле «слово или тема» в той же подложке — Enter или запятая добавляют,
// Backspace в пустом поле убирает последнее. В плане слова, которые добавил
// AI, — со звёздочкой и рамкой (`ai`). Чип и «×» — 44 по высоте (цель
// касания; в макете 36). В плане поле — «+ Слово» цветом ссылки (`add`):
// accent-soft-fg, а не accent-strong — тот на сером поле «Заката» 4,47 : 1.
// ============================================================================
import { useState, type KeyboardEvent } from 'react'
import { IconClose, IconPlus, IconSparkle } from '../../../shared/ui/icons'

/** «delay, luggage» ↔ ['delay', 'luggage'] — заявка хранит слова строкой (черновик Ф1.14). */
export const splitWords = (s: string): string[] =>
  s
    .split(/[,\n;]/)
    .map((w) => w.trim())
    .filter((w, i, all) => w && all.findIndex((x) => x.toLowerCase() === w.toLowerCase()) === i)

export function WordChips({
  words,
  onChange,
  lang,
  placeholder,
  inputLabel,
  ai,
  add = false,
  max = 12,
  disabled = false,
}: {
  words: string[]
  onChange: (words: string[]) => void
  lang: string
  placeholder: string
  /** Подпись поля для читалки (и смоуков): «Своё слово в план». */
  inputLabel: string
  /** Слова, которые добавил AI, — их помечаем (план, d8-3). */
  ai?: (w: string) => boolean
  /** Поле видом «+ Слово» (d8-3 `.addb`), а не серой подсказкой. */
  add?: boolean
  max?: number
  disabled?: boolean
}) {
  const [typed, setTyped] = useState('')
  const commit = () => {
    const fresh = splitWords(typed).filter((w) => !words.some((x) => x.toLowerCase() === w.toLowerCase()))
    if (fresh.length) onChange([...words, ...fresh].slice(0, max))
    setTyped('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !typed && words.length) onChange(words.slice(0, -1))
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-control-sm bg-input p-2">
      {words.map((w, i) => {
        const mark = ai?.(w) ?? false
        return (
          <span
            key={`${w}-${i}`}
            lang={lang}
            className={`inline-flex min-h-11 items-center gap-1 rounded-full bg-surface pl-3 text-sm font-medium text-fg shadow-segment ${mark ? 'pl-2 inset-ring-2 inset-ring-ring' : ''}`}
          >
            {mark && <IconSparkle size={14} aria-label="добавил AI" className="flex-none text-accent-strong" />}
            {w}
            <button
              type="button"
              aria-label={`Убрать «${w}»`}
              disabled={disabled}
              onClick={() => onChange(words.filter((_, j) => j !== i))}
              className="flex size-11 items-center justify-center rounded-full text-fg-muted hover:text-fg"
            >
              <IconClose size={16} aria-hidden />
            </button>
          </span>
        )
      })}
      {words.length < max && add && <IconPlus size={16} aria-hidden className="-mr-1.5 ml-1 flex-none text-accent-soft-fg" />}
      {words.length < max && (
        <input
          lang={lang}
          aria-label={inputLabel}
          placeholder={placeholder}
          value={typed}
          disabled={disabled}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          className={`min-h-11 min-w-30 flex-1 bg-transparent px-2 text-sm text-fg outline-none ${add ? 'font-medium placeholder:text-accent-soft-fg' : 'placeholder:text-fg-muted'}`}
        />
      )}
    </div>
  )
}
