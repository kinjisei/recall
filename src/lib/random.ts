// ============================================================================
// Перемешивание и выборка. Чистые функции без зависимостей — отдельный модуль,
// чтобы лёгкие экраны (placement) не тянули wordPool с supabase и словарями.
// ============================================================================

/** Возвращает НОВЫЙ массив в случайном порядке (Фишер–Йейтс). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** n случайных элементов без повторов. */
export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}
