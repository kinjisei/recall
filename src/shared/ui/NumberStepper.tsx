// ============================================================================
// Число с «−» и «+» (макет d11-2, «Недель»: `.stp11`): подложка поля высотой
// 48 и радиусом 14, кнопки — белые «таблетки» с тенью сегмента, число между
// ними полужирным. Кнопки 44, а не 40, как в кадре: цель касания (s3). На
// краю диапазона кнопка выключена, а не молчит при нажатии.
//
// `inline` — в строке списка на подложке input (d16, «3 вопр.» в плане
// упражнений): белая рамка с тонкой линией, кнопки без подложки, рядом с
// числом — единица. Высота 48 и кнопки 44 и на компьютере, где в кадре d16-1
// 40 и 36: цель касания (s3) — та же причина, что выше.
// ============================================================================
import type { ReactNode } from 'react'

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  label,
  unit,
  variant = 'field',
  disabled = false,
}: {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  /** Что считаем — для скринридера: «Недель». */
  label: string
  /** Единица рядом с числом: «вопр.», «пар». */
  unit?: ReactNode
  variant?: 'field' | 'inline'
  disabled?: boolean
}) {
  const inline = variant === 'inline'
  const btn = inline
    ? 'flex size-11 items-center justify-center rounded-tag text-xl text-fg active:bg-ghost-press disabled:text-fg-faint disabled:active:bg-transparent'
    : 'flex size-11 items-center justify-center rounded-control-sm bg-segment text-xl text-fg shadow-segment transition-[scale,color] duration-(--dur-1) active:scale-95 disabled:bg-transparent disabled:text-fg-faint disabled:shadow-none motion-reduce:active:scale-100'
  const box = inline
    ? 'inline-flex h-12 flex-none items-center rounded-tile bg-surface p-0.5 inset-ring-1 inset-ring-line'
    : 'inline-flex h-12 items-center gap-1 self-start rounded-control-sm bg-input p-0.5'
  return (
    <div role="group" aria-label={label} className={box}>
      <button type="button" aria-label="Меньше" disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        −
      </button>
      <output aria-live="polite" className={`text-center font-semibold tabular-nums text-fg ${inline ? 'min-w-14.5 whitespace-nowrap text-body' : 'min-w-18 text-base'}`}>
        {value}
        {unit && <small className="text-xs font-medium text-fg-muted"> {unit}</small>}
      </output>
      <button type="button" aria-label="Больше" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
        +
      </button>
    </div>
  )
}
