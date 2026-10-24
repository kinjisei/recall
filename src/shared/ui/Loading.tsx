// ============================================================================
// Ожидание экрана: вместо строчки «Загрузка…» в левом верхнем углу.
//
// Зачем. Тринадцать мест показывали одинаковый серый текст, прижатый к левому
// верхнему углу пустого экрана. Человек в этот момент не понимает ни сколько
// ждать, ни что появится, — а если ожидание короткое, текст ещё и мигает.
//
// Два примитива на два разных случая:
//   • Loading — «сейчас откроется что-то одно» (раунд игры, тест, экран целиком);
//   • RowsSkeleton — «сейчас появится список» (лист s3): скелетон повторяет
//     раскладку строк — круг 40 и две полосы — и уже занимает своё место,
//     поэтому появление не двигает то, что под ним. Мягко пульсирует, при
//     «уменьшить движение» — статичный.
// ============================================================================

/** Ожидание одного экрана: по центру, с живыми точками. */
export function Loading({ label = 'Загружаем' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col items-center justify-center gap-3 py-16 text-fg-muted"
    >
      <span aria-hidden className="flex items-end gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="dot-bounce h-2 w-2 rounded-full bg-accent"
            // сдвиг фазы: синхронные точки читаются как одна мигающая
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

// ширины полос — разные, иначе строки читаются как решётка, а не как список
const BARS = [
  ['w-7/10', 'w-9/20'],
  ['w-3/5', 'w-1/2'],
  ['w-3/4', 'w-7/20'],
  ['w-11/20', 'w-2/5'],
] as const

/** Строка скелетона: круг 40 (если строка достаточно высокая) и две полосы. */
function SkeletonRow({ i, height }: { i: number; height?: number }) {
  const [a, b] = BARS[i % BARS.length] ?? BARS[0]
  const lead = !height || height >= 56
  return (
    <div className={`flex min-h-16 items-center gap-3 pl-4 pr-3.5 ${lead ? 'py-2.5' : 'py-2'}`} style={height ? { minHeight: height } : undefined}>
      {lead && <span className="animate-skeleton size-10 flex-none rounded-full bg-skeleton" />}
      <span className="flex flex-1 flex-col gap-2">
        <span className={`animate-skeleton h-3 rounded-tag bg-skeleton ${a}`} />
        {lead && <span className={`animate-skeleton h-2.5 rounded-tag bg-skeleton ${b}`} />}
      </span>
    </div>
  )
}

/** Ожидание блока своей высоты (ссылка-приглашение, карточка): поверхность скелетона, без своих цветов. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded-control bg-skeleton ${className}`} aria-hidden />
}

/**
 * Ожидание списка. Без height — список листа s3: строки 64 в одной
 * поверхности с разделителями. С height — отдельные строки этой высоты:
 * экран, у которого строки ниже или выше, держит ровно своё место.
 */
export function RowsSkeleton({ count = 4, height }: { count?: number; height?: number }) {
  const rows = Array.from({ length: count }, (_, i) => <SkeletonRow key={i} i={i} height={height} />)
  if (height) {
    return (
      <div className="flex flex-col gap-2.5 *:rounded-row *:bg-surface *:shadow-card" aria-hidden>
        {rows}
      </div>
    )
  }
  return (
    <div className="flex flex-col divide-y divide-line overflow-hidden rounded-row bg-surface shadow-card" aria-hidden>
      {rows}
    </div>
  )
}
