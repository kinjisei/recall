// ============================================================================
// Ползунок числа (макет d10-4, «Верных ответов для зачёта»): дорожка 6 px на
// подложке поля, заполненная часть — акцент, ручка 24 — поверхность в кольце
// акцента с мягким ореолом. Под картинкой — родной <input type="range">
// прозрачным слоем во всю высоту 44: клавиатура, скринридер и палец работают
// как у обычного ползунка, а нарисованная ручка только повторяет значение.
// Фокус с клавиатуры — кольцо фокуса вокруг ручки.
// ============================================================================
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  className = '',
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  /** Что меняем — для скринридера (подпись над ползунком видна отдельно). */
  label: string
  className?: string
}) {
  const share = max > min ? (Math.min(Math.max(value, min), max) - min) / (max - min) : 0
  const at = `${share * 100}%`
  return (
    <div className={`relative mx-3 flex h-11 items-center ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="peer absolute -inset-x-3 inset-y-0 z-10 cursor-pointer opacity-0"
      />
      <span aria-hidden className="relative h-1.5 w-full rounded-full bg-input">
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: at }} />
      </span>
      <span
        aria-hidden
        style={{ left: at }}
        className="pointer-events-none absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface shadow-card ring-2 ring-primary outline-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-focus"
      />
    </div>
  )
}
