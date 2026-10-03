// ============================================================================
// Выбор одного варианта из нескольких, все видны сразу: уровень, скорость
// озвучки, размер текста в Настройках, тариф на «Как оплатить». Семантика —
// radiogroup: скринридер говорит «выбрано», а не «вкладка» (вкладки — TabPicker).
//
// Два вида:
//   chips — короткие подписи в ряд (Настройки). Вид в тёмной теме — прежний
//           чип Настроек: подложка без рамки, выбранный — акцентная мягкая
//           подложка. В светлой подложка на белом почти не видна, поэтому
//           чип обведён (control-line) и отбрасывает тень, а выбранный обведён
//           акцентом (control-line-active). Обводка — ring, а не border: рамка
//           прибавила бы чипу 2 px, и ряд уровней в тёмной теме сдвинулся бы;
//           ring рисуется тенью и места не занимает, а в тёмной теме он
//           прозрачный;
//   cards — карточки столбиком: кружок выбора, подпись, пояснение и правый
//           слот (цена). Выбор, где у варианта есть что объяснить (макет t9,
//           тарифы). Выбранная обведена акцентом в обеих темах: без рамки в
//           тёмной теме её отличала бы только подложка.
// ============================================================================
import type { ReactNode } from 'react'

export interface ChoiceOption<T extends string> {
  id: T
  label: string
  /** Классы подписи варианта (напр. размер шрифта у «Текст в чтении»). */
  className?: string
  /** Вторая строка карточки (только вид cards). */
  hint?: string
  /** Правый слот карточки — цена, счётчик (только вид cards). */
  trailing?: ReactNode
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  stretch = false,
  variant = 'chips',
  className = '',
}: {
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (id: T) => void
  /** Что выбираем — для скринридера. */
  label: string
  /** Варианты делят ширину поровну (скорость, размер); иначе — по содержимому. */
  stretch?: boolean
  variant?: 'chips' | 'cards'
  className?: string
}) {
  if (variant === 'cards') {
    return (
      <div role="radiogroup" aria-label={label} className={`flex flex-col gap-2 ${className}`}>
        {options.map((o) => {
          const on = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-card transition-colors ${
                on ? 'border-accent-line bg-accent-soft' : 'border-tint/[0.08] bg-surface hover:bg-tint/[0.04]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                  on ? 'border-accent' : 'border-fg-faint'
                }`}
              >
                {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`font-medium ${on ? 'text-accent-soft-fg' : 'text-fg'} ${o.className ?? ''}`}>{o.label}</span>
                {o.hint && <span className="text-note text-fg-muted">{o.hint}</span>}
              </span>
              {o.trailing && <span className="flex-none text-right">{o.trailing}</span>}
            </button>
          )
        })}
      </div>
    )
  }

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
