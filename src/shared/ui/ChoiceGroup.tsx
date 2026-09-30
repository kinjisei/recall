// ============================================================================
// Выбор одного варианта из нескольких, все видны сразу: уровень, скорость
// озвучки, размер текста в Настройках. Семантика — radiogroup: скринридер
// говорит «выбрано», а не «вкладка» (вкладки — TabPicker).
//
// Вид в тёмной теме — прежний чип Настроек: подложка без рамки, выбранный —
// акцентная мягкая подложка. В светлой подложка на белом почти не видна,
// поэтому чип обведён (control-line) и отбрасывает тень, а выбранный обведён
// акцентом (control-line-active). Обводка — ring, а не border: рамка
// прибавила бы чипу 2 px, и ряд уровней в тёмной теме сдвинулся бы; ring
// рисуется тенью и места не занимает, а в тёмной теме он прозрачный.
// ============================================================================

export interface ChoiceOption<T extends string> {
  id: T
  label: string
  /** Классы подписи варианта (напр. размер шрифта у «Текст в чтении»). */
  className?: string
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  stretch = false,
  className = '',
}: {
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (id: T) => void
  /** Что выбираем — для скринридера. */
  label: string
  /** Варианты делят ширину поровну (скорость, размер); иначе — по содержимому. */
  stretch?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-2 ${stretch ? '' : 'flex-wrap'} ${className}`}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`min-h-11 rounded-xl font-medium shadow-card transition-colors ${
              stretch ? 'flex-1 px-3' : 'px-4'
            } ${o.className ?? 'text-sm'} ${
              on
                ? 'bg-accent-soft text-accent-soft-fg ring-2 ring-control-line-active'
                : 'bg-tint/[0.06] text-fg-muted ring-1 ring-control-line'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
