// ============================================================================
// Ожидание экрана: вместо строчки «Загрузка…» в левом верхнем углу.
//
// Зачем. Тринадцать мест показывали одинаковый серый текст, прижатый к левому
// верхнему углу пустого экрана. Человек в этот момент не понимает ни сколько
// ждать, ни что появится, — а если ожидание короткое, текст ещё и мигает.
//
// Два примитива на два разных случая:
//   • Loading — «сейчас откроется что-то одно» (раунд игры, тест, экран целиком);
//   • RowsSkeleton — «сейчас появится список», и он уже занимает своё место,
//     поэтому появление не двигает то, что под ним.
// ============================================================================

/** Ожидание одного экрана: по центру, с живыми точками. */
export function Loading({ label = 'Загружаем' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--night-text-40)]"
    >
      <span aria-hidden className="flex items-end gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="dot-bounce h-2 w-2 rounded-full bg-[var(--night-accent)]"
            // сдвиг фазы: синхронные точки читаются как одна мигающая
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

/**
 * Ожидание списка: серые строки той же высоты, что настоящие карточки-строки.
 * Место занято заранее — значит содержимое не «прыгнет» под пальцем.
 */
export function RowsSkeleton({ count = 4, height = 74 }: { count?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl bg-white/[0.04]"
          style={{ height }}
        />
      ))}
    </div>
  )
}
