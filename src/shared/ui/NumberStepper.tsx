// ============================================================================
// Число с «−» и «+» (макет d11-2, «Недель»: `.stp11`): подложка поля высотой
// 48 и радиусом 14, кнопки — белые «таблетки» с тенью сегмента, число между
// ними полужирным. Кнопки 44, а не 40, как в кадре: цель касания (s3). На
// краю диапазона кнопка выключена, а не молчит при нажатии.
// ============================================================================

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  /** Что считаем — для скринридера: «Недель». */
  label: string
}) {
  const btn =
    'flex size-11 items-center justify-center rounded-control-sm bg-segment text-xl text-fg shadow-segment transition-[scale,color] duration-(--dur-1) active:scale-95 disabled:bg-transparent disabled:text-fg-faint disabled:shadow-none motion-reduce:active:scale-100'
  return (
    <div role="group" aria-label={label} className="inline-flex h-12 items-center gap-1 self-start rounded-control-sm bg-input p-0.5">
      <button type="button" aria-label="Меньше" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={btn}>
        −
      </button>
      <output aria-live="polite" className="min-w-18 text-center text-base font-semibold tabular-nums text-fg">
        {value}
      </output>
      <button type="button" aria-label="Больше" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={btn}>
        +
      </button>
    </div>
  )
}
