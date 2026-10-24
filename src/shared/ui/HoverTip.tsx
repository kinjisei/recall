// ============================================================================
// Подпись при наведении справа от иконки — рельс 72 на компьютере (макет d0,
// правило 1: «иконки, подпись при наведении»). Видна и при фокусе с
// клавиатуры. Родителю нужны классы `group relative`; само имя кнопки — в её
// aria-label, подпись скринридеру не читается второй раз.
// ============================================================================

export function HoverTip({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-full top-1/2 z-40 ml-5 -translate-y-1/2 whitespace-nowrap rounded-tag bg-fg px-2.5 py-1.5 text-xs font-medium text-page opacity-0 shadow-raised transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  )
}
