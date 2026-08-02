// ============================================================================
// Уровень текста по CEFR из уровней его частей. Ключевое правило (Заход 3e):
// уровень текста задаёт САМАЯ СЛОЖНАЯ часть (потолок), а не среднее — иначе
// «простое начало + сложный конец» занижается до среднего. Показываем диапазон
// (низ = самый частый уровень частей, верх = потолок) + подсказку, где сложнее.
// Чистый модуль (без зависимостей) — покрыт node-тестом.
// ============================================================================

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function cefrIndex(level: string): number {
  return CEFR.indexOf(level)
}

/** Самый частый индекс (мода); при равенстве — меньший (осторожная нижняя граница). */
function modeIndex(idx: number[]): number {
  const count = new Map<number, number>()
  for (const i of idx) count.set(i, (count.get(i) ?? 0) + 1)
  let best = idx[0] ?? 0
  let bestN = 0
  for (const [i, n] of count) {
    if (n > bestN || (n === bestN && i < best)) {
      best = i
      bestN = n
    }
  }
  return best
}

export interface LevelRange {
  /** Диапазон для показа: «B1» или «B1–B2». */
  level: string
  /** Где сложнее: «сложнее к концу» / «сложнее в начале» / «местами сложнее» / ''. */
  note: string
}

/**
 * Диапазон уровня по уровням частей (в порядке текста).
 * Верх = потолок (max), низ = мода частей. note ставится, только если есть
 * реальный разброс и частей ≥ 2.
 */
export function levelRange(levels: string[]): LevelRange {
  const idx = levels.map(cefrIndex).filter((i) => i >= 0)
  if (idx.length === 0) return { level: '', note: '' }

  const ceil = Math.max(...idx)
  const floor = Math.min(modeIndex(idx), ceil)
  const level = floor === ceil ? CEFR[ceil]! : `${CEFR[floor]}–${CEFR[ceil]}`

  let note = ''
  if (ceil > floor && idx.length >= 2) {
    // где расположены самые сложные части?
    const last = idx.length - 1
    const peaks = idx.map((v, i) => ({ v, i })).filter((p) => p.v === ceil).map((p) => p.i)
    const allLate = peaks.every((p) => p / last >= 0.6)
    const allEarly = peaks.every((p) => p / last <= 0.4)
    note = allLate ? 'сложнее к концу' : allEarly ? 'сложнее в начале' : 'местами сложнее'
  }
  return { level, note }
}

/** Готовая строка уровня для показа: «B1–B2, сложнее к концу». */
export function levelDisplay(levels: string[]): string {
  const { level, note } = levelRange(levels)
  if (!level) return ''
  return note ? `${level}, ${note}` : level
}
